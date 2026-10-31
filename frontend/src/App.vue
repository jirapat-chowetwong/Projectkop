<template>
  <header>
    <div class="wrap nav">
      <!-- โลโก้ -->
      <span class="logo" @click="$router.push('/')">KOP MART</span>
      
      <!-- เมนู -->
      <router-link to="/" active-class="on">หน้าแรก</router-link>
      <router-link to="/products" active-class="on">สินค้า</router-link>
      
      <!-- ช่องค้นหา -->
      <div class="search">
        <input type="text" v-model="searchQuery" @keyup.enter="handleSearch" placeholder="ค้นหาสินค้า / คอลเล็กชัน...">
        <!-- กดไอคอนแว่นขยายเพื่อค้นหา (เหมือนกดปุ่ม Enter) -->
        <button type="button" class="ib" style="padding:0" @click="handleSearch" aria-label="ค้นหา">🔍</button>
      </div>
      
      <!-- ไอคอนโปรไฟล์ และ ตะกร้า -->
      <button class="ib" @click="handleProfileClick" aria-label="บัญชี">👤</button>
      <button class="ib" @click="$router.push('/cart')" aria-label="ตะกร้า">
        🛒<span class="badge" v-if="cartCount > 0">{{ cartCount }}</span>
      </button>
    </div>
  </header>
  
  <main class="wrap">
    <!-- จุดแสดงผลเนื้อหาแต่ละหน้า -->
    <router-view></router-view>
  </main>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const route = useRoute()
const cartCount = ref(0) // ตัวแปรเก็บจำนวนสินค้าในตะกร้า
const searchQuery = ref('')

// ให้ช่องค้นหาตรงกับคำค้นใน URL เสมอ (เช่น กด Back หรือออกจากหน้าสินค้า)
watch(() => route.query.q, (q) => { searchQuery.value = q || '' }, { immediate: true })

const handleSearch = () => {
  if (searchQuery.value.trim()) {
    // ถ้ามีการพิมพ์คำค้นหา ให้พาไปหน้าสินค้าและแนบคำค้นหาไปที่ URL
    router.push({ path: '/products', query: { q: searchQuery.value.trim() } })
  } else {
    // ถ้าช่องว่างเปล่า ให้ไปหน้าสินค้าแบบแสดงทั้งหมด
    router.push('/products')
  }
}

// ฟังก์ชันดึงจำนวนสินค้าในตะกร้าจาก Backend (GET /api/cart) ถ้ายังไม่ได้ login จะได้ 401 ให้แสดง 0
const updateCartCount = async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/cart')
    // รวมจำนวนชิ้น (qty) ของสินค้าทุกรายการในตะกร้า (ตะกร้าว่างไม่มี items)
    cartCount.value = (res.data.items || []).reduce((sum, item) => sum + item.qty, 0)
  } catch (error) {
    cartCount.value = 0
  }
}

// เปลี่ยนหน้าแล้วอัปเดตตัวเลขใหม่ (เช่น หลัง login / หลังสั่งซื้อ)
router.afterEach(updateCartCount)

onMounted(() => {
  updateCartCount()
  // ดักจับ Event เมื่อมีการเพิ่ม/ลบ สินค้า
  window.addEventListener('cart-updated', updateCartCount)
})

onUnmounted(() => {
  window.removeEventListener('cart-updated', updateCartCount)
})

// ฟังก์ชันกดปุ่มโปรไฟล์ (ที่คุณเคยทำไว้)
const handleProfileClick = () => {
  const isLoggedIn = localStorage.getItem('isLoggedIn')
  if (isLoggedIn === 'true') {
    router.push('/profile')
  } else {
    router.push('/login')
  }
}
</script>