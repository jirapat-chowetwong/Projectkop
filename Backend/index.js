// index.js - main entry point (Express server)
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { testConnection } from './services/db.js';
//พีรวมให้มีแค่ productRoute
import productsRoute from './routes/productRoute.js';
import cartRoute from './routes/cartRoute.js';
import memberRoute from './routes/memberRoute.js';
import cookieParser from 'cookie-parser';
import { readToken } from './middleware/auth.js';

dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- middleware ----------
// ส่ง Cookie ข้าม origin ได้ ต้องระบุ origin ของ Frontend และเปิด credentials
// (ถ้าใช้ cors() เปล่า ๆ หรือ origin: '*' Browser จะไม่ยอมส่ง Cookie token มาให้ Backend)
// ต้องเปิดหน้าเว็บที่พอร์ต 5173 (หรือ 4173 ตอน vite preview) ถึงจะอยู่ในรายการนี้
app.use(cors({
  origin: ['http://localhost','http://127.0.0.1','http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser()); // อ่าน Cookie ที่ Browser ส่งมา ให้เรียกใช้ผ่าน req.cookies.token
app.use(readToken);     // อ่าน Token แล้วใส่ req.user ให้ route อื่น (เช่น ตะกร้า) รู้ว่าใคร login อยู่

// ส่วนที่ พีทำ
app.use("/img_pd",express.static("img_pd")) 
app.use("/img_mem",express.static("img_mem"))


// ---------- routes ----------
app.get('/', (req, res) => {
  res.json({ message: 'Mart API is running' });
});

// health check: confirms the API and the database are both up
app.get('/health', async (req, res) => {
  try {
    const serverTime = await testConnection();
    res.json({ status: 'ok', database: 'connected', serverTime });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unreachable', message: err.message });
  }
});

app.use('/api/', productsRoute);
app.use('/api/',cartRoute);
app.use('/api/', memberRoute);

// ---------- 404 + error handling ----------
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ---------- start ----------
app.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  try {
    const serverTime = await testConnection();
    console.log('PostgreSQL connected, server time:', serverTime);
    // ถ้าไม่มี SECRET_KEY สมัครสมาชิกได้ แต่ login จะล้ม (สร้าง Token ไม่ได้) จึงเตือนให้เห็นชัดตั้งแต่เปิดเซิร์ฟเวอร์
    if (!process.env.SECRET_KEY)
      console.error('WARNING: SECRET_KEY is missing in .env --> login will fail. Add a line like SECRET_KEY=any-long-random-text');
  } catch (err) {
    console.error('PostgreSQL connection FAILED:', err.message);
    console.error('Check DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD in your .env file');
  }
});