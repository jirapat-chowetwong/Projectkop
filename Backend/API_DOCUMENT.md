# API Document — KOP MART (สมาชิก / สินค้า / ตะกร้า / คำสั่งซื้อ)

Base URL: `http://localhost:3000/api`
รูปแบบข้อมูล: JSON (ยกเว้นอัปโหลดรูปใช้ `multipart/form-data`)
เอกสารแบบ Swagger ฉบับเต็ม: [services/swagger.yaml](services/swagger.yaml) · ชุดทดสอบ Postman: [postman/Mart-Auth.postman_collection.json](postman/Mart-Auth.postman_collection.json) (สมาชิก) · [postman/Mart-Shop.postman_collection.json](postman/Mart-Shop.postman_collection.json) (สินค้า/ตะกร้า/คำสั่งซื้อ)

## สรุป Endpoint

| # | Method | Path | ทำอะไร | สิทธิ์ |
|---|--------|------|--------|--------|
| 1 | POST | `/members` | สมัครสมาชิก | Public |
| 2 | POST | `/members/login` | เข้าสู่ระบบ | Public |
| 3 | GET | `/members/logout` | ออกจากระบบ | Public |
| 4 | GET | `/members/detail` | ดูข้อมูลตัวเอง | Member+Admin |
| 5 | PUT | `/members` | แก้ไขข้อมูลส่วนตัว | Member+Admin |
| 6 | POST | `/members/uploadimg` | อัปโหลดรูปโปรไฟล์ | Member+Admin |
| 7 | GET | `/members` | รายชื่อสมาชิกทั้งหมด | Admin |
| 8 | PUT | `/members/:id/status` | ระงับ/เปิดใช้งานบัญชี | Admin |
| 9 | PUT | `/members/:id/role` | เปลี่ยนบทบาท (เพิ่ม admin) | Admin |
| 10 | GET | `/products` | รายการสินค้า (ค้นหา/กรอง/เรียง/แบ่งหน้า) | Public (admin ใช้ `?all=true` เห็นสินค้าที่ซ่อน) |
| 11 | GET | `/products/:id` | รายละเอียดสินค้า 1 รายการ | Public |
| 12 | POST | `/products` | เพิ่มสินค้า | Admin |
| 13 | PUT | `/products/:id` | แก้ไขสินค้า (แทนที่ทุกช่อง) | Admin |
| 14 | DELETE | `/products/:id` | ลบสินค้า | Admin |
| 15 | POST | `/products/:id/image` | เปลี่ยนรูปสินค้า | Admin |
| 16 | GET | `/series` | รายการซีรีส์ + จำนวนสินค้า | Public |
| 17 | GET | `/series/:id` | ซีรีส์ 1 รายการ + สินค้าในซีรีส์ | Public |
| 18 | GET | `/cart` | ดูตะกร้าของตัวเอง | Member+Admin |
| 19 | POST | `/cart` | เพิ่มสินค้าลงตะกร้า | Member+Admin |
| 20 | DELETE | `/cart/items/:itemId` | ลบสินค้า 1 รายการออกจากตะกร้า | Member+Admin |
| 21 | DELETE | `/cart` | ล้างตะกร้าทั้งหมด (*ยังไม่มีหน้าเว็บเรียกใช้*) | Member+Admin |
| 22 | POST | `/cart/checkout` | ยืนยันสั่งซื้อ (ตัดสต็อก) | Member+Admin |
| 23 | GET | `/orders` | ประวัติคำสั่งซื้อ (admin ดูของคนอื่นด้วย `?target_member_id=`) | Member+Admin |
| 24 | GET | `/orders/:orderId` | รายละเอียดคำสั่งซื้อ + รายการสินค้า | เจ้าของ / Admin |
| 25 | GET | `/orders/member/:memberId` | ประวัติคำสั่งซื้อของสมาชิกคนหนึ่ง (*ยังไม่มีหน้าเว็บเรียกใช้*) | เจ้าของ / Admin |

## การยืนยันตัวตน

1. `POST /members/login` สำเร็จ → Backend ตั้ง Cookie `token` (httpOnly, อายุ 1 ชั่วโมง) และส่ง `token` กลับใน body ด้วย
2. Frontend เรียกด้วย `withCredentials: true` (axios) / `credentials: 'include'` (fetch) เพื่อให้ Browser ส่ง Cookie
3. ทดสอบด้วย curl/Postman ส่ง Header `Authorization: Bearer <token>` แทน Cookie ได้ (ถ้ามีทั้งสองอย่างใช้ Header)
4. สิทธิ์ Admin ตรวจ `role` จากฐานข้อมูลทุกครั้ง

