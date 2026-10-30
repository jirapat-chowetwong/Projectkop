<template>
    <!-- PROFILE -->
  <div class="profile">
    <aside class="pside">
      <!-- ถ้ามีรูปโปรไฟล์ใช้รูปจาก Backend ถ้ายังไม่มีแสดงอีโมจิแทน -->
      <img v-if="imgUrl" :src="imgUrl" class="av" style="object-fit:cover" alt="รูปโปรไฟล์">
      <div v-else class="av">🐰</div>
      <h3 style="margin:4px 0">{{user.name}}</h3><div style="color:var(--mute);margin-bottom:20px">{{user.email}}</div>
      <button class="it" v-for="m in menu" :key="m" :class="{on:m===menuSel}" @click="menuSel=m">{{m}}</button>
      <!-- ปุ่มนี้แสดงเฉพาะ admin (Backend ตรวจสิทธิ์ซ้ำอีกชั้นเสมอ) -->
      <button class="it" v-if="user.role==='admin'" style="background:var(--pink-l);font-weight:700" @click="router.push('/admin/members')">จัดการสมาชิก (Admin)</button>
      <button class="it" style="background:var(--card);text-align:center;font-weight:700;margin-top:30px" @click="logout">ออกจากระบบ</button></aside>
    <div>
      <div class="pmain"><h2 style="margin-top:0">ข้อมูลส่วนตัว</h2>
        <div class="form"><div>
          <!-- ช่องกรอกผูกกับ form (สำเนาข้อมูล) และแก้ไขได้เมื่อกด "แก้ไขข้อมูล" (edit = true) เท่านั้น -->
          <label>ชื่อ-นามสกุล</label><input v-model="form.name" :disabled="!edit">
          <label>อีเมล (แก้ไขไม่ได้)</label><input :value="user.email" type="email" disabled>
          <label>เบอร์โทรศัพท์</label><input v-model="form.phone" :disabled="!edit">
          <label>ที่อยู่</label><input v-model="form.address" :disabled="!edit">
          <p style="color:#c02a54" v-if="error">{{error}}</p>
          <p><button class="btn" @click="onEditSave">{{edit?'บันทึกข้อมูล':'แก้ไขข้อมูล'}}</button>
             <button class="btn ghost" v-if="edit" style="margin-left:8px" @click="cancelEdit">ยกเลิก</button></p></div>
          <div class="pic">
            <img v-if="imgUrl" :src="imgUrl" class="av" style="object-fit:cover" alt="รูปโปรไฟล์">
            <div v-else class="av">🐰</div>
            <b>เปลี่ยนรูปโปรไฟล์</b>
            <!-- เลือกไฟล์รูปแล้วกดอัปโหลด (ปุ่มกดไม่ได้จนกว่าจะเลือกไฟล์) -->
            <p><input type="file" accept="image/*" @change="onFile" style="width:100%"></p>
            <p><button class="btn" :disabled="!file || uploading" @click="uploadImage">{{uploading?'กำลังอัปโหลด...':'อัปโหลดรูป'}}</button></p>
            <small>ไฟล์ jpg, png, webp, gif ขนาดไม่เกิน 2 MB</small>
          </div></div></div>
      <h2>ที่อยู่จัดส่ง</h2>
      <div class="addr"><div><span>👤 {{user.address || 'ยังไม่ได้ระบุที่อยู่'}}</span><button class="btn ghost" style="padding:6px 14px" @click="edit=true">แก้ไข</button></div>
        <div style="justify-content:center;cursor:pointer" @click="toast('เพิ่มที่อยู่ใหม่ (เดโม)')">＋ เพิ่มที่อยู่ใหม่</div></div>
      <h2>ประวัติการสั่งซื้อ</h2>
      <div style="overflow-x:auto"><table><tr><th>เลขที่คำสั่งซื้อ</th><th>วันที่สั่งซื้อ</th><th>ยอดรวม</th><th>สถานะ</th></tr>
        <tr v-for="o in orders" :key="o.id"><td>{{o.id}}</td><td>{{o.date}}</td><td>฿ {{fmt(o.total)}}</td><td><span class="st" :class="o.cls">{{o.st}}</span></td></tr></table></div>
    </div>
  </div>
</template>

<script setup>
// หน้า Profile : แสดง/แก้ไขข้อมูลสมาชิกที่ login อยู่ และอัปโหลดรูปโปรไฟล์
//   GET  /api/members/detail     โหลดข้อมูลตัวเอง (ถ้าไม่ได้ login ให้กลับไปหน้า Login)
//   PUT  /api/members            บันทึกชื่อ เบอร์ ที่อยู่
//   POST /api/members/uploadimg  อัปโหลดรูป
//   GET  /api/members/logout     ออกจากระบบ
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API, callApi } from '../api.js'

const router = useRouter()

const edit = ref(false)                 // true = อยู่ในโหมดแก้ไข
const menuSel = ref('ข้อมูลส่วนตัว')
const menu = ['ข้อมูลส่วนตัว','ที่อยู่จัดส่ง','ประวัติการสั่งซื้อ','รายการโปรด']

