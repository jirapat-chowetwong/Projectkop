// ======================================================================
// memberController.js : ระบบสมาชิก (Members / Auth)
//
// ฟังก์ชันในไฟล์นี้
//   postMember       POST /members              สมัครสมาชิก                  (Public)
//   loginMember      POST /members/login        เข้าสู่ระบบ + สร้าง Token    (Public)
//   logoutMember     GET  /members/logout       ออกจากระบบ                   (Public)
//   getMember        GET  /members/detail       ดูข้อมูลตัวเอง               (Member+Admin)
//   putMember        PUT  /members             แก้ไขข้อมูลส่วนตัว           (Member+Admin)
//   uploadMember     POST /members/uploadimg    อัปโหลดรูปโปรไฟล์            (Member+Admin)
//   getAllMember     GET  /members             รายชื่อสมาชิกทั้งหมด         (Admin)
//   putMemberStatus  PUT  /members/:id/status   ระงับ/เปิดใช้งานสมาชิก       (Admin)
//   putMemberRole    PUT  /members/:id/role     ตั้ง/ลดสิทธิ์ admin          (Admin)
//
// หลักการยืนยันตัวตน (Authentication)
//   1. login สำเร็จ --> สร้าง JWT (Token) เก็บไว้ใน Cookie ชื่อ token
//   2. คำขอถัดไป Browser ส่ง Cookie มาเอง --> Backend ตรวจ Token ด้วย jwt.verify
//   3. งานของ Admin ตรวจ role จากฐานข้อมูลซ้ำอีกครั้ง (ไม่เชื่อ role ใน Token)
//
// รูปแบบการตอบกลับ : ตอบ HTTP status ที่ถูกต้อง (200/201/400/401/403/404/409/500)
//   และมีฟิลด์ message ใน body เสมอ บาง endpoint มีฟิลด์บอกผลเพิ่ม (login/regist/update/upload)
// ======================================================================
import database from "../services/db.js"   // Pool ของ PostgreSQL (ใช้ database.query)
import bcrypt from "bcrypt"                // เข้ารหัส/ตรวจรหัสผ่าน
import jwt from "jsonwebtoken"             // สร้าง/ตรวจ Token
import multer from "multer"                // รับไฟล์ที่อัปโหลดมา (multipart/form-data)
import fs from "fs"                        // ทำงานกับไฟล์ (สร้างโฟลเดอร์ / ลบรูปเก่า)
import path from "path"                    // จัดการชื่อ/นามสกุลไฟล์

// ตั้งค่า cookie เดียวกันทุกที่ (ตอน login และตอน logout ต้องใช้ค่าเหมือนกัน)
const cookieOption = {
    httpOnly: true, // ป้องกันการเข้าถึง Token ผ่าน JavaScript (ป้องกัน XSS)
    // secure: false เพราะตอนพัฒนาใช้ http://localhost (ถ้าขึ้นใช้งานจริงด้วย https ให้เปลี่ยนเป็น true)
    // ถ้าตั้ง true Browser บางตัว/บางรุ่นไม่ยอมเก็บหรือไม่ส่ง Cookie ผ่าน http ทำให้ login แล้วไปหน้าต่อไปไม่ได้
    secure: false,
    // 'lax' ส่ง Cookie ได้เมื่อ Frontend (5173) เรียก Backend (3000) บน localhost เหมือนกัน
    // ส่วน 'strict' เข้มงวดกว่า และเคยทำให้ Cookie ไม่ถูกส่งไปกับคำขอ detail
    sameSite: 'lax'
}

// คอลัมน์ที่ส่งกลับให้ Frontend ได้ (ไม่มี password_hash เพื่อไม่ให้ค่า hash หลุดออกไป)
const memberColumns = `id, email, name, phone, address, image, role, status, created_at`