บัญชีทดลอง: `somchai@example.com` (member) / `admin@popmart.test` (admin) รหัสผ่าน `Passw0rd!`

## HTTP status ที่ใช้

| Status | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 201 | สร้างสำเร็จ (สมัครสมาชิก) |
| 400 | ข้อมูลที่ส่งไม่ครบ/ไม่ถูกต้อง |
| 401 | ยังไม่ login / login ไม่ผ่าน / token ผิดหรือหมดอายุ |
| 403 | ไม่มีสิทธิ์ (ไม่ใช่ admin) หรือบัญชีถูกระงับ |
| 404 | ไม่พบข้อมูล |
| 409 | ข้อมูลซ้ำ (อีเมลถูกใช้แล้ว) |
| 500 | ข้อผิดพลาดของเซิร์ฟเวอร์/ฐานข้อมูล |

ทุก response มี `message` อธิบายผล และบาง endpoint มี flag บอกผลใน body: `regist`, `login`, `update`, `upload` (true/false)

---

## 1. สมัครสมาชิก — `POST /members`

**ทำอะไร:** สร้างบัญชีใหม่ รหัสผ่านถูก hash ด้วย bcrypt ก่อนเก็บ บทบาทเป็น `member` และสถานะ `active` เสมอ (ค่า `role` ที่ส่งมาถูกละเลย)

**Parameter (JSON body)**

| ชื่อ | ชนิด | บังคับ | รายละเอียด |
|---|---|---|---|
| email | string | ✓ | ต้องไม่ซ้ำกับสมาชิกอื่น |
| name | string | ✓ | ไม่เกิน 100 ตัวอักษร |
| password | string | ✓ | อย่างน้อย 8 ตัวอักษร |
| phone | string | | ไม่เกิน 20 ตัวอักษร |
| address | string | | |

**Return:** ข้อมูลสมาชิกที่สร้าง (ไม่มี password) + `message`, `regist`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 201 | สำเร็จ | `Regist Success` |
| 400 | ข้อมูลไม่ครบ | `ERROR email, name and password is required.` |
| 400 | รหัสผ่านสั้นกว่า 8 | `ERROR password must be at least 8 characters.` |
| 409 | อีเมลซ้ำ | `ERROR email <email> is exists.` |
| 500 | ฐานข้อมูลผิดพลาด | (ข้อความ error) |

**ตัวอย่างการเรียก**
```bash
curl -X POST http://localhost:3000/api/members \
  -H "Content-Type: application/json" \
  -d '{"email":"nattaya.test@example.com","name":"Nattaya","password":"Mart2026!"}'
```

**ตัวอย่างผลลัพธ์ (201)**
```json
{
  "id": 11,
  "email": "nattaya.test@example.com",
  "name": "Nattaya",
  "phone": null,
  "address": null,
  "role": "member",
  "created_at": "2026-10-30T09:56:52.070Z",
  "message": "Regist Success",
  "regist": true
}
```

---

## 2. เข้าสู่ระบบ — `POST /members/login`

**ทำอะไร:** ตรวจอีเมล/รหัสผ่านด้วย bcrypt แล้วสร้าง JWT (อายุ 1 ชั่วโมง) ตั้งเป็น Cookie `token` และส่งกลับใน body อีเมลไม่มีในระบบกับรหัสผ่านผิดตอบข้อความเดียวกัน

**Parameter (JSON body)**

| ชื่อ | ชนิด | บังคับ | รายละเอียด |
|---|---|---|---|
| email | string | ✓ | |
| password | string | ✓ | |

**Return:** `message`, `login`, `token`, `member {id, email, name, role}` + Header `Set-Cookie: token=<JWT>; HttpOnly; SameSite=Lax`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `Login Success` |
| 400 | ไม่ส่งอีเมลหรือรหัสผ่าน | `Email and Password is required` |
| 401 | อีเมล/รหัสผ่านผิด | `Login Fail` |
| 403 | บัญชีถูกระงับ | `This account is suspended` |
| 500 | ฐานข้อมูลผิดพลาด | (ข้อความ error) |

**ตัวอย่างการเรียก**
```bash
curl -X POST http://localhost:3000/api/members/login \
  -H "Content-Type: application/json" \
  -d '{"email":"somchai@example.com","password":"Passw0rd!"}'
```

