import express from 'express';

import * as productC from "../controllers/productController.js"
import { requireAdmin } from "../middleware/auth.js"

const router = express.Router();  

router.get('/products/', productC.getAllProduct);
router.get('/products/:id', productC.getProductById);
router.get('/series/',productC.getAllSeries);
router.get('/series/:id',productC.getSeriesById);

// เพิ่ม/แก้/ลบสินค้า ใช้ได้เฉพาะ admin
router.post('/products/', requireAdmin, productC.postProduct);
router.put('/products/:id', requireAdmin, productC.putProduct);
router.delete('/products/:id', requireAdmin, productC.deleteProduct);
router.post('/products/:id/image', requireAdmin, productC.uploadProductImage);

export default router;