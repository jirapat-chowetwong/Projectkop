<template>
  <div class="pmain" style="margin:20px 0 40px">
    <h2 style="margin-top:0">จัดการสินค้า (Admin)</h2>

    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px">
      <input v-model="q" placeholder="ค้นหาชื่อหรือรหัสสินค้า" @keyup.enter="load" style="flex:1; min-width:200px; padding:10px 14px; border-radius:12px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font:inherit">
      <button class="btn" @click="load">ค้นหา</button>
      <button class="btn ghost" @click="startAdd">+ เพิ่มสินค้าใหม่</button>
    </div>

    <p v-if="error" style="color:#c02a54">{{ error }}</p>
    <p v-if="info" style="color:#2f7d46">{{ info }}</p>

    <!-- ฟอร์มเพิ่ม/แก้ไขสินค้า : form.id มีค่า = แก้ไข, ไม่มี = เพิ่มใหม่ -->
    <div v-if="form" style="border:1px solid var(--line); border-radius:16px; padding:16px; margin-bottom:16px">
      <b>{{ form.id ? 'แก้ไขสินค้า #' + form.id : 'เพิ่มสินค้าใหม่' }}</b>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin:12px 0">
        <label>รหัสสินค้า<input v-model="form.code" style="width:100%"></label>
        <label>ชื่อสินค้า<input v-model="form.name" style="width:100%"></label>
        <label>ซีรีส์
          <select v-model="form.series_id" style="width:100%">
            <option :value="null">- ไม่ระบุ -</option>
            <option v-for="s in seriesList" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <label>ประเภท
          <select v-model="form.product_type" style="width:100%">
            <option value="blind_box">blind_box</option>
            <option value="whole_set">whole_set</option>
            <option value="single">single</option>
          </select>
        </label>
        <label>ราคา (บาท)<input v-model.number="form.price" type="number" min="0" style="width:100%"></label>
        <label>จำนวนในสต็อก<input v-model.number="form.stock" type="number" min="0" style="width:100%"></label>
      </div>
      <!-- เปลี่ยนรูป: ทำได้เมื่อแก้ไขสินค้าที่มีอยู่แล้ว (ต้องมี id) -->
      <div v-if="form.id" style="display:flex; gap:12px; align-items:center; margin:8px 0">
        <img :src="imgUrl(form)" style="width:72px;height:72px;object-fit:contain;border-radius:8px;background:#f4f4f4" alt="">
        <div>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="e => file = e.target.files[0]">
          <button class="btn ghost" style="padding:6px 12px" @click="uploadImage">อัปโหลดรูปใหม่</button>
          <div style="color:var(--mute); font-size:12px">ไฟล์ jpg, png, webp, gif ขนาดไม่เกิน 2 MB</div>
        </div>
      </div>
      <label>รายละเอียด<textarea v-model="form.description" rows="3" style="width:100%"></textarea></label>
      <label style="display:block; margin:8px 0"><input type="checkbox" v-model="form.is_active"> เปิดขาย (ถ้าไม่ติ๊ก สินค้าจะถูกซ่อนจากหน้าร้าน)</label>
      <button class="btn" @click="save">บันทึก</button>
      <button class="btn ghost" style="margin-left:8px" @click="form = null">ยกเลิก</button>
    </div>

    <p style="color:var(--mute)">สินค้าทั้งหมด {{ products.length }} รายการ</p>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>รูป</th><th>รหัส</th><th>ชื่อ</th><th>ซีรีส์</th><th>ราคา</th><th>สต็อก</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
        <tbody>
        <tr v-for="p in products" :key="p.id">
          <td><img :src="imgUrl(p)" style="width:44px;height:44px;object-fit:contain;border-radius:8px" alt=""></td>
          <td>{{ p.code }}</td>
          <td>{{ p.name }}</td>
          <td>{{ p.series_name || '-' }}</td>
          <td style="white-space:nowrap">฿ {{ Number(p.price).toLocaleString() }}</td>
          <td style="white-space:nowrap">
            <!-- ปุ่ม − / + ปรับสต็อกทีละ 1 -->
            <button class="btn ghost" style="padding:2px 10px" @click="changeStock(p, -1)" :disabled="p.stock <= 0">−</button>
            <b style="display:inline-block; min-width:32px; text-align:center">{{ p.stock }}</b>
            <button class="btn ghost" style="padding:2px 10px" @click="changeStock(p, 1)">+</button>
          </td>
          <td>
            <!-- ป้ายสถานะ: ซ่อน (เทา) / หมด (แดง) / เหลือน้อย ≤5 (ส้ม) / เปิดขาย (เขียว) -->
            <span class="pst" :class="statusOf(p).cls"><i></i>{{ statusOf(p).text }}</span>
          </td>
          <td style="white-space:nowrap">
            <button class="btn ghost" style="padding:6px 12px" @click="startEdit(p)">แก้ไข</button>
            <button class="btn ghost" style="padding:6px 12px; margin-left:6px" @click="toggleActive(p)">{{ p.is_active ? 'ซ่อน' : 'เปิดขาย' }}</button>
            <button class="btn ghost" style="padding:6px 12px; margin-left:6px" @click="remove(p)">ลบ</button>
          </td>
        </tr>
        </tbody>
      </table>
    </div>
    <p><button class="btn ghost" @click="router.push('/profile')">กลับหน้าโปรไฟล์</button></p>
  </div>