**ตัวอย่างผลลัพธ์ (200)**
```json
{
  "message": "Login Success",
  "login": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "member": { "id": 2, "email": "somchai@example.com", "name": "Somchai Jaidee", "role": "member" }
}
```

---

## 3. ออกจากระบบ — `GET /members/logout`

**ทำอะไร:** ล้าง Cookie `token` (เรียกซ้ำได้ ไม่มีผลเสีย)
**Parameter:** ไม่มี
**Return:** 200 `{ "message": "Logout Success", "login": false }`

```bash
curl http://localhost:3000/api/members/logout
```

---

## 4. ดูข้อมูลตัวเอง — `GET /members/detail`

**ทำอะไร:** อ่านข้อมูลสมาชิกที่ login อยู่จากฐานข้อมูล (ข้อมูลล่าสุดเสมอ) Frontend ใช้เช็คว่า login อยู่หรือไม่และแสดงหน้าโปรไฟล์
**Parameter:** ไม่มี (ใช้ Cookie หรือ Bearer token)
**Return:** ข้อมูลสมาชิก + `login: true`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | – |
| 401 | ไม่มี token | `No member` |
| 401 | token ผิด/หมดอายุ | `The information was falsified.` |
| 403 | บัญชีถูกระงับ | `This account is suspended` |

```bash
curl http://localhost:3000/api/members/detail -H "Authorization: Bearer <token>"
```

**ตัวอย่างผลลัพธ์ (200)**
```json
{
  "id": 2,
  "email": "somchai@example.com",
  "name": "Somchai Jaidee",
  "phone": "0810000002",
  "address": "12 Sukhumvit Rd, Bangkok",
  "image": "member_2_1761815000000.png",
  "role": "member",
  "status": "active",
  "created_at": "2026-10-28T12:00:00.000Z",
  "login": true
}
```

---

## 5. แก้ไขข้อมูลส่วนตัว — `PUT /members`

**ทำอะไร:** แก้ `name`, `phone`, `address` ของตัวเอง ส่งเฉพาะ field ที่ต้องการแก้ (ต้องมีอย่างน้อย 1 field) ส่ง `""` ที่ phone/address เพื่อลบค่า แก้ `email`/`role` ไม่ได้ (ถูกละเลย)

**Parameter (JSON body)**

| ชื่อ | ชนิด | บังคับ | รายละเอียด |
|---|---|---|---|
| name | string | | ไม่ว่าง ไม่เกิน 100 ตัว |
| phone | string | | ไม่เกิน 20 ตัว |
| address | string | | |

**Return:** ข้อมูลสมาชิกล่าสุด + `message: "Update Success"`, `update: true`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `Update Success` |
| 400 | ไม่ส่ง field ใดเลย | `ERROR name, phone or address is required.` |
| 400 | ชื่อว่าง/ยาวเกิน | `ERROR name is required (max 100 characters).` |
| 400 | เบอร์ยาวเกิน | `ERROR phone is too long (max 20 characters).` |
| 401 | ยังไม่ login | `Please login` |
| 404 | ไม่พบสมาชิก | `Member not found` |

```bash
curl -X PUT http://localhost:3000/api/members \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"Somchai Jaidee","phone":"0812345678","address":"12 Sukhumvit Rd, Bangkok"}'
```

**ตัวอย่างผลลัพธ์ (200)**
```json
{
  "id": 2, "email": "somchai@example.com", "name": "Somchai Jaidee",
  "phone": "0812345678", "address": "12 Sukhumvit Rd, Bangkok", "image": null,
  "role": "member", "status": "active", "created_at": "2026-10-28T12:00:00.000Z",
  "message": "Update Success", "update": true
}
```

---

## 6. อัปโหลดรูปโปรไฟล์ — `POST /members/uploadimg`

**ทำอะไร:** อัปโหลดรูปโปรไฟล์ ชื่อไฟล์ตั้งโดย Backend (`member_<id>_<เวลา>.<นามสกุล>`) รูปเก่าถูกลบ ดูรูปได้ที่ `http://localhost:3000/img_mem/<ชื่อไฟล์>`

**Parameter (`multipart/form-data`)**

| ชื่อ | ชนิด | บังคับ | รายละเอียด |
|---|---|---|---|
| file | ไฟล์ | ✓ | .jpg .jpeg .png .webp .gif ไม่เกิน 2 MB |

