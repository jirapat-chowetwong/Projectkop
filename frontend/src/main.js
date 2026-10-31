import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // ไฟล์ที่คุณเขียนด้านบน
import './style.css'
import axios from 'axios'

axios.defaults.withCredentials = true /////พีเพิ่ม

const app = createApp(App)
app.use(router)
app.mount('#app')