// ข้อมูลสมาชิกจาก Backend และข้อมูลในฟอร์มแก้ไข
const user = ref({ name: '', email: '', phone: '', address: '', image: null, role: 'member' })
const form = ref({ name: '', phone: '', address: '' }) // สำเนาที่แก้ไขในฟอร์ม (ยกเลิกแล้วกลับไปค่าใน user)
const error = ref('')                   // ข้อความผิดพลาดใต้ฟอร์ม
const file = ref(null)                  // ไฟล์รูปที่เลือก
const uploading = ref(false)            // true ระหว่างอัปโหลด

// ที่อยู่รูปโปรไฟล์ (Backend เก็บไฟล์ไว้ที่ /img_mem) ถ้ายังไม่มีรูปให้เป็นค่าว่าง
const imgUrl = computed(() => user.value.image ? `${API}/img_mem/${user.value.image}` : '')

// คัดลอกข้อมูลจาก user ลงฟอร์ม
const fillForm = () => {
  form.value = { name: user.value.name, phone: user.value.phone || '', address: user.value.address || '' }
}

// โหลดข้อมูลสมาชิกที่ล็อกอินอยู่ตอนเปิดหน้า ถ้าไม่ได้ล็อกอินให้กลับไปหน้า Login
onMounted(async () => {
  try {
    const data = await callApi('/api/members/detail')
    if (!data.login) {
      localStorage.removeItem('isLoggedIn')
      router.push('/login')
      return
    }
    user.value = data
    fillForm()
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
})

// ปุ่ม แก้ไขข้อมูล / บันทึกข้อมูล (ปุ่มเดียวใช้สองหน้าที่)
const onEditSave = async () => {
  // กดครั้งแรก : เข้าโหมดแก้ไข
  if (!edit.value) {
    edit.value = true
    return
  }
  // กดครั้งที่สอง : บันทึก
  error.value = ''
  if (!form.value.name.trim()) {
    error.value = 'กรอกชื่อ-นามสกุล'
    return
  }
  try {
    // PUT /api/members (Backend รู้ว่าเป็นใครจาก Cookie ไม่ต้องส่ง id)
    const data = await callApi('/api/members', 'PUT', form.value)
    if (!data.update) {
      error.value = data.message
      return
    }
    user.value = data   // ใช้ข้อมูลล่าสุดที่ Backend ส่งกลับมา
    fillForm()
    edit.value = false
    toast('บันทึกข้อมูลแล้ว')
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
}

// ยกเลิกการแก้ไข : คืนค่าเดิมในฟอร์ม
const cancelEdit = () => {
  fillForm()
  error.value = ''
  edit.value = false
}

// เลือกไฟล์รูป แล้วอัปโหลด (POST /api/members/uploadimg ส่งแบบ FormData ชื่อ field = file)
const onFile = (e) => {
  file.value = e.target.files[0] || null
}

const uploadImage = async () => {
  error.value = ''
  uploading.value = true
  try {
    // ส่งไฟล์ต้องใช้ FormData (ไม่ใช่ JSON) จึงไม่ใช้ callApi และไม่ต้องตั้ง Content-Type เอง (Browser ใส่ให้)
    const fd = new FormData()
    fd.append('file', file.value)
    const res = await fetch(API + '/api/members/uploadimg', { method: 'POST', credentials: 'include', body: fd })
    const data = await res.json()
    if (!data.upload) {
      error.value = data.message
      return
    }
    user.value.image = data.image  // เปลี่ยนรูปที่แสดงเป็นรูปใหม่
    file.value = null
    toast('อัปโหลดรูปโปรไฟล์แล้ว')
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
  finally {
    uploading.value = false
  }
}

// ออกจากระบบ : ให้ Backend ล้าง Cookie แล้วกลับไปหน้า Login
const logout = async () => {
  try {
    await callApi('/api/members/logout') // ให้ Backend ล้าง Cookie token
  }
  catch (err) { /* ออกจากระบบฝั่งหน้าเว็บต่อไป */ }
  localStorage.removeItem('isLoggedIn') // ลบสถานะการล็อคอิน
  alert('ออกจากระบบแล้ว')
  router.push('/login') // เด้งไปหน้าเข้าสู่ระบบ
}

// ประวัติการสั่งซื้อ : ยังเป็นข้อมูลจำลอง (งานส่วน Transaction ของเพื่อน)
const orders = ref([
  { id: '#PMT2025003', date: '12 ก.ค. 2569', total: 1860, st: 'จัดส่งแล้ว', cls: 'ok' },
  { id: '#PMT2025002', date: '5 ก.ค. 2569', total: 690, st: 'รอจัดส่ง', cls: 'wait' },
  { id: '#PMT2025001', date: '28 มิ.ย. 2569', total: 1250, st: 'ยกเลิก', cls: 'no' }
])

const fmt = (n) => n.toLocaleString('en-US')
const toast = (msg) => alert(msg)
</script>
