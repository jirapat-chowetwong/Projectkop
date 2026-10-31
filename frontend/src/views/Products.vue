
<template>
    <!-- PRODUCTS -->
  <div class="crumb"><a @click="go('home')">POP MART</a> › สินค้า</div>
  <div class="pbanner"><div><h1>สินค้าทั้งหมด</h1><p>รวมฟิกเกอร์สุดน่ารักจาก POP MART ที่คุณไม่ควรพลาด</p></div><div style="font-size:90px"></div></div>
  <div class="layout">
    <aside class="side">
      <h3>หมวดหมู่</h3>
      <button class="it" :class="{on:cat === 'ทั้งหมด'}" @click="cat = 'ทั้งหมด'">ทั้งหมด</button>
      <button class="it" v-for="s in seriesList" :key="s.id" :class="{ on: cat === s.id }" @click="cat = s.id">{{ s.name }}</button>
    </aside>
    <div>
      <div class="bar"><b>เรียงตาม</b>
        <select v-model="sort"><option value="pop">ยอดนิยม</option><option value="asc">ราคาต่ำ → สูง</option><option value="desc">ราคาสูง → ต่ำ</option></select>
        <span class="sp"></span>
        <button class="tg" :class="{on:view==='grid'}" @click="view='grid'" aria-label="กริด">▦</button>
        <button class="tg" :class="{on:view==='list'}" @click="view='list'" aria-label="รายการ">☰</button></div>
      <div class="empty" v-if="!filtered.length">ไม่พบสินค้า ลองเปลี่ยนตัวกรองหรือคำค้นหา</div>
      <div class="grid" :class="view"><div class="card" v-for="p in filtered" :key="p.id">
        <div class="thumb" @click="open(p)">
          <img :src="`http://localhost:3000/img_pd/${p.code}.jpg`" class="product_img" alt="">
          <button class="heart" @click.stop="fav(p)">{{favs.includes(p.id)?'♥':'♡'}}</button>
        </div>
        <div style="flex:1"><h4>{{p.name}}</h4><p class="price">฿ {{p.price}}</p>
        <button class="btn" @click="add(p)">เพิ่มใส่ตะกร้า</button></div></div></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter,useRoute } from 'vue-router'
import axios from 'axios';

const router = useRouter()
const route = useRoute()
const sort = ref('pop')
const view = ref('grid')
const favs = ref([])
const products = ref([]) /////พีเพิ่ม
const cat = ref('ทั้งหมด')

const seriesList = ref([])

onMounted(async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/products')
    products.value = res.data.data // หรือปรับตามโครงสร้าง JSON ที่ Backend ส่งกลับมา
    const seriesRes = await axios.get('http://localhost:3000/api/series')
    seriesList.value = seriesRes.data.data
    // มาจากหน้าแรก (กดหมวดหมู่) : /products?series=ID --> เลือกหมวดนั้นให้เลย
    if (route.query.series) cat.value = Number(route.query.series)
  } catch (err) {
    console.error('ไม่สามารถดึงข้อมูลสินค้าได้:', err.message)
  }
})

const filtered = computed(() => {
  // กรองตาม Series (ถ้า activeSeries เป็น null คือไม่กรอง แสดงทั้งหมด)
  const searchKeyword = route.query.q ? route.query.q.toLowerCase() : ''
  let l = products.value.filter(p => {
    const matchCat = cat.value === 'ทั้งหมด' || p.series_id === cat.value
    const matchSearch = !searchKeyword || 
                        p.name.toLowerCase().includes(searchKeyword) || 
                        String(p.series_name || '').toLowerCase().includes(searchKeyword) // series_id เป็นตัวเลข ใช้ .toLowerCase() ไม่ได้ จึงค้นจากชื่อซีรีส์แทน
    
    // ต้องตรงทั้งหมวดหมู่ และ คำค้นหา
    return matchCat && matchSearch
  })
  
  // จัดเรียงตามราคา
  if(sort.value === 'asc') l.sort((a,b) => a.price - b.price)
  if(sort.value === 'desc') l.sort((a,b) => b.price - a.price)
  
  return l
})

const go = (path) => router.push('/' + path)
const open = (p) => router.push('/prodetail/'+ p.id)
const fav = (p) => {
  const idx = favs.value.indexOf(p.id)
  if(idx > -1) favs.value.splice(idx, 1)
  else favs.value.push(p.id)
}

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