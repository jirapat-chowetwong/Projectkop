<template>
    <!-- CART -->
  <div class="cartgrid">
    <div><h2 style="margin:0 0 12px">ตะกร้าสินค้า <small style="font-weight:400;color:var(--mute)">({{cart.length}} รายการ)</small></h2>
      <div class="cartbox">
        <div class="empty" v-if="!cart.length">ตะกร้ายังว่าง เลือกสินค้าที่ถูกใจได้เลย</div>
        <div style="overflow-x:auto" v-else>
          <table>
          <tr><th>สินค้า</th><th>ราคา</th><th>จำนวน</th><th>ราคารวม</th><th>ลบ</th></tr>
          <tr><td colspan="5"><label style="color:var(--pink);cursor:pointer">
            <input type="checkbox" :checked="allSel" @change="toggleAll($event.target.checked)"> เลือกทั้งหมด</label>
            <!-- ลบรายการที่ติ๊กเลือกไว้ทีเดียวหลายรายการ -->
            <button class="btn" style="margin-left:16px;padding:6px 14px" :disabled="busy || !sel.length"
              :style="{opacity:sel.length?1:.5}" @click="removeSelected">🗑️ ลบที่เลือก ({{sel.length}})</button></td></tr>
          <tr v-for="it in cart" :key="it.id">
            <td>
              <div style="display:flex;gap:12px;align-items:center">
                <input type="checkbox" v-model="it.sel">
                <div class="mini">
                  <img :src="`http://localhost:3000/img_pd/${it.code}.jpg`" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" alt=""></div>{{it.name}}</div></td>
            <td style="white-space: nowrap;">฿ {{it.price}}</td>
            <td><div class="qty">
              <button @click="dec(it)" :disabled="busy">−</button>
              <span>{{it.qty}}</span>
              <button @click="inc(it)" :disabled="busy">+</button></div></td>
            <td style="white-space: nowrap;">฿ {{it.price*it.qty}}</td>
            <td><button class="ib" style="font-size:18px" @click="remove(it.id)" aria-label="ลบ">🗑️</button></td></tr>
        </table></div>
        <div style="padding:12px">
          <button class="btn" @click="go('products')">← เลือกซื้อสินค้าต่อ</button></div>
      </div></div>
    <div class="sum"><div class="h">สรุปคำสั่งซื้อ</div><div class="b">
      <div class="r"><span>ราคารวมสินค้า ({{selQty}} ชิ้น)</span><span>฿ {{fmt(subtotal)}}</span></div>
      <div class="r"><span>ค่าจัดส่ง</span><span>฿ {{shipping}}</span></div>
      <div class="t"><span>ยอดรวมทั้งหมด</span><span>฿ {{fmt(subtotal+shipping)}}</span></div>
      <button class="btn" :disabled="!selQty" :style="{opacity:selQty?1:.5}" @click="order">สั่งซื้อสินค้า</button>
      <div class="r" style="margin-top:14px">🚚 จัดส่งฟรี เมื่อซื้อครบ 1,000.-</div></div></div>
  </div>
</template>

<script setup>
// หน้าตะกร้า : ใช้ข้อมูลจริงจาก Backend ทั้งหมด (ไม่ใช้ localStorage แล้ว)
//   GET    /api/cart              โหลดตะกร้าของสมาชิกที่ login อยู่
//   POST   /api/cart              เพิ่มจำนวนสินค้า (ถ้ามีรายการนี้อยู่แล้วจะบวกจำนวนให้)
//   DELETE /api/cart/items/:id    ลบสินค้าออกจากตะกร้า
//   POST   /api/cart/checkout     ยืนยันสั่งซื้อ (Backend ตัดสต็อกและเปลี่ยนสถานะเป็น confirmed)
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const API = 'http://localhost:3000'
const cart = ref([])     // รายการสินค้าในตะกร้า
const busy = ref(false)  // true ระหว่างรอ Backend ตอบ (กันกดซ้ำ)

axios.defaults.withCredentials = true

// แจ้ง App.vue ให้อัปเดตตัวเลขบนไอคอนตะกร้า
const notify = () => window.dispatchEvent(new Event('cart-updated'))

// จัดการข้อผิดพลาดจาก Backend : 401 = ยังไม่ได้ login
const handleError = (error, fallback) => {
  if (error.response?.status === 401) {
    alert('กรุณาเข้าสู่ระบบก่อนใช้ตะกร้าสินค้า')
    router.push('/login')
  } else {
    alert(error.response?.data?.message || fallback)
  }
}