**Return:** `message`, `upload`, `image` (ชื่อไฟล์)

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `File uploaded successfully!` |
| 400 | ไม่แนบไฟล์ | `ERROR file is required.` |
| 400 | ไม่ใช่รูป/ใหญ่เกิน 2 MB | `Only image files (jpg, png, webp, gif) are allowed` / ข้อความของ multer |
| 401 | ยังไม่ login | `Please login` |
| 500 | บันทึกไม่สำเร็จ | (ข้อความ error) |

```bash
curl -X POST http://localhost:3000/api/members/uploadimg \
  -H "Authorization: Bearer <token>" -F "file=@profile.png"
```

**ตัวอย่างผลลัพธ์ (200)**
```json
{ "message": "File uploaded successfully!", "upload": true, "image": "member_2_1761815000000.png" }
```

---

## 7. รายชื่อสมาชิกทั้งหมด — `GET /members` (Admin)

**ทำอะไร:** แสดงสมาชิกทั้งหมดเรียงตาม id พร้อมค้นหา/กรอง

**Parameter (query string — ไม่บังคับทั้งหมด)**

| ชื่อ | ค่า | รายละเอียด |
|---|---|---|
| q | string | ค้นหาจากชื่อหรืออีเมล (ไม่สนตัวพิมพ์ ค้นบางส่วนได้) |
| role | `member` \| `admin` | กรองตามบทบาท |
| status | `active` \| `suspended` | กรองตามสถานะ |

**Return:** `{ total, data: [สมาชิก...] }`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | – |
| 400 | role/status ไม่ถูกต้อง | `role must be member or admin` / `status must be active or suspended` |
| 401 | ยังไม่ login | `Please login` |
| 403 | ไม่ใช่ admin | `Admin only` |

```bash
curl "http://localhost:3000/api/members?q=somchai&status=active" -H "Authorization: Bearer <admin-token>"
```

**ตัวอย่างผลลัพธ์ (200)**
```json
{
  "total": 1,
  "data": [
    { "id": 2, "email": "somchai@example.com", "name": "Somchai Jaidee", "phone": "0810000002",
      "address": "12 Sukhumvit Rd, Bangkok", "image": null, "role": "member",
      "status": "active", "created_at": "2026-10-28T12:00:00.000Z" }
  ]
}
```

---

## 8. เปลี่ยนสถานะสมาชิก — `PUT /members/:id/status` (Admin)

**ทำอะไร:** ระงับ (`suspended`) หรือเปิดใช้งาน (`active`) บัญชี สมาชิกที่ถูกระงับ login ไม่ได้ และ token เดิมใช้ไม่ได้ เปลี่ยนของตัวเองไม่ได้

**Parameter**

| ที่ | ชื่อ | ชนิด | บังคับ | รายละเอียด |
|---|---|---|---|---|
| path | id | integer | ✓ | รหัสสมาชิก |
| body | status | string | ✓ | `active` หรือ `suspended` |

**Return:** ข้อมูลสมาชิกล่าสุด + `message: "Update status Success"`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `Update status Success` |
| 400 | id ไม่ใช่ตัวเลข | `id must be a number` |
| 400 | status ผิด | `status must be one of: active, suspended` |
| 400 | เปลี่ยนของตัวเอง | `You cannot change your own status` |
| 401 / 403 | ไม่ login / ไม่ใช่ admin | `Please login` / `Admin only` |
| 404 | ไม่พบสมาชิก | `Member not found` |

```bash
curl -X PUT http://localhost:3000/api/members/3/status \
  -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" \
  -d '{"status":"suspended"}'
```

**ตัวอย่างผลลัพธ์ (200)**
```json
{
  "id": 3, "email": "suda@example.com", "name": "Suda Rakdee", "phone": "0810000003",
  "address": "45 Nimman Rd, Chiang Mai", "image": null, "role": "member",
  "status": "suspended", "created_at": "2026-10-28T12:00:00.000Z",
  "message": "Update status Success"
}
```

---

## 9. เปลี่ยนบทบาทสมาชิก — `PUT /members/:id/role` (Admin)

**ทำอะไร:** ตั้งสมาชิกเป็น `admin` หรือลดกลับเป็น `member` (ใช้เพิ่ม admin) เปลี่ยนของตัวเองไม่ได้ ตรวจ role จากฐานข้อมูลทุกครั้ง จึงมีผลทันที

**Parameter**