// ----------------------------------------------------------------------
// upload part : ตั้งค่าการอัปโหลดรูปโปรไฟล์ด้วย multer
// ----------------------------------------------------------------------
// 1. กำหนดค่า storage (พื้นที่จัดเก็บไฟล์)
const imgFolder = 'img_mem'                                // โฟลเดอร์เก็บรูป (index.js เปิดให้ดูผ่าน /img_mem)
const imgTypes = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] // นามสกุลไฟล์ที่ยอมรับ
const storage = multer.diskStorage({
    // destination: กำหนดโฟลเดอร์ปลายทางที่จะเก็บไฟล์ (ถ้ายังไม่มีโฟลเดอร์ให้สร้างก่อน)
    destination: function (req, file, cb) {
        fs.mkdirSync(imgFolder, { recursive: true })
        cb(null, imgFolder)
    },
    // filename: ตั้งชื่อไฟล์จาก id สมาชิก (req.user ถูกใส่ไว้ใน uploadMember) + เวลา เพื่อไม่ให้ชื่อซ้ำ
    // ไม่ใช้ชื่อไฟล์ที่ผู้ใช้ส่งมา เพราะอาจเป็นชื่อแปลก ๆ หรือซ้ำกับของคนอื่น
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `member_${req.user.id}_${Date.now()}${ext}`)
    }
})

// 2. การกำหนดค่า uploader รับเฉพาะไฟล์รูปภาพ ขนาดไม่เกิน 2 MB
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB ถ้าเกินจะเกิด Error
    // fileFilter: ตรวจชนิดไฟล์ทั้ง mimetype และนามสกุล (กันการส่งไฟล์อย่าง .php ปลอมเป็นรูป)
    fileFilter: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase()
        if (!file.mimetype.startsWith('image/') || !imgTypes.includes(ext))
            return cb(new Error('Only image files (jpg, png, webp, gif) are allowed'))
        cb(null, true)
    }
}).single('file') // รับไฟล์เดี่ยว และ field name ในฟอร์มต้องชื่อ 'file'

// ----------------------------------------------------------------------
// สมัครสมาชิก : POST /members
// รับ { email, name, password, phone?, address? }
// ----------------------------------------------------------------------
export async function postMember(req, res) {
    console.log(`POST /members is requested.`)
    const bodyData = req.body
    try {
        // ตรวจสอบ email, name และ password
        // name ที่เป็นช่องว่างล้วนถือว่าไม่ได้กรอก
        if (!bodyData.email || !String(bodyData.name || '').trim() || !bodyData.password) {
            return res.status(400).json({ message: `ERROR email, name and password is required.`, regist: false })
        }
        // รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร
        if (String(bodyData.password).length < 8) {
            return res.status(400).json({ message: `ERROR password must be at least 8 characters.`, regist: false })
        }
        // อีเมลไม่สนตัวพิมพ์เล็ก/ใหญ่และตัดช่องว่างหัวท้าย (สมัครด้วย Mali@x.com แล้ว login ด้วย mali@x.com ได้)
        const email = String(bodyData.email).trim().toLowerCase()
        // ตรวจสอบ Unique key ของ email (ใช้ $1 แทนการต่อข้อความ เพื่อป้องกัน SQL Injection)
        const chkRow = await database.query({
            text: `SELECT id FROM members WHERE email = $1`,
            values: [email]
        })
        if (chkRow.rowCount != 0) {
            return res.status(409).json({ message: `ERROR email ${email} is exists.`, regist: false })
        }

        // ระบบเราจะไม่เก็บ Password จะเก็บค่า Hash
        // Hash ผ่าน bcrypt กำหนดค่า salt เพื่อเป็นการ tuning ให้ค่า Hash ต่างกันไป
        const saltround = 11 // จำนวนรอบการ Salt -- ตัวเลขยิ่งมากยิ่งช้า
        const pwdHash = await bcrypt.hash(bodyData.password, saltround)

        // role กับ status ใช้ค่า default ของตาราง (member / active) ไม่รับจาก Frontend
        // เพื่อไม่ให้ใครสมัครแล้วส่ง role: 'admin' มาเป็น admin เองได้
        const result = await database.query({
            text: `INSERT INTO members (email, password_hash, name, phone, address)
                   VALUES ($1,$2,$3,$4,$5)
                   RETURNING id, email, name, phone, address, role, created_at`,
            values: [
                email,
                pwdHash,
                bodyData.name,
                bodyData.phone || null,
                bodyData.address || null
            ]
        })
        // ไม่ส่ง password กลับไป
        res.status(201).json({ ...result.rows[0], message: "Regist Success", regist: true })
    }
    catch (err) {
        return res.status(500).json({ message: err.message, regist: false })
    }
}

