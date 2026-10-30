// api.js : ตัวช่วยเรียก Backend (REST API) ให้ทุกหน้าใช้ร่วมกัน

// ที่อยู่ของ Backend (เปลี่ยนได้ผ่าน VITE_API_URL ในไฟล์ .env ของ frontend)
// ถ้าไม่ได้ตั้งค่า จะใช้ http://localhost:3000
export const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// เรียก Backend แบบ JSON โดยส่ง/รับ Cookie (token) ไปด้วย
//   path   : เส้นทางของ API เช่น '/api/members/login'
//   method : 'GET' (ค่าเริ่มต้น), 'POST', 'PUT', ...
//   body   : ข้อมูลที่จะส่ง (Object) ถ้าไม่ส่งก็ไม่ต้องใส่
// คืนค่าเป็น Object ที่ Backend ตอบกลับ (มี message เสมอ)
export async function callApi(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    // ถ้ามีข้อมูลส่งไปด้วย ต้องบอก Backend ว่าเป็น JSON
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include', // ต้องมี ไม่งั้น Cookie token จะไม่ถูกส่ง/เก็บ (ข้าม origin ระหว่าง 5173 กับ 3000)
    body: body ? JSON.stringify(body) : undefined
  })
  // Backend ตอบเป็น JSON เสมอ (มี message ทั้งกรณีสำเร็จและผิดพลาด)
  // จึงอ่าน JSON ทุกครั้ง แล้วให้หน้าที่เรียกเช็คจาก login/regist/update/upload ใน body
  return res.json()
}