| ที่ | ชื่อ | ชนิด | บังคับ | รายละเอียด |
|---|---|---|---|---|
| path | id | integer | ✓ | รหัสสมาชิก |
| body | role | string | ✓ | `member` หรือ `admin` |

**Return:** ข้อมูลสมาชิกล่าสุด + `message: "Update role Success"`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `Update role Success` |
| 400 | id ไม่ใช่ตัวเลข | `id must be a number` |
| 400 | role ผิด | `role must be one of: member, admin` |
| 400 | เปลี่ยนของตัวเอง | `You cannot change your own role` |
| 401 / 403 | ไม่ login / ไม่ใช่ admin | `Please login` / `Admin only` |
| 404 | ไม่พบสมาชิก | `Member not found` |

```bash
curl -X PUT http://localhost:3000/api/members/3/role \
  -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

**ตัวอย่างผลลัพธ์ (200)**
```json
{
  "id": 3, "email": "suda@example.com", "name": "Suda Rakdee", "phone": "0810000003",
  "address": "45 Nimman Rd, Chiang Mai", "image": null, "role": "admin",
  "status": "active", "created_at": "2026-10-28T12:00:00.000Z",
  "message": "Update role Success"
}
```


---

# ส่วนที่ 2 — สินค้า / ซีรีส์ / ตะกร้า / คำสั่งซื้อ

> หมายเหตุ: ทุก response ที่เป็น error มีฟิลด์ `message` อธิบายผลเหมือนส่วนสมาชิก นอกจากนี้ตะกร้า/คำสั่งซื้อมี flag `success` (true/false) เพิ่มมาด้วย
> ตะกร้าคือ order ที่ `status = 'pending'` (มีได้ 1 ตะกร้าต่อสมาชิก) เมื่อ checkout จะเปลี่ยนเป็น `confirmed` และกลายเป็นคำสั่งซื้อ
> ใช้ Cookie/Bearer token แบบเดียวกับส่วนสมาชิก (ดูหัวข้อ "การยืนยันตัวตน")
> เอกสารส่วนนี้เขียนตามโค้ดของ branch `fix/integration` (มี `requireAdmin` ที่ route สินค้า)

## 10. รายการสินค้า — `GET /products`

**ทำอะไร:** ดึงสินค้าที่เปิดขาย (`is_active = true`) พร้อมค้นหา กรอง เรียง และแบ่งหน้า ถ้าเป็น admin ส่ง `?all=true` จะเห็นสินค้าที่ซ่อนด้วย

**Parameter (query string ทั้งหมดไม่บังคับ)**

| ชื่อ | ชนิด | รายละเอียด |
|---|---|---|
| q | string | ค้นหาจากชื่อหรือรหัสสินค้า (ไม่สนตัวพิมพ์) |
| series | integer | กรองตามรหัสซีรีส์ |
| type | string | `blind_box`, `whole_set`, `single` |
| in_stock | string | `true` = เฉพาะที่ stock > 0 |
| sort | string | `newest` (ค่าเริ่มต้น), `oldest`, `price_asc`, `price_desc`, `name` |
| page | integer | หน้าที่ (เริ่ม 1) |
| limit | integer | จำนวนต่อหน้า (ค่าเริ่มต้น 50, สูงสุด 100) |
| all | string | `true` + เป็น admin = รวมสินค้าที่ซ่อน |

**Return:** `{ page, limit, total, totalPages, data: [สินค้า] }`

| Status | เมื่อไหร่ | ข้อความ |
|---|---|---|
| 200 | สำเร็จ | |
| 400 | `type` ผิด | `{ "message": "type must be one of: blind_box, whole_set, single" }` |
| 400 | `sort` ผิด | `{ "message": "sort must be one of: ..." }` |
| 400 | `series` ไม่ใช่ตัวเลข | `{ "message": "series must be a series id (number)" }` |

```bash
curl "http://localhost:3000/api/products?type=blind_box&sort=price_asc&limit=2"
```

**ตัวอย่างผลลัพธ์ (200)**
```json
{
  "page": 1, "limit": 2, "total": 14, "totalPages": 7,
  "data": [
    { "id": 7, "code": "P007", "name": "Labubu Sweet Macaron Blind Box", "product_type": "blind_box",
      "price": "480.00", "stock": 45, "description": "Sample blind box from the Labubu series",
      "is_active": true, "series_id": 1, "series_name": "Hirono" }
  ]
}
```

---

## 11. รายละเอียดสินค้า — `GET /products/:id`

**ทำอะไร:** ดึงสินค้า 1 รายการ (เฉพาะที่เปิดขาย)

**Parameter:** path `id` (integer, บังคับ)

**Return:** สินค้า (ฟิลด์เหมือนข้อ 10)

| Status | เมื่อไหร่ | ข้อความ |
|---|---|---|
| 200 | สำเร็จ | |
| 400 | id ไม่ใช่ตัวเลข | `{ "message": "id must be a number" }` |
| 404 | ไม่พบ/ถูกซ่อน | `{ "message": "Product not found" }` |

```bash
curl http://localhost:3000/api/products/7
```

---

## 12. เพิ่มสินค้า — `POST /products` (Admin)

**Parameter (JSON body)**

| ชื่อ | ชนิด | บังคับ | รายละเอียด |
|---|---|---|---|
| code | string | ✓ | รหัสสินค้า ต้องไม่ซ้ำ |
| name | string | ✓ | |
| price | number | ✓ | |
| series_id | integer | | |
| product_type | string | | `blind_box` (ค่าเริ่มต้น), `whole_set`, `single` |
| stock | integer | | ค่าเริ่มต้น 0 |
| description | string | | |
| is_active | boolean | | ค่าเริ่มต้น true |

**Return:** `{ message: "ok", data: สินค้าที่สร้าง }`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 201 | สำเร็จ | `ok` |
| 401 / 403 | ไม่ login / ไม่ใช่ admin | `Please login` / `Admin only` |
| 422 | ไม่ส่ง code หรือ name | `ERROR code and name are required` |
| 409 | code ซ้ำ | `ERROR code <code> already exists` |
| 500 | ฐานข้อมูลผิดพลาด | (ข้อความ error) |

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" \
  -d '{"code":"T001","name":"Test Product","series_id":1,"price":199,"stock":10}'
```