// ----------------------------------------------------------------------
// เข้าสู่ระบบ : POST /members/login
// รับ { email, password } สำเร็จจะตั้ง Cookie token และส่ง token กลับมาด้วย
// ----------------------------------------------------------------------
export async function loginMember(req, res) {
    console.log(`POST /members/login is requested.`)
    const bodyData = req.body
    try {
        // ตรวจสอบ email กับ password
        if (!bodyData.email || !bodyData.password) {
            return res.status(400).json({ message: `Email and Password is required`, login: false })
        }
        // ตรวจสอบว่ามี email นี้หรือไม่ (แปลงเป็นตัวพิมพ์เล็กและตัดช่องว่างเหมือนตอนสมัคร)
        const result = await database.query({
            text: `SELECT * FROM members WHERE email = $1`,
            values: [String(bodyData.email).trim().toLowerCase()]
        })
        // ถ้าไม่พบ หรือรหัสผ่านไม่ตรง ตอบข้อความเดียวกัน (ไม่บอกว่าผิดที่ email หรือ password)
        // เพื่อไม่ให้คนภายนอกเดาได้ว่าอีเมลไหนมีอยู่ในระบบ
        if (result.rowCount == 0)
            return res.status(401).json({ message: `Login Fail`, login: false })

        const member = result.rows[0]
        // ถ้าพบนำค่าใน hash ที่ query ได้จาก DB เทียบกับ password ที่ frontend ส่งมา โดยใช้ bcrypt
        const loginOK = await bcrypt.compare(bodyData.password, member.password_hash)
        if (!loginOK) {
            res.clearCookie('token', cookieOption) // ล้าง token เก่า (ถ้ามี)
            return res.status(401).json({ message: `Login Fail`, login: false })
        }
        // บัญชีถูกระงับ (สถานะ suspended) ห้ามเข้าสู่ระบบ
        if (member.status != 'active')
            return res.status(403).json({ message: `This account is suspended`, login: false })

        // ข้อมูลที่เก็บใน Token (ห้ามใส่ข้อมูลลับ เพราะใครก็ถอดอ่านเนื้อหาของ Token ได้)
        const theuser = {
            id: member.id,
            email: member.email,
            name: member.name,
            role: member.role
        }
        // สร้าง Token ลงลายเซ็นด้วย SECRET_KEY ใน .env อายุ 1 ชั่วโมง
        const secretKey = process.env.SECRET_KEY
        const token = jwt.sign(theuser, secretKey, { expiresIn: '1h' })

        // ส่ง Token ไปเก็บไว้ที่ Cookie ของ Browser
        res.cookie('token', token, {
            ...cookieOption,
            maxAge: 3600000 // 3,600,000 ms --> 60 minute --> 1hr
        })
        res.json({ message: "Login Success", login: true, token: token, member: theuser })
    }
    catch (err) {
        return res.status(500).json({ message: err.message, login: false })
    }
}

// ----------------------------------------------------------------------
// ออกจากระบบ : GET /members/logout (ล้าง Cookie token)
// ----------------------------------------------------------------------
export async function logoutMember(req, res) {
    console.log(`GET /members/logout is requested.`)
    try {
        res.clearCookie('token', cookieOption)
        res.json({ message: `Logout Success`, login: false })
    }
    catch (err) {
        return res.status(500).json({ message: err.message })
    }
}

