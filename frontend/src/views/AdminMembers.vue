<template>
  <div class="pmain" style="margin:20px 0 40px">
    <h2 style="margin-top:0">จัดการสมาชิก (Admin)</h2>

    <!-- แถบค้นหาและกรอง: กด Enter ในช่องค้นหา หรือเปลี่ยนตัวเลือก จะโหลดรายชื่อใหม่ -->
    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px">
      <input v-model="q" placeholder="ค้นหาชื่อหรืออีเมล" @keyup.enter="load" style="flex:1; min-width:200px; padding:10px 14px; border-radius:12px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font:inherit">
      <select v-model="role" @change="load" style="padding:10px 14px; border-radius:12px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font:inherit">
        <option value="">ทุกบทบาท</option>
        <option value="member">member</option>
        <option value="admin">admin</option>
      </select>
      <select v-model="status" @change="load" style="padding:10px 14px; border-radius:12px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font:inherit">
        <option value="">ทุกสถานะ</option>
        <option value="active">active</option>
        <option value="suspended">suspended</option>
      </select>
      <button class="btn" @click="load">ค้นหา</button>
    </div>

    <p v-if="error" style="color:#c02a54">{{ error }}</p>
    <p style="color:var(--mute)">สมาชิกทั้งหมด {{ members.length }} คน</p>

    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>ID</th><th>อีเมล</th><th>ชื่อ</th><th>บทบาท</th><th>สถานะ</th><th>สมัครเมื่อ</th><th>จัดการ</th></tr></thead>
        <tbody>
        <template v-for="m in members" :key="m.id">
        <tr>
          <td>{{ m.id }}</td>
          <td>{{ m.email }}</td>
          <td>{{ m.name }}</td>
          <td><span class="st" :class="m.role === 'admin' ? 'wait' : ''">{{ m.role }}</span></td>
          <td><span class="st" :class="m.status === 'active' ? 'ok' : 'no'">{{ m.status }}</span></td>
          <td>{{ new Date(m.created_at).toLocaleDateString('th-TH') }}</td>
          <td style="white-space:nowrap">
            <!-- ปุ่มดูประวัติ: ใช้ได้กับทุกแถว (รวมของตัวเอง) -->
            <button class="btn ghost" style="padding:6px 12px; margin-right:6px" @click="toggleHistory(m)">
              {{ openId === m.id ? 'ซ่อนประวัติ' : 'ดูประวัติ' }}
            </button>
            <!-- แถวของตัวเองไม่มีปุ่ม (Backend ก็ไม่ให้เปลี่ยนสถานะ/บทบาทตัวเองอยู่แล้ว) -->
            <span v-if="m.id === me.id" style="color:var(--mute)">(คุณ)</span>
            <template v-else>
              <button class="btn ghost" style="padding:6px 12px" @click="changeStatus(m)">
                {{ m.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน' }}
              </button>
              <button class="btn ghost" style="padding:6px 12px; margin-left:6px" @click="changeRole(m)">
                {{ m.role === 'admin' ? 'ลดเป็น member' : 'ตั้งเป็น admin' }}
              </button>
            </template>
          </td>
        </tr>
        <!-- แถวรายละเอียด: ข้อมูลสมาชิก + ประวัติคำสั่งซื้อ (แสดงเมื่อกด "ดูประวัติ") -->
        <tr v-if="openId === m.id">
          <td colspan="7" style="background:var(--bg)">
            <div style="display:flex; gap:16px; align-items:center; margin-bottom:12px">
              <img v-if="m.image" :src="`${API}/img_mem/${m.image}`" style="width:64px;height:64px;object-fit:cover;border-radius:50%" alt="">
              <div>
                <div><b>{{ m.name }}</b> ({{ m.email }})</div>
                <div style="color:var(--mute)">โทร: {{ m.phone || '-' }} | ที่อยู่: {{ m.address || '-' }}</div>
              </div>
            </div>
            <b>ประวัติคำสั่งซื้อ</b>
            <p v-if="historyLoading" style="color:var(--mute)">กำลังโหลด...</p>
            <p v-else-if="!orders.length" style="color:var(--mute)">ยังไม่มีประวัติการสั่งซื้อ</p>
            <table v-else>
              <thead><tr><th>เลขที่</th><th>วันที่</th><th>ยอดรวม</th></tr></thead>
              <tbody>
                <template v-for="o in orders" :key="o.id">
                  <tr>
                    <td><a href="#" style="color:var(--pink);font-weight:700;text-decoration:none" @click.prevent="toggleOrder(o)">#{{ o.order_no }} {{ orderOpen === o.id ? '▲' : '▼' }}</a></td>
                    <td>{{ new Date(o.confirmed_at || o.created_at).toLocaleString('th-TH') }}</td>
                    <td>฿ {{ Number(o.total_amount).toLocaleString() }}</td>
                  </tr>
                  <tr v-if="orderOpen === o.id">
                    <td colspan="3">
                      <div v-for="it in (items[o.id] || [])" :key="it.item_id" style="display:flex; gap:10px; align-items:center; padding:4px 0">
                        <img :src="`${API}/img_pd/${it.code}.jpg`" style="width:40px;height:40px;object-fit:cover;border-radius:8px" alt="">
                        {{ it.name }} x{{ it.qty }} (฿ {{ it.unit_price }})
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </td>
        </tr>
        </template>
        </tbody>
      </table>
    </div>
    <p><button class="btn ghost" @click="router.push('/profile')">กลับหน้าโปรไฟล์</button></p>
  </div>
</template>

<script setup>
// หน้า Admin จัดการสมาชิก (/admin/members) ใช้ได้เฉพาะ admin
//   GET /api/members              โหลดรายชื่อ (ค้นหาด้วย ?q= กรองด้วย ?role= ?status=)
//   PUT /api/members/:id/status   ระงับ / เปิดใช้งาน
//   PUT /api/members/:id/role     ตั้ง / ลด admin
//   GET /api/orders?target_member_id=ID  ประวัติคำสั่งซื้อของสมาชิก (admin ดูของคนอื่นได้)
//   GET /api/orders/:orderId             รายการสินค้าในคำสั่งซื้อ
// หมายเหตุ: การเช็คว่าเป็น admin ในหน้านี้เป็นแค่ความสะดวกของผู้ใช้
//           ความปลอดภัยจริงอยู่ที่ Backend ซึ่งตรวจสิทธิ์จากฐานข้อมูลทุกคำขอ
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { callApi } from '../api.js'

const router = useRouter()

const members = ref([])  // รายชื่อสมาชิกที่แสดงในตาราง
const me = ref({})       // ข้อมูลของ admin ที่ login อยู่ (ใช้ซ่อนปุ่มในแถวของตัวเอง)
const q = ref('')        // คำค้นหา
const role = ref('')     // ตัวกรองบทบาท ('' = ทั้งหมด)
const status = ref('')   // ตัวกรองสถานะ ('' = ทั้งหมด)
const error = ref('')

const API = 'http://localhost:3000'
const openId = ref(null)          // id สมาชิกที่กางประวัติอยู่
const orders = ref([])            // คำสั่งซื้อที่ยืนยันแล้วของสมาชิกนั้น
const historyLoading = ref(false)
const orderOpen = ref(null)       // id คำสั่งซื้อที่กางรายการสินค้าอยู่
const items = ref({})             // { orderId: [รายการสินค้า] } โหลดครั้งแรกที่กดแล้วเก็บไว้ใช้ซ้ำ

// โหลดรายชื่อสมาชิก (GET /api/members) เฉพาะ admin
const load = async () => {
  error.value = ''
  // ประกอบ query string เฉพาะตัวกรองที่มีค่า
  const params = new URLSearchParams()
  if (q.value) params.set('q', q.value)
  if (role.value) params.set('role', role.value)
  if (status.value) params.set('status', status.value)
  try {
    const data = await callApi('/api/members?' + params.toString())
    // สำเร็จ Backend ส่ง data (รายชื่อ) มา ถ้าไม่มี data แปลว่าถูกปฏิเสธ (เช่น Admin only) ให้แสดงข้อความ
    if (!data.data) {
      error.value = data.message
      return
    }
    members.value = data.data
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
}

// ตรวจว่าเป็น admin ก่อน ถ้าไม่ใช่ให้กลับไปหน้าอื่น (Backend ตรวจสิทธิ์ซ้ำอีกชั้นเสมอ)
onMounted(async () => {
  try {
    const data = await callApi('/api/members/detail')
    if (!data.login) {
      router.push('/login')        // ยังไม่ได้ login
      return
    }
    if (data.role !== 'admin') {
      router.push('/profile')      // login แล้วแต่ไม่ใช่ admin
      return
    }
    me.value = data
    await load()
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
})

// PUT /api/members/:id/status : สลับระหว่าง active กับ suspended
const changeStatus = async (m) => {
  const next = m.status === 'active' ? 'suspended' : 'active'
  if (!confirm(`เปลี่ยนสถานะของ ${m.email} เป็น ${next} ?`)) return
  const data = await callApi(`/api/members/${m.id}/status`, 'PUT', { status: next })
  // สำเร็จ Backend ส่งข้อมูลสมาชิกที่มี status ใหม่กลับมา ถ้าไม่ตรงกับที่ขอ แปลว่าไม่สำเร็จ
  if (data.status !== next) {
    error.value = data.message
    return
  }
  m.status = data.status   // อัปเดตแถวในตารางทันทีโดยไม่ต้องโหลดใหม่
}

// PUT /api/members/:id/role : สลับระหว่าง member กับ admin (ใช้เพิ่ม admin)
const changeRole = async (m) => {
  const next = m.role === 'admin' ? 'member' : 'admin'
  if (!confirm(`เปลี่ยนบทบาทของ ${m.email} เป็น ${next} ?`)) return
  const data = await callApi(`/api/members/${m.id}/role`, 'PUT', { role: next })
  if (data.role !== next) {
    error.value = data.message
    return
  }
  m.role = data.role
}

// กด "ดูประวัติ" : แสดงข้อมูลสมาชิก (จากรายชื่อที่โหลดมาแล้ว) และโหลดคำสั่งซื้อของคนนั้น
const toggleHistory = async (m) => {
  if (openId.value === m.id) { openId.value = null; return }
  openId.value = m.id
  orders.value = []
  orderOpen.value = null
  historyLoading.value = true
  try {
    // Backend ตรวจว่าเป็น admin จึงยอมให้ใช้ target_member_id ดูของคนอื่น
    const data = await callApi('/api/orders?target_member_id=' + m.id)
    // ตะกร้า (pending) ไม่ใช่คำสั่งซื้อ จึงแสดงเฉพาะที่ยืนยันแล้ว
    orders.value = (data.data || []).filter(o => o.status === 'confirmed')
    if (!data.data) error.value = data.message
  }
  catch (err) {
    error.value = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'
  }
  historyLoading.value = false
}

// กดเลขที่คำสั่งซื้อ : โหลดรายการสินค้า (GET /api/orders/:orderId)
const toggleOrder = async (o) => {
  if (orderOpen.value === o.id) { orderOpen.value = null; return }
  orderOpen.value = o.id
  if (!items.value[o.id]) {
    const data = await callApi('/api/orders/' + o.id)
    items.value[o.id] = data.data ? data.data.items : []
  }
}
</script>