</template>

<script setup>
// หน้า Admin จัดการสินค้า (/admin/products) ใช้ได้เฉพาะ admin
//   GET    /api/products?all=true  โหลดสินค้าทั้งหมด (รวมที่ซ่อนอยู่ ถ้าเป็น admin)
//   POST   /api/products           เพิ่มสินค้า
//   PUT    /api/products/:id       แก้ไขสินค้า (Backend แทนที่ทุกช่อง จึงต้องส่งครบทุกช่องเสมอ)
//   POST   /api/products/:id/image เปลี่ยนรูปสินค้า (multipart ชื่อ field 'file')
//   DELETE /api/products/:id       ลบสินค้า (ถ้าเคยถูกสั่งซื้อแล้วจะลบไม่ได้ ให้ใช้ "ซ่อน")
// หมายเหตุ: Backend ตรวจสิทธิ์ admin จากฐานข้อมูลทุกคำขอ หน้านี้แค่ซ่อนปุ่มให้คนทั่วไป
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { callApi } from '../api.js'

const router = useRouter()

const products = ref([])
const seriesList = ref([])
const q = ref('')
const form = ref(null)   // null = ไม่แสดงฟอร์ม
const error = ref('')
const info = ref('')
const file = ref(null)          // ไฟล์รูปที่เลือกไว้
const imgVer = ref(Date.now())  // เปลี่ยนค่านี้เพื่อให้เบราว์เซอร์โหลดรูปใหม่ (ไม่ใช้รูปเก่าจาก cache)

// ที่อยู่รูปสินค้า (หน้าร้านใช้ชื่อไฟล์ตามรหัสสินค้า)
const imgUrl = (p) => `http://localhost:3000/img_pd/${p.code}.jpg?v=${imgVer.value}`

// สถานะที่แสดงในตาราง คิดจากข้อมูลสินค้า (ไม่ได้เก็บแยกในฐานข้อมูล)
const statusOf = (p) => {
  if (!p.is_active) return { text: 'ซ่อนอยู่', cls: 'off' }
  if (p.stock <= 0) return { text: 'สินค้าหมด', cls: 'out' }
  if (p.stock <= 5) return { text: 'เหลือน้อย', cls: 'low' }
  return { text: 'เปิดขาย', cls: 'on' }
}