// ----------------------------------------------------------------------
// ดูข้อมูลตัวเอง : GET /members/detail
// Frontend ใช้ตรวจว่า login อยู่หรือไม่ และดึงข้อมูลไปแสดงในหน้า Profile
// ----------------------------------------------------------------------
export async function getMember(req, res) {
    console.log(`GET /members/detail is requested.`)
    // อ่านค่าจาก Cookies ที่ส่งมาจาก Browser --> Frontend --> Backend
    // (ตอนทดสอบด้วย Postman ส่งผ่าน Header Authorization: Bearer <token> ได้ และใช้ Header ก่อน Cookie)
    let token = req.cookies.token
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer '))
        token = auth.slice(7) // ตัดคำว่า "Bearer " (7 ตัวอักษร) ออก เหลือแต่ Token
    if (!token)
        return res.status(401).json({ message: `No member`, login: false })
    try {
        const secret_key = process.env.SECRET_KEY //อ่านค่าจาก ENV
        // ตรวจสอบ + แปลง JWT เพื่ออ่านข้อมูล (ถ้า Token ถูกแก้ไขหรือหมดอายุ จะเกิด Error ไปที่ catch)
        const member = jwt.verify(token, secret_key)
        // อ่านข้อมูลล่าสุดจาก DB (ข้อมูลใน Token อาจเก่า เช่น ชื่อที่เพิ่งแก้ไข)
        const result = await database.query({
            text: `SELECT ${memberColumns} FROM members WHERE id = $1`,
            values: [member.id]
        })
        if (result.rowCount == 0)
            return res.status(401).json({ message: `No member`, login: false })
        // ถ้าถูกระงับหลัง login แล้ว Token เดิมก็ใช้ไม่ได้ทันที
        if (result.rows[0].status != 'active')
            return res.status(403).json({ message: `This account is suspended`, login: false })
        return res.json({ ...result.rows[0], login: true })
    }
    catch (err) {
        console.log(err.message)
        // ถ้ามีการเปลี่ยนแปลง Token/Signature ไม่ถูกต้อง หรือ Token หมดอายุ จะเกิด Error ชื่อ ...Token...Error
        // ส่วน Error อื่น (เช่น ฐานข้อมูลล่ม) ตอบ 500
        if (err.name.includes('Token'))
            return res.status(401).json({ message: `The information was falsified.`, login: false })
        return res.status(500).json({ message: err.message, login: false })
    }
}

// ----------------------------------------------------------------------
// แก้ไขข้อมูลส่วนตัวของตัวเอง : PUT /members
// แก้ได้เฉพาะ name, phone, address (email และ role แก้ไม่ได้)
// ----------------------------------------------------------------------
export async function putMember(req, res) {
    console.log(`PUT /members is requested.`)
    const bodyData = req.body
    // อ่าน Token (Cookie หรือ Header Bearer) เหมือน getMember
    let token = req.cookies.token
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer '))
        token = auth.slice(7)
    if (!token)
        return res.status(401).json({ message: `Please login`, login: false, update: false })
    try {
        const member = jwt.verify(token, process.env.SECRET_KEY)

        // ต้องส่งมาอย่างน้อย 1 ฟิลด์
        if (bodyData.name === undefined && bodyData.phone === undefined && bodyData.address === undefined)
            return res.status(400).json({ message: `ERROR name, phone or address is required.`, update: false })

        // ดึงข้อมูลเดิมมาก่อน เพื่อใช้เป็นค่าของฟิลด์ที่ไม่ได้ส่งมา
        const old = await database.query({
            text: `SELECT ${memberColumns} FROM members WHERE id = $1`,
            values: [member.id]
        })
        if (old.rowCount == 0)
            return res.status(404).json({ message: `Member not found`, update: false })

        // ค่าที่ไม่ได้ส่งมา ใช้ค่าเดิม / ส่งค่าว่างมา = ลบค่านั้น (เก็บเป็น null)
        const name = bodyData.name === undefined ? old.rows[0].name : String(bodyData.name).trim()
        const phone = bodyData.phone === undefined ? old.rows[0].phone : (String(bodyData.phone).trim() || null)
        const address = bodyData.address === undefined ? old.rows[0].address : (String(bodyData.address).trim() || null)

        // ตรวจความยาวให้ตรงกับขนาดคอลัมน์ในตาราง (name 100 / phone 20)
        if (!name || name.length > 100)
            return res.status(400).json({ message: `ERROR name is required (max 100 characters).`, update: false })
        if (phone && phone.length > 20)
            return res.status(400).json({ message: `ERROR phone is too long (max 20 characters).`, update: false })

        // แก้ไขเฉพาะแถวของตัวเอง (id มาจาก Token ไม่ได้มาจาก Frontend จึงแก้ของคนอื่นไม่ได้)
        const result = await database.query({
            text: `UPDATE members SET name = $1, phone = $2, address = $3, updated_at = now()
                   WHERE id = $4
                   RETURNING ${memberColumns}`,
            values: [name, phone, address, member.id]
        })
        res.json({ ...result.rows[0], message: "Update Success", update: true })
    }
    catch (err) {
        console.log(err.message)
        if (err.name.includes('Token'))
            return res.status(401).json({ message: `The information was falsified.`, login: false, update: false })
        return res.status(500).json({ message: err.message, update: false })
    }
}

