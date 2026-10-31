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
      <button class="it" v-if="user.role==='admin'" style="background:var(--pink-l);font-weight:700" @click="router.push('/admin/products')">จัดการสินค้า (Admin)</button>
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
      <div class="addr">
        <!-- ที่อยู่หลัก (members.address) แก้ไขที่ฟอร์มข้อมูลส่วนตัวด้านบน -->
        <div><span>👤 {{user.address || 'ยังไม่ได้ระบุที่อยู่'}}</span><button class="btn ghost" style="padding:6px 14px" @click="edit=true">แก้ไข</button></div>
        <!-- ที่อยู่เพิ่มเติม (member_addresses) -->
        <div v-for="a in addresses" :key="a.id">
          <template v-if="editId===a.id">
            <input v-model="editText" maxlength="500" style="flex:1;margin-right:8px" @keyup.enter="saveAddress">
            <span style="white-space:nowrap"><button class="btn" style="padding:6px 14px" @click="saveAddress">บันทึก</button>
              <button class="btn ghost" style="padding:6px 14px;margin-left:6px" @click="editId=null">ยกเลิก</button></span>
          </template>
          <template v-else>
            <span>📍 {{a.address}}</span>
            <span style="white-space:nowrap"><button class="btn ghost" style="padding:6px 14px" @click="startEditAddress(a)">แก้ไข</button>
              <button class="btn ghost" style="padding:6px 14px;margin-left:6px" @click="removeAddress(a)">ลบ</button></span>
          </template>
        </div>
        <div v-if="adding">
          <input v-model="newAddress" maxlength="500" placeholder="กรอกที่อยู่จัดส่งใหม่" style="flex:1;margin-right:8px" @keyup.enter="addAddress">
          <span style="white-space:nowrap"><button class="btn" style="padding:6px 14px" @click="addAddress">บันทึก</button>
            <button class="btn ghost" style="padding:6px 14px;margin-left:6px" @click="adding=false;newAddress=''">ยกเลิก</button></span>
        </div>
        <div v-else style="justify-content:center;cursor:pointer" @click="adding=true;editId=null">＋ เพิ่มที่อยู่ใหม่</div>
      </div>
      <p style="color:#c02a54" v-if="addrError">{{addrError}}</p>
      <h2>ประวัติการสั่งซื้อ</h2>
      <div style="overflow-x:auto"><table><thead><tr><th>เลขที่คำสั่งซื้อ</th><th>วันที่สั่งซื้อ</th><th>ยอดรวม</th><th>สถานะ</th></tr></thead>
        <tbody>
          <tr v-if="!orders.length"><td colspan="4" style="text-align:center;color:var(--mute)">ยังไม่มีประวัติการสั่งซื้อ</td></tr>
          <template v-for="o in orders" :key="o.id">
            <tr>
              <!-- กดเลขที่คำสั่งซื้อเพื่อเปิด/ปิดรายการสินค้าที่สั่ง -->
              <td><a href="#" style="color:var(--pink);font-weight:700;text-decoration:none" @click.prevent="toggleOrder(o)">#{{o.order_no}} {{openId===o.id?'▲':'▼'}}</a></td>
              <td>{{fmtDate(o.confirmed_at || o.created_at)}}</td><td>฿ {{fmt(Number(o.total_amount))}}</td><td><span class="st ok">สั่งซื้อแล้ว</span></td></tr>
            <tr v-if="openId===o.id"><td colspan="4" style="background:var(--card)">
              <p v-if="!detail[o.id]" style="margin:8px 0;color:var(--mute)">{{detailError || 'กำลังโหลดรายการสินค้า...'}}</p>
              <table v-else style="width:100%">
                <thead><tr><th>สินค้า</th><th>ราคาต่อชิ้น</th><th>จำนวน</th><th>รวม</th></tr></thead>
                <tbody>
                  <tr v-for="it in detail[o.id]" :key="it.item_id">
                    <td><div style="display:flex;gap:10px;align-items:center">
                      <img :src="`${API}/img_pd/${it.code}.jpg`" style="width:44px;height:44px;object-fit:cover;border-radius:8px" alt="">{{it.name}}</div></td>
                    <td>฿ {{fmt(Number(it.unit_price))}}</td><td>{{it.qty}}</td><td>฿ {{fmt(it.qty * Number(it.unit_price))}}</td></tr>
                  <tr><td colspan="3" style="text-align:right;font-weight:700">ยอดรวม</td><td style="font-weight:700">฿ {{fmt(detailTotal(o.id))}}</td></tr>
                </tbody></table>
            </td></tr>
          </template>
        </tbody></table></div>
    </div>
  </div>
</template>