// POST /api/products/:id/image : ส่งไฟล์แบบ multipart/form-data (ไม่ตั้ง Content-Type เอง ให้เบราว์เซอร์ใส่ boundary ให้)
const uploadImage = async () => {
  error.value = ''; info.value = ''
  if (!file.value) { error.value = 'กรุณาเลือกไฟล์รูปก่อน'; return }
  const fd = new FormData()
  fd.append('file', file.value)
  try {
    const res = await fetch('http://localhost:3000/api/products/' + form.value.id + '/image', { method: 'POST', credentials: 'include', body: fd })
    const data = await res.json()
    if (!data.upload) { error.value = data.message; return }
    info.value = 'เปลี่ยนรูปสินค้าแล้ว'
    file.value = null
    imgVer.value = Date.now()
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
}

const load = async () => {
  error.value = ''
  const params = new URLSearchParams({ all: 'true', limit: '100' })
  if (q.value) params.set('q', q.value)
  try {
    const data = await callApi('/api/products?' + params.toString())
    products.value = data.data || []
    if (!data.data) error.value = data.message || data.error
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
}

onMounted(async () => {
  try {
    const me = await callApi('/api/members/detail')
    if (!me.login) { router.push('/login'); return }
    if (me.role !== 'admin') { router.push('/profile'); return }
    const s = await callApi('/api/series')
    seriesList.value = s.data || []
    await load()
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
})

const emptyForm = () => ({ id: null, code: '', name: '', series_id: null, product_type: 'blind_box', price: 0, stock: 0, description: '', is_active: true })
const startAdd = () => { info.value = ''; form.value = emptyForm() }
const startEdit = (p) => {
  info.value = ''
  form.value = { id: p.id, code: p.code, name: p.name, series_id: p.series_id, product_type: p.product_type,
    price: Number(p.price), stock: p.stock, description: p.description || '', is_active: p.is_active }
}

// ส่งสินค้าทั้งชุดไปแก้ (PUT แทนที่ทุกช่อง) คืน true ถ้าสำเร็จ
const putProduct = async (p) => {
  const data = await callApi('/api/products/' + p.id, 'PUT', {
    code: p.code, name: p.name, series_id: p.series_id, product_type: p.product_type,
    price: p.price, stock: p.stock, description: p.description, is_active: p.is_active })
  if (data.message !== 'ok') { error.value = data.message || 'บันทึกไม่สำเร็จ'; return false }
  return true
}

// บันทึกฟอร์ม: ถ้ามี id = แก้ไข (PUT) ไม่มี = เพิ่มใหม่ (POST)
const save = async () => {
  error.value = ''; info.value = ''
  const f = form.value
  if (!f.code || !f.name) { error.value = 'ต้องกรอกรหัสและชื่อสินค้า'; return }
  if (f.price === '' || f.price < 0 || f.stock === '' || f.stock < 0) { error.value = 'ราคาและสต็อกต้องไม่ติดลบ'; return }
  if (f.id) {
    if (!(await putProduct(f))) return
  } else {
    const data = await callApi('/api/products', 'POST', f)
    if (data.message !== 'ok') { error.value = data.message || 'เพิ่มสินค้าไม่สำเร็จ'; return }
  }
  info.value = f.id ? 'แก้ไขสินค้าแล้ว' : 'เพิ่มสินค้าแล้ว'
  form.value = null
  await load()
}

// ปรับสต็อกทีละ 1 (ไม่ให้ต่ำกว่า 0)
const changeStock = async (p, d) => {
  error.value = ''; info.value = ''
  const next = Math.max(0, p.stock + d)
  if (await putProduct({ ...p, stock: next })) p.stock = next
}

const toggleActive = async (p) => {
  error.value = ''; info.value = ''
  if (await putProduct({ ...p, is_active: !p.is_active })) p.is_active = !p.is_active
}

const remove = async (p) => {
  if (!confirm(`ลบสินค้า ${p.code} ${p.name} ?`)) return
  error.value = ''; info.value = ''
  const data = await callApi('/api/products/' + p.id, 'DELETE')
  if (!data.ok) { error.value = data.message || 'ลบไม่สำเร็จ'; return }
  info.value = 'ลบสินค้าแล้ว'
  await load()
}
</script>

<style scoped>
.pst {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap; /* ไม่ให้ข้อความตกบรรทัด */
}
.pst i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.pst.on  { background: #e3f5e8; color: #2f7d46; }
.pst.low { background: #fff0d9; color: #b86b00; }
.pst.out { background: #fde1e6; color: #c02a54; }
.pst.off { background: #ececf0; color: #6b6b78; }
</style>