// ----------------------------------------------------------------------
// อัปโหลดรูปโปรไฟล์ของตัวเอง : POST /members/uploadimg
// ส่งแบบ multipart/form-data ชื่อ field ต้องเป็น 'file'
// ----------------------------------------------------------------------
// 3.Method ให้ Frontend เรียกใช้
export async function uploadMember(req, res) {
    console.log('POST /members/uploadimg is requested.')
    let token = req.cookies.token
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer '))
        token = auth.slice(7)
    if (!token)
        return res.status(401).json({ message: `Please login`, login: false, upload: false })
    try {
        // เก็บข้อมูลสมาชิกไว้ที่ req.user เพื่อให้ multer ใช้ตั้งชื่อไฟล์
        // (ต้องตรวจ Token ก่อนเรียก upload เพื่อไม่ให้คนที่ยังไม่ login อัปโหลดไฟล์ลงเซิร์ฟเวอร์ได้)
        req.user = jwt.verify(token, process.env.SECRET_KEY)
    }
    catch (err) {
        console.log(err.message)
        return res.status(401).json({ message: `The information was falsified.`, login: false, upload: false })
    }
    // เรียก multer รับไฟล์ ถ้าไฟล์ไม่ผ่านเงื่อนไข (ไม่ใช่รูป/ใหญ่เกิน) จะส่ง err เข้ามาที่นี่
    upload(req, res, async (err) => {
        if (err)
            return res.status(400).json({ message: err.message, upload: false })
        if (!req.file)
            return res.status(400).json({ message: `ERROR file is required.`, upload: false })
        try {
            // อ่านชื่อรูปเก่าก่อน เพื่อลบทิ้งหลังบันทึกรูปใหม่สำเร็จ
            const old = await database.query({
                text: `SELECT image FROM members WHERE id = $1`,
                values: [req.user.id]
            })
            // บันทึกชื่อไฟล์รูปใหม่ลงฐานข้อมูล
            await database.query({
                text: `UPDATE members SET image = $1, updated_at = now() WHERE id = $2`,
                values: [req.file.filename, req.user.id]
            })
            // ลบรูปเก่าของสมาชิกคนนี้ (ใช้เฉพาะชื่อไฟล์ ป้องกันการอ้าง path อื่น)
            const oldImage = old.rows[0] && old.rows[0].image
            if (oldImage) {
                const oldPath = path.join(imgFolder, path.basename(oldImage))
                fs.rm(oldPath, { force: true }, () => { })
            }
            res.json({ message: 'File uploaded successfully!', upload: true, image: req.file.filename })
        }
        catch (e) {
            res.status(500).json({ message: e.message, upload: false })
        }
    })
}