---

## 13. แก้ไขสินค้า — `PUT /products/:id` (Admin)

**ทำอะไร:** **แทนที่ทุกช่อง** ของสินค้า จึงต้องส่งครบทุกช่อง (code, name, series_id, product_type, price, stock, description, is_active) ช่องที่ไม่ส่งจะกลายเป็นค่าว่าง

**Return:** body ที่ส่งมา + `updated_at`, `message: "ok"`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `ok` |
| 401 / 403 | ไม่ login / ไม่ใช่ admin | `Please login` / `Admin only` |
| 404 | ไม่พบสินค้า | `ERROR product id <id> not found` |
| 500 | ผิดพลาด (เช่น code ซ้ำ, ข้อมูลผิดชนิด) | (ข้อความ error) |

```bash
curl -X PUT http://localhost:3000/api/products/51 \
  -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" \
  -d '{"code":"T001","name":"Test Product v2","series_id":1,"product_type":"single","price":249,"stock":8,"description":"edited","is_active":true}'
```

---

## 14. ลบสินค้า — `DELETE /products/:id` (Admin)

**ทำอะไร:** ลบสินค้า ถ้าสินค้าเคยถูกสั่งซื้อแล้วลบไม่ได้ ให้ตั้ง `is_active=false` (ซ่อน) ผ่าน `PUT` แทน

| Status | เมื่อไหร่ | message |
|---|---|---|
| 204 | ลบสำเร็จ (ไม่มี body) | |
| 401 / 403 | ไม่ login / ไม่ใช่ admin | `Please login` / `Admin only` |
| 404 | ไม่พบสินค้า | `ERROR product id <id> not found` |
| 409 | เคยถูกสั่งซื้อแล้ว | `ERROR product is used in orders, hide it instead of deleting` |

```bash
curl -X DELETE http://localhost:3000/api/products/51 -H "Authorization: Bearer <admin-token>"
```

---

## 15. เปลี่ยนรูปสินค้า — `POST /products/:id/image` (Admin)

**ทำอะไร:** อัปโหลดรูปแล้วบันทึกทับ `img_pd/<code>.jpg` (หน้าร้านแสดงรูปจากชื่อไฟล์นี้) รับ jpg/png/webp/gif ไม่เกิน 2 MB

**Parameter:** path `id` + `multipart/form-data` field ชื่อ `file`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `File uploaded successfully!` (`upload: true`, `image: "<code>.jpg"`) |
| 400 | ไม่ส่งไฟล์ / ชนิดไฟล์ไม่รองรับ / ใหญ่เกิน 2 MB / id ไม่ใช่ตัวเลข | `ERROR file is required.` ฯลฯ (`upload: false`) |
| 401 / 403 | ไม่ login / ไม่ใช่ admin | `Please login` / `Admin only` |
| 404 | ไม่พบสินค้า | `Product not found` |

