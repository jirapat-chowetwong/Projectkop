// memberRoute.js : กำหนดว่า URL ไหน (และ Method อะไร) ให้ไปทำงานที่ฟังก์ชันไหนใน memberController
// ใน index.js ต่อ router นี้ไว้ใต้ /api/ ดังนั้น URL เต็มคือ /api/members...
import express from "express"
import * as memberC from "../controllers/memberController.js"

const router = express.Router()

// ---- Public / ตรวจ Token ในฟังก์ชันเอง ----
router.get('/members/detail', memberC.getMember)      // ทำงานเมื่อได้รับ GET Request /members/detail (ดูข้อมูลตัวเอง)
router.get('/members/logout', memberC.logoutMember)   // ทำงานเมื่อได้รับ GET Request /members/logout (ออกจากระบบ)
router.post('/members', memberC.postMember)           // ทำงานเมื่อได้รับ POST Request /members (สมัครสมาชิก)
router.post('/members/login', memberC.loginMember)    // ทำงานเมื่อได้รับ POST Request /members/login (เข้าสู่ระบบ)

// ---- ต้อง login (Member+Admin) ----
router.put('/members', memberC.putMember)             // ทำงานเมื่อได้รับ PUT Request /members (แก้ไขข้อมูลส่วนตัว)
router.post('/members/uploadimg', memberC.uploadMember) // ทำงานเมื่อได้รับ POST Request /members/uploadimg (อัปโหลดรูปโปรไฟล์)
router.get('/members/addresses', memberC.getAddresses)          // รายการที่อยู่จัดส่งเพิ่มเติมของตัวเอง
router.post('/members/addresses', memberC.postAddress)          // เพิ่มที่อยู่จัดส่ง
router.put('/members/addresses/:id', memberC.putAddress)        // แก้ไขที่อยู่จัดส่ง
router.delete('/members/addresses/:id', memberC.deleteAddress)  // ลบที่อยู่จัดส่ง

// ---- เฉพาะ Admin (ตรวจสิทธิ์ในแต่ละฟังก์ชัน) ----
// หมายเหตุ: /members/detail และ /members/logout อยู่ก่อน เพื่อไม่ให้ชนกับเส้นทางที่มี :id
router.get('/members', memberC.getAllMember)                  // รายชื่อสมาชิกทั้งหมด
router.put('/members/:id/status', memberC.putMemberStatus)    // เปลี่ยนสถานะ (active / suspended)
router.put('/members/:id/role', memberC.putMemberRole)        // เปลี่ยนบทบาท (member / admin) ใช้เพิ่ม admin

export default router