// ----------------------------------------------------------------------
// [Admin] แสดงรายชื่อสมาชิกทั้งหมด : GET /members
// ค้นหาด้วย ?q= (ชื่อหรืออีเมล) และกรองด้วย ?role= ?status=
// ----------------------------------------------------------------------
export async function getAllMember(req, res) {
    console.log(`GET /members is requested.`)
    let token = req.cookies.token
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer '))
        token = auth.slice(7)
    if (!token)
        return res.status(401).json({ message: `Please login`, login: false })
    try {
        const member = jwt.verify(token, process.env.SECRET_KEY)
        // ตรวจ role และ status ล่าสุดจาก DB (ไม่เชื่อ role ใน Token) เพื่อให้การลดสิทธิ์/ระงับบัญชีมีผลทันที
        const admin = await database.query({
            text: `SELECT role, status FROM members WHERE id = $1`,
            values: [member.id]
        })
        if (admin.rowCount == 0 || admin.rows[0].role != 'admin' || admin.rows[0].status != 'active')
            return res.status(403).json({ message: `Admin only` })

        // ตรวจค่าที่ใช้กรองให้อยู่ในรายการที่กำหนด
        const { q, role, status } = req.query
        if (role && !['member', 'admin'].includes(role))
            return res.status(400).json({ message: `role must be member or admin` })
        if (status && !['active', 'suspended'].includes(status))
            return res.status(400).json({ message: `status must be active or suspended` })

        // ประกอบเงื่อนไข WHERE ตามที่ส่งมา ค่าทุกตัวส่งผ่าน $1,$2,... ไม่ต่อข้อความตรง ๆ (กัน SQL Injection)
        const where = []
        const values = []
        if (q) {
            values.push(`%${q}%`)
            where.push(`(email ILIKE $${values.length} OR name ILIKE $${values.length})`) // ILIKE = ไม่สนตัวพิมพ์เล็ก/ใหญ่
        }
        if (role) {
            values.push(role)
            where.push(`role = $${values.length}`)
        }
        if (status) {
            values.push(status)
            where.push(`status = $${values.length}`)
        }
        const result = await database.query({
            text: `SELECT ${memberColumns} FROM members
                   ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                   ORDER BY id`,
            values: values
        })
        res.json({ total: result.rowCount, data: result.rows })
    }
    catch (err) {
        console.log(err.message)
        if (err.name.includes('Token'))
            return res.status(401).json({ message: `The information was falsified.`, login: false })
        return res.status(500).json({ message: err.message })
    }
}

// ----------------------------------------------------------------------
// [Admin] เปลี่ยนสถานะสมาชิก : PUT /members/:id/status
// รับ { status: 'active' | 'suspended' } สมาชิกที่ถูกระงับจะ login ไม่ได้
// ----------------------------------------------------------------------
export async function putMemberStatus(req, res) {
    console.log(`PUT /members/${req.params.id}/status is requested.`)
    let token = req.cookies.token
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer '))
        token = auth.slice(7)
    if (!token)
        return res.status(401).json({ message: `Please login`, login: false })
    try {
        const member = jwt.verify(token, process.env.SECRET_KEY)
        // ตรวจว่าเป็น admin จาก DB
        const admin = await database.query({
            text: `SELECT role, status FROM members WHERE id = $1`,
            values: [member.id]
        })
        if (admin.rowCount == 0 || admin.rows[0].role != 'admin' || admin.rows[0].status != 'active')
            return res.status(403).json({ message: `Admin only` })

        // ตรวจ id ใน URL ต้องเป็นตัวเลข และค่า status ต้องอยู่ในรายการที่กำหนด
        if (!/^\d+$/.test(req.params.id))
            return res.status(400).json({ message: `id must be a number` })
        const id = Number(req.params.id)
        const status = req.body.status
        if (!['active', 'suspended'].includes(status))
            return res.status(400).json({ message: `status must be one of: active, suspended` })
        // กันไม่ให้ admin ระงับตัวเอง
        if (id == member.id)
            return res.status(400).json({ message: `You cannot change your own status` })

        const result = await database.query({
            text: `UPDATE members SET status = $1, updated_at = now()
                   WHERE id = $2
                   RETURNING ${memberColumns}`,
            values: [status, id]
        })
        // ไม่มีแถวที่ถูกแก้ไข = ไม่มีสมาชิก id นี้
        if (result.rowCount == 0)
            return res.status(404).json({ message: `Member not found` })
        res.json({ ...result.rows[0], message: `Update status Success` })
    }
    catch (err) {
        console.log(err.message)
        if (err.name.includes('Token'))
            return res.status(401).json({ message: `The information was falsified.`, login: false })
        return res.status(500).json({ message: err.message })
    }
}