```bash
curl -X POST http://localhost:3000/api/products/7/image \
  -H "Authorization: Bearer <admin-token>" -F "file=@./new.jpg"
```

---

## 16. รายการซีรีส์ — `GET /series`

**ทำอะไร:** ดึงซีรีส์ทั้งหมดพร้อมจำนวนสินค้าที่เปิดขายในแต่ละซีรีส์

**Return:** `{ total, data: [{ id, name, product_count }] }` — สถานะ 200

```bash
curl http://localhost:3000/api/series
```
```json
{ "total": 5, "data": [ { "id": 1, "name": "Hirono", "product_count": 14 } ] }
```

---

## 17. ซีรีส์ 1 รายการ — `GET /series/:id`

**Return:** `{ id, name, products: [สินค้าที่เปิดขายในซีรีส์] }`

| Status | เมื่อไหร่ | ข้อความ |
|---|---|---|
| 200 | สำเร็จ | |
| 400 | id ไม่ใช่ตัวเลข | `{ "message": "id must be a number" }` |
| 404 | ไม่พบซีรีส์ | `{ "message": "Series not found" }` |

---

## 18. ดูตะกร้า — `GET /cart`

**ทำอะไร:** ดึงตะกร้า (order สถานะ pending) ของคนที่ login อยู่ พร้อมรายการสินค้าและยอดรวม ถ้าไม่มีตะกร้าจะตอบตะกร้าว่าง

**Return (มีสินค้า):** `cart_id`, `order_no`, `total_amount` (string), `items: [{ item_id, qty, unit_price, product_id, code, name, price, stock }]`

| Status | เมื่อไหร่ | ข้อความ |
|---|---|---|
| 200 | สำเร็จ | ตะกร้าว่าง: `{ "message": "Cart is empty", "data": { "items": [], "total_amount": 0 } }` |
| 401 | ไม่ login | `{ "success": false, "message": "Unauthorized, please login" }` |

```bash
curl http://localhost:3000/api/cart -H "Authorization: Bearer <token>"
```
```json
{
  "cart_id": 21, "order_no": "202610300021", "total_amount": "960.00",
  "items": [ { "item_id": 40, "qty": 2, "unit_price": "480.00", "product_id": 7,
               "code": "P007", "name": "Labubu Sweet Macaron Blind Box", "price": "480.00", "stock": 45 } ]
}
```

---

## 19. เพิ่มสินค้าลงตะกร้า — `POST /cart`

**ทำอะไร:** เพิ่มสินค้าลงตะกร้า ถ้ายังไม่มีตะกร้าจะสร้างให้ ถ้ามีสินค้านี้อยู่แล้วจะ **บวกจำนวนเพิ่ม** ราคาต่อชิ้น (`unit_price`) บันทึกตามราคา ณ ตอนที่กดเพิ่ม และคำนวณยอดรวมใหม่

**Parameter (JSON body)**

| ชื่อ | ชนิด | บังคับ | รายละเอียด |
|---|---|---|---|
| product_id | integer | ✓ | สินค้าต้องเปิดขายอยู่ |
| qty | integer | ✓ | มากกว่า 0 |

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `Product added to cart successfully` |
| 400 | ไม่ส่ง/ส่ง qty ไม่ถูกต้อง | `Invalid product_id or quantity` |
| 401 | ไม่ login | `Unauthorized, please login` |
| 404 | ไม่พบสินค้าหรือถูกซ่อน | `Product not found or inactive` |
| 500 | ผิดพลาด | `Server error` |

```bash
curl -X POST http://localhost:3000/api/cart \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"product_id":7,"qty":2}'
```
```json
{ "success": true, "message": "Product added to cart successfully" }
```

---

## 20. ลบสินค้าออกจากตะกร้า — `DELETE /cart/items/:itemId`

**ทำอะไร:** ลบรายการหนึ่งออกจากตะกร้า (`itemId` คือ `item_id` จากข้อ 18 ไม่ใช่ product_id) ถ้าลบแล้วตะกร้าว่างจะลบตะกร้าทิ้งด้วย ลบได้เฉพาะของตะกร้าตัวเองที่ยังเป็น pending

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `Item removed from cart successfully` หรือ `Item removed. Cart is now empty and has been deleted.` |
| 401 | ไม่ login | `Unauthorized, please login` |
| 404 | ไม่พบรายการ/ไม่ใช่ของตัวเอง | `Item not found in pending cart` |

