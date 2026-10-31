// cart.js : ตะกร้าสินค้าสำหรับคนที่ยังไม่ได้ login (Guest) ใช้ร่วมกันทุกหน้า
//   - ยังไม่ login : เก็บตะกร้าไว้ใน localStorage ของเบราว์เซอร์
//   - login แล้ว    : เก็บที่ Backend (POST /api/cart) ตามเดิม
//   - ตอน login สำเร็จ : เรียก mergeGuestCart() ย้ายสินค้าในตะกร้า Guest เข้า Backend
// การสั่งซื้อ (checkout) ยังต้อง login เสมอ
import axios from 'axios'
import { API } from './api.js'

const KEY = 'kop_guest_cart'

// อ่านตะกร้า Guest : [{ product_id, code, name, price, stock, qty }]
export const loadGuestCart = () => {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(items) ? items : []
  } catch { return [] }
}

const save = (items) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* เบราว์เซอร์ไม่ให้เก็บข้อมูล : ข้าม */ }
}

export const clearGuestCart = () => save([])

// จำนวนชิ้นรวมในตะกร้า Guest (ใช้แสดงเลขบนไอคอนตะกร้า)
export const guestCount = () => loadGuestCart().reduce((s, i) => s + i.qty, 0)

// เพิ่มสินค้า p = { id, code, name, price, stock } ลงตะกร้า Guest (ถ้ามีแล้วบวกจำนวน แต่ไม่เกินสต็อก)
export const addGuestItem = (p, qty = 1) => {
  const items = loadGuestCart()
  const stock = Number(p.stock)
  const max = Number.isFinite(stock) && stock > 0 ? stock : Infinity
  const old = items.find(i => i.product_id === p.id)
  if (old) old.qty = Math.min(old.qty + qty, max)
  else items.push({ product_id: p.id, code: p.code, name: p.name, price: Number(p.price), stock: Number.isFinite(stock) ? stock : null, qty: Math.min(qty, max) })
  save(items)
}

// ตั้งจำนวนของสินค้าในตะกร้า Guest (ไม่น้อยกว่า 1 และไม่เกินสต็อก)
export const setGuestQty = (productId, qty) => {
  const items = loadGuestCart()
  const it = items.find(i => i.product_id === productId)
  if (!it) return
  const max = it.stock > 0 ? it.stock : Infinity
  it.qty = Math.max(1, Math.min(qty, max))
  save(items)
}

export const removeGuestItem = (productId) => save(loadGuestCart().filter(i => i.product_id !== productId))

// เพิ่มลงตะกร้า : ลอง Backend ก่อน ถ้า 401 (ยังไม่ login) เก็บลงตะกร้า Guest แทน
// คืนค่า 'member' หรือ 'guest' / ข้อผิดพลาดอื่น (เช่น สินค้าไม่พอ) ส่งต่อให้หน้าที่เรียกแสดงเอง
export async function addToCart(p, qty = 1) {
  try {
    await axios.post(API + '/api/cart', { product_id: p.id, qty }, { withCredentials: true })
    window.dispatchEvent(new Event('cart-updated'))
    return 'member'
  } catch (error) {
    if (error.response?.status !== 401) throw error
    addGuestItem(p, qty)
    window.dispatchEvent(new Event('cart-updated'))
    return 'guest'
  }
}

export const addedMessage = (p, mode) => mode === 'guest'
  ? `เพิ่ม ${p.name} ลงตะกร้าแล้ว!\n(ยังไม่ได้เข้าสู่ระบบ ต้องเข้าสู่ระบบก่อนจึงจะสั่งซื้อได้)`
  : `เพิ่ม ${p.name} ลงตะกร้าแล้ว!`

// ย้ายตะกร้า Guest เข้า Backend หลัง login : คืน { added, failed } แล้วล้างตะกร้า Guest
// (รายการที่เพิ่มไม่สำเร็จ เช่น สินค้าหมด จะถูกนับใน failed)
export async function mergeGuestCart() {
  const items = loadGuestCart()
  let added = 0, failed = 0
  for (const it of items) {
    try {
      await axios.post(API + '/api/cart', { product_id: it.product_id, qty: it.qty }, { withCredentials: true })
      added++
    } catch { failed++ }
  }
  clearGuestCart()
  if (items.length) window.dispatchEvent(new Event('cart-updated'))
  return { added, failed }
}