// ----------------------------------------------------------------------
// [Admin] เปลี่ยนบทบาทสมาชิก : PUT /members/:id/role
// รับ { role: 'member' | 'admin' } ใช้เพิ่ม admin หรือลดกลับเป็น member
// ----------------------------------------------------------------------
export async function putMemberRole(req, res) {
    console.log(`PUT /members/${req.params.id}/role is requested.`)
    let token = req.cookies.token
    const auth = req.headers.authorization
    if (auth && auth.startsWith('Bearer '))
        token = auth.slice(7)
    if (!token)
        return res.status(401).json({ message: `Please login`, login: false })
    try {
        const member = jwt.verify(token, process.env.SECRET_KEY)
        // ตรวจว่าเป็น admin จาก DB
        const admin = await database.query({
            text: `SELECT role, status FROM members WHERE id = $1`,
            values: [member.id]
        })
        if (admin.rowCount == 0 || admin.rows[0].role != 'admin' || admin.rows[0].status != 'active')
            return res.status(403).json({ message: `Admin only` })

        // ตรวจ id ใน URL ต้องเป็นตัวเลข และค่า role ต้องอยู่ในรายการที่กำหนด
        if (!/^\d+$/.test(req.params.id))
            return res.status(400).json({ message: `id must be a number` })
        const id = Number(req.params.id)
        const role = req.body.role
        if (!['member', 'admin'].includes(role))
            return res.status(400).json({ message: `role must be one of: member, admin` })
        // กันไม่ให้ admin ลดสิทธิ์ตัวเอง (ไม่งั้นอาจไม่เหลือ admin ในระบบ)
        if (id == member.id)
            return res.status(400).json({ message: `You cannot change your own role` })

        const result = await database.query({
            text: `UPDATE members SET role = $1, updated_at = now()
                   WHERE id = $2
                   RETURNING ${memberColumns}`,
            values: [role, id]
        })
        if (result.rowCount == 0)
            return res.status(404).json({ message: `Member not found` })
        res.json({ ...result.rows[0], message: `Update role Success` })
    }
    catch (err) {
        console.log(err.message)
        if (err.name.includes('Token'))
            return res.status(401).json({ message: `The information was falsified.`, login: false })
        return res.status(500).json({ message: err.message })
    }
}

// ----------------------------------------------------------------------
// ที่อยู่จัดส่งเพิ่มเติม (นอกจากที่อยู่หลักใน members.address) : ใช้ได้เฉพาะเจ้าของบัญชี
//   GET    /members/addresses       รายการที่อยู่เพิ่มเติมของตัวเอง
//   POST   /members/addresses       เพิ่มที่อยู่ { address }
//   PUT    /members/addresses/:id   แก้ไขที่อยู่ { address }
//   DELETE /members/addresses/:id   ลบที่อยู่
// ใช้ req.user ที่ readToken (index.js) ใส่ไว้ให้ ถ้าไม่ได้ login ตอบ 401
// ----------------------------------------------------------------------
const maxAddresses = 10    // จำกัดจำนวนที่อยู่เพิ่มเติมต่อสมาชิก
const maxAddressLen = 500  // ความยาวสูงสุดของที่อยู่ 1 รายการ