const fetchCart = async () => {
  try {
    const res = await axios.get(API + '/api/cart')
    // จำไว้ว่ารายการไหนติ๊กเลือกอยู่ เพื่อไม่ให้ถูกรีเซ็ตทุกครั้งที่โหลดใหม่
    const picked = new Map(cart.value.map(i => [i.id, i.sel]))
    // ตะกร้าว่าง Backend ไม่ส่ง items มา จึงใช้ [] แทน
    cart.value = (res.data.items || []).map(item => ({
      id: item.item_id,           // id ของ order_items ใช้อ้างอิงเวลาลบ
      product_id: item.product_id,
      code: item.code,
      name: item.name,
      price: Number(item.unit_price),
      qty: item.qty,
      sel: picked.has(item.item_id) ? picked.get(item.item_id) : true
    }))
  } catch (error) {
    if (error.response?.status === 401) {
      alert('กรุณาเข้าสู่ระบบก่อนดูตะกร้าสินค้า')
      router.push('/login')
    } else {
      console.error('ไม่สามารถโหลดตะกร้าได้:', error)
    }
  }
}

onMounted(() => {
  fetchCart()
})

// ทำรายการที่เรียก Backend แล้วโหลดตะกร้าใหม่ (กันกดซ้ำด้วย busy)
const run = async (fn) => {
  if (busy.value) return
  busy.value = true
  try {
    await fn()
    await fetchCart()
    notify()
  } catch (error) {
    handleError(error, 'ทำรายการไม่สำเร็จ')
  } finally {
    busy.value = false
  }
}

const allSel = computed(() => cart.value.length > 0 && cart.value.every(i => i.sel))
const sel = computed(() => cart.value.filter(i => i.sel))
const selQty = computed(() => sel.value.reduce((s,i) => s + i.qty, 0))
const subtotal = computed(() => sel.value.reduce((s,i) => s + i.qty * i.price, 0))
const shipping = computed(() => !selQty.value || subtotal.value >= 1000 ? 0 : 50)

const fmt = (n) => n.toLocaleString('en-US')
const go = (path) => router.push('/' + path)

// เพิ่มจำนวน 1 ชิ้น : POST /api/cart (Backend บวกจำนวนให้)
const inc = (it) => run(() => axios.post(API + '/api/cart', { product_id: it.product_id, qty: 1 }))

// ลดจำนวน 1 ชิ้น : Backend ยังไม่มี endpoint ลดจำนวน จึงลบรายการเดิมแล้วเพิ่มใหม่ด้วยจำนวนที่ลดแล้ว
const dec = (it) => {
  if (it.qty <= 1) return
  return run(async () => {
    await axios.delete(API + '/api/cart/items/' + it.id)
    await axios.post(API + '/api/cart', { product_id: it.product_id, qty: it.qty - 1 })
  })
}

// ลบสินค้า : DELETE /api/cart/items/:id
const remove = (id) => run(() => axios.delete(API + '/api/cart/items/' + id))

// ลบหลายรายการ : เรียก DELETE ทีละรายการตามลำดับ (ไม่ยิงพร้อมกัน เพราะรายการสุดท้ายที่ลบจะลบตะกร้าทิ้งด้วย)
const removeSelected = async () => {
  const items = sel.value
  if (!items.length) return
  if (!confirm(`ลบสินค้าที่เลือก ${items.length} รายการออกจากตะกร้าหรือไม่?`)) return
  await run(async () => {
    for (const it of items) {
      await axios.delete(API + '/api/cart/items/' + it.id)
    }
  })
}

const toggleAll =(val) => cart.value.forEach(i => i.sel = val)

// สั่งซื้อ : Backend ยืนยันทั้งตะกร้า จึงนำรายการที่ไม่ได้เลือกออกก่อน (ถามยืนยันก่อน)
const order = async () => {
  if (!selQty.value) return
  const unselected = cart.value.filter(i => !i.sel)
  if (unselected.length && !confirm('สินค้าที่ไม่ได้เลือกจะถูกนำออกจากตะกร้า ดำเนินการต่อหรือไม่?')) return
  await run(async () => {
    for (const it of unselected) {
      await axios.delete(API + '/api/cart/items/' + it.id)
    }
    // POST /api/cart/checkout : ตัดสต็อกและยืนยันคำสั่งซื้อ (ถ้าสต็อกไม่พอ Backend ตอบ 400 พร้อมข้อความ)
    await axios.post(API + '/api/cart/checkout')
    alert('สั่งซื้อสำเร็จ!')
    router.push('/profile')
  })
}
</script>
