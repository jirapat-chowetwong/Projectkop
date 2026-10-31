<template>
    <!-- DETAIL -->
  <div class="crumb">
    <a @click="go('home')" style="cursor:pointer">หน้าแรก</a> › 
    <a @click="go('products')" style="cursor:pointer">สินค้า</a> › {{cur.name}}</div>
  <div class="detail" v-if="cur.id">
    <div class="main" :style="{background:cur.bg}"><img v-if="cur.code" :src="`http://localhost:3000/img_pd/${cur.code}.jpg`" class="product-img" alt=""></div>
    <div>
      <h1 style="margin:0">{{cur.name}}</h1><p>{{ cur.series_name || 'POP MART' }}</p>
      <div>
        <span class="big">฿ {{cur.price}}</span>
        <!--<span class="old">฿ {{cur.old +100}}</span>
        <span class="tag">ลด {{discount}}%</span>--></div>
      <p>⭐⭐⭐⭐☆ 4.5 รีวิว (256 ราย)</p>
      <p>ฟิกเกอร์ยอดฮิตจากซีรีส์ The Monsters ดีไซน์น่ารัก มีให้หลายรูปแบบ เหมาะสำหรับนักสะสม ทุกเพศทุกวัย</p>
      <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <div style="margin-bottom:8px; color:var(--mute)">จำนวน (มีสินค้า: {{ cur.stock }})</div>
        <div class="qty">
          <button @click="dq=Math.max(1,dq-1)">−</button>
          <span>{{dq}}</span>
          <button @click="dq < cur.stock ? dq++ : null">+</button></div></div>
        <div style="flex:1;min-width:200px;display:grid;gap:10px">
          <button class="btn" @click="add(cur,dq)" :disabled="cur.stock <= 0">★ เพิ่มใส่ตะกร้า</button>
          <button class="btn ghost" @click="add(cur,dq,true)" :disabled="cur.stock <= 0">ซื้อเลย</button></div></div>
      <div class="perks"><div>🚚 รอจัดส่งฟรี<br>เมื่อซื้อครบ 1,000 บาท</div><div>🛡️ ได้ของแท้ 100%</div><div>🔄 เปลี่ยน/คืนสินค้า<br>ภายใน 7 วัน</div></div>
      <div class="tabs" style="margin-top:20px;"><button v-for="t in tabs" :key="t.k" :class="{on:tab===t.k}" @click="tab=t.k">{{t.n}}</button></div>
      <div class="tabbody">
        <div v-if="tab==='d'"><strong>{{ cur.name }}</strong><br><br>
          {{ cur.description || 'รายละเอียดสินค้า...' }}<br><br>
          • รหัสสินค้า: {{ cur.code }}<br>
          • ประเภท: {{ cur.product_type }}</div>
        <div v-if="tab==='r'">ลูกค้าให้คะแนนเฉลี่ย 4.5 จาก 5 (256 รีวิว) — ของแท้ แพ็กเกจดี ส่งไว</div>
        <div v-if="tab==='s'">จัดส่งภายใน 2–3 วันทำการ ค่าจัดส่ง ฿50 ส่งฟรีเมื่อซื้อครบ ฿1,000</div></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const cur = ref({})
const dq = ref(1)
const tab = ref('d')

const tabs = [
  {k:'d', n:'รายละเอียดสินค้า'}, {k:'r', n:'รีวิว (256)'}, {k:'s', n:'ข้อมูลการจัดส่ง'}
]

onMounted(async () => {
  // อ่านค่า ID จาก URL (เช่น /prodetail/5)
  const productId = route.params.id 
  
  if (productId) {
    try {
      // เรียก API ดึงข้อมูลสินค้าชิ้นนั้นจาก Backend
      const res = await axios.get(`http://localhost:3000/api/products/${productId}`)
      cur.value = res.data // นำข้อมูลไปใส่ตัวแปร cur เพื่อแสดงผล
    } catch (error) {
      console.error('ไม่พบสินค้า:', error)
      alert('ไม่พบข้อมูลสินค้านี้')
      router.push('/products') // ถ้าหาไม่เจอให้เด้งกลับหน้าสินค้า
    }
  }
})

//const discount = computed(() => Math.round((1 - cur.value.price / cur.value.old) * 100))
const go = (path) => router.push('/' + path)
const add = async (p, qty = 1, buy = false) => {
  try {
    // POST /api/cart : Backend รู้ว่าใคร login อยู่จาก Cookie token (ต้อง login ก่อน)
    await axios.post('http://localhost:3000/api/cart', { product_id: p.id, qty: qty })
    // สั่งให้ App.vue อัปเดตตัวเลขบนไอคอนตะกร้า
    window.dispatchEvent(new Event('cart-updated'))
    if(buy) {
      router.push('/cart')
    } else {
      alert(`เพิ่ม ${p.name} ลงตะกร้าแล้ว!`)
    }
  } catch (error) {
    if (error.response?.status === 401) {
      alert('กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าลงตะกร้า')
      router.push('/login')
    } else {
      alert(error.response?.data?.message || 'เพิ่มสินค้าลงตะกร้าไม่สำเร็จ')
    }
  }
}

</script>