<script setup>
// หน้า Profile : แสดง/แก้ไขข้อมูลสมาชิกที่ login อยู่ และอัปโหลดรูปโปรไฟล์
//   GET  /api/members/detail     โหลดข้อมูลตัวเอง (ถ้าไม่ได้ login ให้กลับไปหน้า Login)
//   PUT  /api/members            บันทึกชื่อ เบอร์ ที่อยู่
//   POST /api/members/uploadimg  อัปโหลดรูป
//   GET  /api/members/logout     ออกจากระบบ
//   GET/POST/PUT/DELETE /api/members/addresses  ที่อยู่จัดส่งเพิ่มเติม
//   GET  /api/orders             ประวัติการสั่งซื้อ (แสดงเฉพาะที่ยืนยันสั่งซื้อแล้วของตัวเอง)
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
    loadAddresses()
    loadOrders()
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

// ที่อยู่จัดส่งเพิ่มเติม : GET/POST/PUT/DELETE /api/members/addresses
const addresses = ref([])      // รายการที่อยู่เพิ่มเติม
const addrError = ref('')      // ข้อความผิดพลาดใต้รายการที่อยู่
const adding = ref(false)      // true = กำลังกรอกที่อยู่ใหม่
const newAddress = ref('')     // ที่อยู่ใหม่ที่กรอก
const editId = ref(null)       // id ที่อยู่ที่กำลังแก้ไข (null = ไม่ได้แก้)
const editText = ref('')       // ข้อความที่อยู่ที่กำลังแก้ไข

const loadAddresses = async () => {
  try {
    const data = await callApi('/api/members/addresses')
    if (data.ok) addresses.value = data.addresses
  }
  catch (err) { addrError.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }
}

const addAddress = async () => {
  addrError.value = ''
  if (!newAddress.value.trim()) { addrError.value = 'กรอกที่อยู่'; return }
  try {
    const data = await callApi('/api/members/addresses', 'POST', { address: newAddress.value })
    if (!data.ok) { addrError.value = data.message; return }
    addresses.value.push(data.address)
    newAddress.value = ''
    adding.value = false
    toast('เพิ่มที่อยู่แล้ว')
  }
  catch (err) { addrError.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }
}

const startEditAddress = (a) => {
  editId.value = a.id
  editText.value = a.address
  adding.value = false
  addrError.value = ''
}

const saveAddress = async () => {
  addrError.value = ''
  if (!editText.value.trim()) { addrError.value = 'กรอกที่อยู่'; return }
  try {
    const data = await callApi('/api/members/addresses/' + editId.value, 'PUT', { address: editText.value })
    if (!data.ok) { addrError.value = data.message; return }
    const i = addresses.value.findIndex(x => x.id === editId.value)
    if (i > -1) addresses.value[i] = data.address
    editId.value = null
    toast('แก้ไขที่อยู่แล้ว')
  }
  catch (err) { addrError.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }
}

const removeAddress = async (a) => {
  if (!confirm('ลบที่อยู่นี้หรือไม่?')) return
  addrError.value = ''
  try {
    const data = await callApi('/api/members/addresses/' + a.id, 'DELETE')
    if (!data.ok) { addrError.value = data.message; return }
    addresses.value = addresses.value.filter(x => x.id !== a.id)
  }
  catch (err) { addrError.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }
}

// ประวัติการสั่งซื้อ : GET /api/orders แล้วเก็บเฉพาะคำสั่งซื้อที่ยืนยันแล้ว (confirmed) ของตัวเอง
// (ตะกร้า = status pending ยังไม่นับเป็นประวัติ / Admin ได้ของทุกคนมา จึงกรองด้วย member_id)
const orders = ref([])
const loadOrders = async () => {
  try {
    const data = await callApi('/api/orders')
    if (!data.success) return
    orders.value = data.data.filter(o => o.status === 'confirmed' && o.member_id === user.value.id)
  }
  catch (err) { /* ไม่ได้ต่อ Backend : ปล่อยตารางว่าง */ }
}

// ดูรายการสินค้าในคำสั่งซื้อ : GET /api/orders/:orderId (โหลดครั้งแรกที่กดเปิด แล้วเก็บไว้ใช้ซ้ำ)
const openId = ref(null)       // id คำสั่งซื้อที่กางรายละเอียดอยู่ (null = ปิดหมด)
const detail = ref({})         // { orderId: [รายการสินค้า] }
const detailError = ref('')
const toggleOrder = async (o) => {
  if (openId.value === o.id) { openId.value = null; return }
  openId.value = o.id
  detailError.value = ''
  if (detail.value[o.id]) return
  try {
    const data = await callApi('/api/orders/' + o.id)
    if (!data.success) { detailError.value = data.message; return }
    detail.value[o.id] = data.data.items
  }
  catch (err) { detailError.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }
}
// ยอดรวมคำนวณจากรายการสินค้าที่แสดง (ให้ตรงกับตารางเสมอ)
const detailTotal = (id) => (detail.value[id] || []).reduce((s, it) => s + it.qty * Number(it.unit_price), 0)

// แสดงวันที่แบบไทย เช่น 12 ก.ค. 2569
const fmtDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
const fmt = (n) => n.toLocaleString('en-US')
const toast = (msg) => alert(msg)
</script>
