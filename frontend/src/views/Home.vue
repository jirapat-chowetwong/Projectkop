<template>
    <!-- HOME -->
  <div class="hero"><div>
    <span class="logo" style="display:inline-block;cursor:default">KOP MART</span>
    <h1>Small Figures<br>Big Happiness</h1>
    <p>ของสะสมสุดพิเศษ ที่ทำให้ทุกวันมีรอยยิ้ม</p>
    <button class="btn" @click="go('products')">ช้อปเลย →</button></div>
    </div>
  <div class="cats">
    <button class="cat-btn" @click="go('products')">ทั้งหมด</button>
    <button class="cat-btn" v-for="c in seriesList" :key="c.id" @click="pickCat(c.id)">{{ c.name }}</button>
  </div>
  <div class="sec"><h2>สินค้าขายดี</h2><a @click="go('products')" style="cursor:pointer">ดูทั้งหมด →</a></div>
  <div class="grid">
    <div class="card" v-for="p in products.slice(0,5)" :key="p.id">
    <div class="thumb" @click="open(p)">
      <img :src="`${API}/img_pd/${p.code}.jpg`" class="product-img" alt="">
      <button class="heart" @click.stop="fav(p)">{{favs.includes(p.id)?'♥':'♡'}}</button></div>
    <div class="card-info">
      <h4>{{p.name}}</h4><p class="price">฿ {{p.price}}</p>
    <button class="btn" @click="add(p)" :disabled="p.stock <= 0">{{p.stock > 0 ? 'เพิ่มในตะกร้า' : 'สินค้าหมด'}}</button></div></div></div>
  <div class="promo"><div><small>คอลเล็กชันใหม่ล่าสุด</small><h2 style="margin:4px 0">ไปกับ POP MART</h2>
    <p>สินค้าลิขสิทธิ์แท้ น่ารักแบบไม่มีที่สิ้นสุด!</p><button class="btn green" @click="go('products')">ดูเพิ่มเติม →</button></div>
    <div style="font-size:70px"></div></div>
</template>

<script setup>
// หน้าแรก : ดึงสินค้าและหมวดหมู่(series)จริงจาก Backend
//   GET  /api/products   สินค้า (แสดง 5 ชิ้นแรก)
//   GET  /api/series     หมวดหมู่
//   POST /api/cart       เพิ่มสินค้าลงตะกร้า (ต้อง login)
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API } from '../api.js'

const router = useRouter()
const favs = ref([])
const products = ref([])
const seriesList = ref([])

onMounted(async () => {
  try {
    // 1. ดึงข้อมูลสินค้าจาก Backend
    const prodRes = await axios.get(API + '/api/products')
    products.value = prodRes.data.data

    // 2. ดึงข้อมูลหมวดหมู่ (Series)
    const seriesRes = await axios.get(API + '/api/series')
    seriesList.value = seriesRes.data.data
  } catch (err) {
    console.error('ไม่สามารถดึงข้อมูลจาก Backend ได้:', err)
  }
})

const go = (path) => router.push('/' + path)

// เมื่อกดหมวดหมู่ ให้พาไปหน้าสินค้าพร้อมแนบ id ไปด้วย (หน้า Products อ่านจาก ?series=)
const pickCat = (seriesId) => {
  router.push({ path: '/products', query: { series: seriesId } })
}

// กดเปิดแล้วส่ง ID ไปหน้า ProDetail
const open = (p) => router.push('/prodetail/' + p.id)

// เพิ่มลงตะกร้าจริง : Backend รู้ว่าใคร login จาก Cookie (401 = ยังไม่ได้ login)
// หมายเหตุ: ตะกร้าเก็บที่ Backend แล้ว (ไม่ใช้ localStorage) หน้า Cart จึงจะเห็นสินค้า
const add = async (p) => {
  try {
    await axios.post(API + '/api/cart', { product_id: p.id, qty: 1 })
    window.dispatchEvent(new Event('cart-updated')) // อัปเดตตัวเลขไอคอนตะกร้า
    alert(`เพิ่ม ${p.name} ลงตะกร้าแล้ว!`)
  } catch (error) {
    if (error.response?.status === 401) {
      alert('กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าลงตะกร้า')
      router.push('/login')
    } else {
      alert(error.response?.data?.message || 'เพิ่มสินค้าลงตะกร้าไม่สำเร็จ')
    }
  }
}

const fav = (p) => {
  const idx = favs.value.indexOf(p.id)
  if(idx > -1) favs.value.splice(idx, 1)
  else favs.value.push(p.id)
}
</script>

<style scoped>
.cats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 0;
  justify-content: center;
}
.cats::-webkit-scrollbar {
  display: none;
}

/* ปรับปุ่มให้เป็นทรงแคปซูลมินิมอล */
.cat-btn {
  padding: 8px 24px; /* ปรับขนาดความกว้าง/สูงของปุ่ม */
  background-color: #ffffff; /* พื้นหลังสีขาวมินิมอล */
  border: 1px solid #e0e0e0; /* เส้นขอบสีเทาอ่อน */
  border-radius: 50px; /* ความมนของปุ่ม (เปลี่ยนเป็น 50px เพื่อให้กลมสนิท) */
  font-size: 15px;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease-in-out;
}

/* เอฟเฟกต์เมื่อเอาเมาส์ชี้ หรือเมื่อถูกเลือก */
.cat-btn:hover {
  background-color: var(--pink, #ff6b81);
  color: #ffffff;
  border-color: var(--pink, #ff6b81);
}

/* จัดโครงสร้าง Grid 5 คอลัมน์ */
.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
  align-items: stretch; /* ให้การ์ดทุกใบสูงเท่ากัน */
}

/* ล็อกขนาดรูปภาพให้พอดีและแสดงข้อมูลด้านล่าง */
.card {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #eee;
}
.thumb {
  width: 100%;
  aspect-ratio: 1 / 1; /* ล็อกกรอบรูปให้เป็นสี่เหลี่ยมจัตุรัสเสมอ */
  position: relative;
  background: #f9f9f9;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.product-img {
  width: 100%;
  height: 100%;
  /* เปลี่ยนจาก cover เป็น contain เพื่อให้ภาพแสดงครบทั้งหมดโดยไม่ถูกตัดขอบ */
  object-fit: contain; 
  display: block;
}

.card-info {
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1; /* ดันปุ่มและข้อมูลให้จัดเรียงพอดีแม้ชื่อสินค้าจะยาวไม่เท่ากัน */
  justify-content: space-between;
}
.card-info h4 { margin: 0 0 8px 0; font-size: 14px; line-height: 1.4; }
.card-info .price { margin: 0 0 16px 0; font-weight: bold; color: #333; }
</style>