```bash
curl -X DELETE http://localhost:3000/api/cart/items/40 -H "Authorization: Bearer <token>"
```

---

## 21. ล้างตะกร้า — `DELETE /cart`

**ทำอะไร:** ลบสินค้าทั้งหมดและลบตะกร้า (ตอนนี้หน้าเว็บยังไม่ได้เรียก — ใช้ลบทีละรายการผ่านข้อ 20)

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `Cart cleared successfully` |
| 401 | ไม่ login | `Unauthorized, please login` |
| 404 | ไม่มีตะกร้า | `No active cart found for this member` |

---

## 22. ยืนยันสั่งซื้อ — `POST /cart/checkout`

**ทำอะไร:** ทำเป็น transaction เดียว: ล็อกตะกร้า → ตรวจสต็อกทุกรายการ → ตัดสต็อก → เปลี่ยนสถานะเป็น `confirmed` พร้อมบันทึก `confirmed_at` ถ้าสต็อกชิ้นใดไม่พอจะ rollback ทั้งหมด ไม่ตัดสต็อกเลย ไม่ต้องส่ง body

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | `Checkout successful and stock updated.` + `data` |
| 400 | ตะกร้าไม่มีสินค้า | `Cannot checkout an empty cart` |
| 400 | สต็อกไม่พอ | `Product ID <id> is out of stock or insufficient quantity.` |
| 401 | ไม่ login | `Unauthorized, please login` |
| 404 | ไม่มีตะกร้า | `No active pending cart found` |

```bash
curl -X POST http://localhost:3000/api/cart/checkout -H "Authorization: Bearer <token>"
```
```json
{
  "success": true, "message": "Checkout successful and stock updated.",
  "data": { "id": 21, "order_no": "202610300021", "member_id": 2, "status": "confirmed",
            "total_amount": "960.00", "created_at": "2026-10-30T10:00:00.000Z", "confirmed_at": "2026-10-30T10:05:00.000Z" }
}
```

---

## 23. ประวัติคำสั่งซื้อ — `GET /orders`

**ทำอะไร:** member เห็นเฉพาะ order ของตัวเอง (รวมตะกร้า pending) ส่วน admin เห็นของทุกคน หรือกรองคนเดียวด้วย `?target_member_id=`

**Parameter:** query `target_member_id` (integer, ไม่บังคับ, ใช้ได้เฉพาะ admin — member ส่งมาก็ถูกละเลย)

**Return:** `{ success, role, count, data: [order + member_name, member_email] }`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | |
| 401 | ไม่ login | `Unauthorized, please login` |
| 404 | ไม่พบสมาชิก | `Member not found` |

```bash
curl "http://localhost:3000/api/orders?target_member_id=2" -H "Authorization: Bearer <admin-token>"
```

---

## 24. รายละเอียดคำสั่งซื้อ — `GET /orders/:orderId`

**ทำอะไร:** ดูหัว order พร้อมรายการสินค้า ดูได้เฉพาะเจ้าของหรือ admin

**Return:** `{ success, data: { order_id, order_no, member_id, member_name, member_email, status, total_amount, created_at, confirmed_at, items: [...] } }`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | |
| 401 | ไม่ login | `Unauthorized, please login` |
| 403 | ไม่ใช่เจ้าของและไม่ใช่ admin | `Access denied. You can only view your own orders.` |
| 404 | ไม่พบ order | `Order not found` |

---

## 25. ประวัติของสมาชิกคนหนึ่ง — `GET /orders/member/:memberId`

**ทำอะไร:** คล้ายข้อ 23 แต่ระบุสมาชิกใน path และตอบ `member_info` (id, name, email, phone) มาด้วย ตอนนี้หน้าเว็บใช้ข้อ 23 แทน endpoint นี้จึงยังไม่มีหน้าไหนเรียก

**Return:** `{ success, member_info, total_orders, data: [order] }`

| Status | เมื่อไหร่ | message |
|---|---|---|
| 200 | สำเร็จ | |
| 401 | ไม่ login | `Unauthorized, please login` |
| 403 | ดูของคนอื่นโดยไม่ใช่ admin | `Access denied. You can only view your own order history.` |
| 404 | ไม่พบสมาชิก | `Target member not found` |