export async function getAddresses(req, res) {
    console.log(`GET /members/addresses is requested.`)
    if (!req.user)
        return res.status(401).json({ message: `Please login`, ok: false })
    try {
        const result = await database.query({
            text: `SELECT id, address, created_at FROM member_addresses WHERE member_id = $1 ORDER BY id`,
            values: [req.user.id]
        })
        res.json({ message: `Get addresses Success`, ok: true, addresses: result.rows })
    }
    catch (err) {
        return res.status(500).json({ message: err.message, ok: false })
    }
}

export async function postAddress(req, res) {
    console.log(`POST /members/addresses is requested.`)
    if (!req.user)
        return res.status(401).json({ message: `Please login`, ok: false })
    const address = String(req.body.address || '').trim()
    if (!address)
        return res.status(400).json({ message: `ERROR address is required.`, ok: false })
    if (address.length > maxAddressLen)
        return res.status(400).json({ message: `ERROR address must be at most ${maxAddressLen} characters.`, ok: false })
    try {
        const count = await database.query({
            text: `SELECT count(*)::int AS n FROM member_addresses WHERE member_id = $1`,
            values: [req.user.id]
        })
        if (count.rows[0].n >= maxAddresses)
            return res.status(400).json({ message: `ERROR you can add at most ${maxAddresses} extra addresses.`, ok: false })
        const result = await database.query({
            text: `INSERT INTO member_addresses (member_id, address) VALUES ($1, $2) RETURNING id, address, created_at`,
            values: [req.user.id, address]
        })
        res.status(201).json({ message: `Add address Success`, ok: true, address: result.rows[0] })
    }
    catch (err) {
        return res.status(500).json({ message: err.message, ok: false })
    }
}

export async function putAddress(req, res) {
    console.log(`PUT /members/addresses/${req.params.id} is requested.`)
    if (!req.user)
        return res.status(401).json({ message: `Please login`, ok: false })
    if (!/^\d+$/.test(req.params.id))
        return res.status(400).json({ message: `id must be a number`, ok: false })
    const address = String(req.body.address || '').trim()
    if (!address)
        return res.status(400).json({ message: `ERROR address is required.`, ok: false })
    if (address.length > maxAddressLen)
        return res.status(400).json({ message: `ERROR address must be at most ${maxAddressLen} characters.`, ok: false })
    try {
        // เงื่อนไข member_id ทำให้แก้ได้เฉพาะที่อยู่ของตัวเอง
        const result = await database.query({
            text: `UPDATE member_addresses SET address = $1
                   WHERE id = $2 AND member_id = $3
                   RETURNING id, address, created_at`,
            values: [address, Number(req.params.id), req.user.id]
        })
        if (result.rowCount == 0)
            return res.status(404).json({ message: `Address not found`, ok: false })
        res.json({ message: `Update address Success`, ok: true, address: result.rows[0] })
    }
    catch (err) {
        return res.status(500).json({ message: err.message, ok: false })
    }
}

export async function deleteAddress(req, res) {
    console.log(`DELETE /members/addresses/${req.params.id} is requested.`)
    if (!req.user)
        return res.status(401).json({ message: `Please login`, ok: false })
    if (!/^\d+$/.test(req.params.id))
        return res.status(400).json({ message: `id must be a number`, ok: false })
    try {
        const result = await database.query({
            text: `DELETE FROM member_addresses WHERE id = $1 AND member_id = $2`,
            values: [Number(req.params.id), req.user.id]
        })
        if (result.rowCount == 0)
            return res.status(404).json({ message: `Address not found`, ok: false })
        res.json({ message: `Delete address Success`, ok: true })
    }
    catch (err) {
        return res.status(500).json({ message: err.message, ok: false })
    }
}
