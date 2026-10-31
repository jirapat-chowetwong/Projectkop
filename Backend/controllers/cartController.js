import database from "../services/db.js"

export async function getCart(req, res, next) {
    const memberId = (req.user ? req.user.id : null);
    
    //const memberId = req.user ? req.user.id : null; เอาไว้ทดสอบ กรณี ยิง url
    if (!memberId) {
       return res.status(401).json({ success: false, message: "Unauthorized, please login" });
    }

    console.log(`GET /api/cart requested by member ${memberId}`);
    try {
        // ค้นหาตะกร้าที่สถานะยังเป็น pending ของ Member คนนี้
        const cartResult = await database.query(
            `SELECT * FROM "orders" WHERE "member_id" = $1 AND "status" = 'pending'`,
            [memberId]
        );

        if (cartResult.rowCount === 0) {
            return res.status(200).json({ message: "Cart is empty", data: { items: [], total_amount: 0 } });
        }

        const cart = cartResult.rows[0];

        // ดึงรายการสินค้าในตะกร้า พร้อมข้อมูลสินค้า (products)
        const itemsResult = await database.query(
            `SELECT oi.id AS item_id, oi.qty, oi.unit_price, 
                    p.id AS product_id, p.code, p.name, p.price, p.stock
             FROM "order_items" oi
             JOIN "products" p ON p.id = oi.product_id
             WHERE oi.order_id = $1`,
            [cart.id]
        );

        const totalAmount = itemsResult.rows.reduce((sum, item) => {
            return sum + (Number(item.qty) * Number(item.unit_price));
        }, 0);

        res.json({
            cart_id: cart.id,   
            order_no: cart.order_no,
            total_amount: totalAmount.toFixed(2),
            items: itemsResult.rows
        });
    } catch (err) {
        next(err);
    }
}

export async function addToCart(req, res, next) {
    try {
        //const memberId = req.user ? req.user.id : null; เอาไว้ทดสอบ กรณี ยิง url
        const memberId = req.user ? req.user.id : null;
        const { product_id, qty } = req.body;

        if (!memberId) {
            return res.status(401).json({ success: false, message: "Unauthorized, please login" });
        }

        if (!product_id || !qty || qty <= 0) {
            return res.status(400).json({ success: false, message: "Invalid product_id or quantity" });
        }

        // 1. ตรวจสอบว่าสินค้ามีอยู่และราคาเท่าไหร่ (ดึง price มาเก็บไว้เป็น unit_price)
        const productQuery = `SELECT * FROM "products" WHERE "id" = $1 AND "is_active" = true`;
        const productResult = await database.query(productQuery, [product_id]);
        
        if (productResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found or inactive" });
        }
        const product = productResult.rows[0];

        let cartId;
        const cartResult = await database.query(
            `SELECT * FROM "orders" WHERE "member_id" = $1 AND "status" = 'pending'`,
            [memberId]
        );

        if (cartResult.rows.length > 0) {
            cartId = cartResult.rows[0].id;
        } else {
            try {
                const createCartQuery = `INSERT INTO "orders" ("member_id", "status") VALUES ($1, 'pending') RETURNING id`;
                const newCart = await database.query(createCartQuery, [memberId]);
                cartId = newCart.rows[0].id;
            } catch (err) {
                // ถ้าจังหวะชนกันพอดี ให้ดึงตะกร้าที่มีอยู่แล้วขึ้นมาใช้แทน
                if (err.code === '23505') { 
                    const retryResult = await database.query(
                        `SELECT * FROM "orders" WHERE "member_id" = $1 AND "status" = 'pending'`,
                        [memberId]
                    );
                    cartId = retryResult.rows[0].id;
                } else {
                    throw err; // ถ้าเป็น Error อื่นให้โยนออกไปตามปกติ
                }
            }
        }

        // 3. ตรวจสอบว่ามีสินค้านี้อยู่ในตะกร้าหรือยัง
        const itemCheckQuery = `SELECT * FROM "order_items" WHERE "order_id" = $1 AND "product_id" = $2`;
        const itemCheckResult = await database.query(itemCheckQuery, [cartId, product_id]);

        if (itemCheckResult.rows.length > 0) {
            // ถ้ามีอยู่แล้วให้อัปเดตจำนวน (qty) เพิ่มขึ้น
            const updateItemQuery = `
                UPDATE "order_items" 
                SET "qty" = "qty" + $1 
                WHERE "order_id" = $2 AND "product_id" = $3 
                RETURNING *
            `;
            await database.query(updateItemQuery, [qty, cartId, product_id]);
        } else {
            // ถ้ายังไม่มีให้ INSERT รายการใหม่ พร้อมบันทึก unit_price (ราคา ณ ปัจจุบันที่กดซื้อ)
            const insertItemQuery = `
                INSERT INTO "order_items" ("order_id", "product_id", "qty", "unit_price") 
                VALUES ($1, $2, $3, $4) 
                RETURNING *
            `;
            await database.query(insertItemQuery, [cartId, product_id, qty, product.price]);
        }

        // 4. อัปเดตยอดรวม (total_amount) ในตาราง orders ทันที
        await database.query(
            `UPDATE "orders" 
             SET "total_amount" = (
                 SELECT COALESCE(SUM(qty * unit_price), 0) 
                 FROM "order_items" 
                 WHERE "order_id" = $1
             ) 
             WHERE "id" = $1`,
            [cartId]
        );

        res.status(200).json({ success: true, message: "Product added to cart successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
}

export async function removeCartItem(req, res, next) {
    try {
        //const memberId = req.user ? req.user.id : null; เอาไว้ทดสอบ กรณี ยิง url
        const memberId = req.user ? req.user.id : null;
        const { itemId } = req.params;

        if (!memberId) {
            return res.status(401).json({ success: false, message: "Unauthorized, please login" });
        }

        // ตรวจสอบว่า item นี้อยู่ในตะกร้าที่เป็น pending ของ member คนนี้จริงหรือไม่
        const checkQuery = `
            SELECT oi.id, oi.order_id 
            FROM "order_items" oi
            JOIN "orders" o ON oi.order_id = o.id
            WHERE oi.id = $1 AND o.member_id = $2 AND o.status = 'pending'
        `;
        const checkResult = await database.query(checkQuery, [itemId, memberId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Item not found in pending cart" });
        }

        const cartId = checkResult.rows[0].order_id;

        // ลบสินค้าออกจาก order_items
        await database.query(`DELETE FROM "order_items" WHERE "id" = $1`, [itemId]);

        const checkRemainingQuery = `SELECT COUNT(*) FROM "order_items" WHERE "order_id" = $1`;
        const remainingResult = await database.query(checkRemainingQuery, [cartId]);
        const remainingCount = parseInt(remainingResult.rows[0].count, 10);

        if (remainingCount === 0) {
            // ถ้าไม่เหลือสินค้าแล้ว ให้ลบตัวตะกร้า (orders) ทิ้งไปเลย
            await database.query(`DELETE FROM "orders" WHERE "id" = $1`, [cartId]);
            
            return res.status(200).json({ 
                success: true, 
                message: "Item removed. Cart is now empty and has been deleted." 
            });
        } else {
            // ถ้ายังมีสินค้าชิ้นอื่นเหลืออยู่ ให้อัปเดตยอดรวม (total_amount) ตามปกติ
            await database.query(
                `UPDATE "orders" 
                 SET "total_amount" = (
                     SELECT COALESCE(SUM(qty * unit_price), 0) 
                     FROM "order_items" 
                     WHERE "order_id" = $1
                 ) 
                 WHERE "id" = $1`,
                [cartId]
            );

            return res.status(200).json({ 
                success: true, 
                message: "Item removed from cart successfully" 
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
}

export async function clearCart(req, res, next) {
    try {
        //const memberId = req.user ? req.user.id : null; เอาไว้ทดสอบ กรณี ยิง url
        const memberId = req.user ? req.user.id : null;   

        if (!memberId) {
            return res.status(401).json({ success: false, message: "Unauthorized, please login" });
        }

        // 1. ค้นหาตะกร้าสถานะ pending ของสมาชิกคนนี้
        const cartResult = await database.query(
            `SELECT * FROM "orders" WHERE "member_id" = $1 AND "status" = 'pending'`,
            [memberId]
        );

        if (cartResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: "No active cart found for this member" });
        }

        const cartId = cartResult.rows[0].id;

        // 2. ลบรายการสินค้าทั้งหมดในตะกร้า (order_items) 
        // (เนื่องจากตั้งค่า ON DELETE CASCADE ไว้ในตาราง order_items จะลบอัตโนมัติเมื่อลบ orders แต่สั่งลบตรงนี้ไว้เพื่อความปลอดภัยได้)
        await database.query(`DELETE FROM "order_items" WHERE "order_id" = $1`, [cartId]);

        // 3. ลบตัวตะกร้าสินค้าหลักออกไปเลย (หรือจะใช้วิธีเคลียร์ยอดรวมก็ได้ แต่การลบตาราง orders ออกจะทำให้สร้างตะกร้าใหม่ได้สะอาดขึ้น)
        await database.query(`DELETE FROM "orders" WHERE "id" = $1`, [cartId]);

        res.status(200).json({ 
            success: true, 
            message: "Cart cleared successfully" 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
}

export async function checkoutCart(req, res, next) {
    const client = await database.connect(); // ใช้ client แยกสำหรับ Transaction
    try {
        await client.query('BEGIN'); // เริ่ม Transaction

        //const memberId = req.user ? req.user.id : null; เอาไว้ทดสอบ กรณี ยิง url
        const memberId = req.user ? req.user.id : null;
        if (!memberId) {
            await client.query('ROLLBACK');
            return res.status(401).json({ success: false, message: "Unauthorized, please login" });
        }

        // 1. ค้นหาตะกร้า pending
        const cartResult = await client.query(
            `SELECT * FROM "orders" WHERE "member_id" = $1 AND "status" = 'pending' FOR UPDATE`,
            [memberId]
        );
        if (cartResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "No active pending cart found" });
        }
        const cart = cartResult.rows[0];

        // 2. ดึงรายการสินค้าในตะกร้า
        const itemsResult = await client.query(
            `SELECT * FROM "order_items" WHERE "order_id" = $1`,
            [cart.id]
        );
        if (itemsResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Cannot checkout an empty cart" });
        }

        // 3. วนลูปเช็คและตัดสต็อกสินค้าแต่ละชิ้น
        for (const item of itemsResult.rows) {
            const productRes = await client.query(
                `SELECT stock FROM "products" WHERE "id" = $1 FOR UPDATE`,
                [item.product_id]
            );
            const currentStock = productRes.rows[0].stock;

            if (currentStock < item.qty) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: `Product ID ${item.product_id} is out of stock or insufficient quantity.` 
                });
            }

            // ตัดสต็อกจริง
            await client.query(
                `UPDATE "products" SET "stock" = "stock" - $1, "updated_at" = NOW() WHERE "id" = $2`,
                [item.qty, item.product_id]
            );
        }

        // 4. เปลี่ยนสถานะ order เป็น confirmed
        const updateOrderQuery = `
            UPDATE "orders" 
            SET "status" = 'confirmed', "confirmed_at" = NOW(),
                "total_amount" = (SELECT COALESCE(SUM(qty * unit_price), 0) FROM "order_items" WHERE "order_id" = $1)
            WHERE "id" = $1 
            RETURNING id, order_no, member_id, status, total_amount, created_at, confirmed_at
        `;
        const updatedOrderResult = await client.query(updateOrderQuery, [cart.id]);

        await client.query('COMMIT'); // ยืนยัน Transaction ทั้งหมด
        res.status(200).json({
            success: true,
            message: "Checkout successful and stock updated.",
            data: updatedOrderResult.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK'); // ยกเลิกหากเกิด Error
        console.error(error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    } finally {
        client.release(); // คืน Connection กลับพูล
    }
}

export async function getOrders(req, res, next) {
    try {
        //const memberId = req.user ? req.user.id : null; เอาไว้ทดสอบ กรณี ยิง url
        const memberId = req.user ? req.user.id : null;

        if (!memberId) {
            return res.status(401).json({ success: false, message: "Unauthorized, please login" });
        }

        // ตรวจสอบสิทธิ์ (role) ของผู้ใช้งานจากตาราง members
        const memberQuery = `SELECT role FROM "members" WHERE "id" = $1`;
        const memberResult = await database.query(memberQuery, [memberId]);

        if (memberResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Member not found" });
        }

        const userRole = memberResult.rows[0].role;
        let ordersQuery = '';
        let queryParams = [];

        // ถ้าเป็น Admin สามารถดูรายการสั่งซื้อทั้งหมดได้
        if (userRole === 'admin') {
            // Admin สามารถเลือกกรองดูเฉพาะสมาชิกคนใดคนหนึ่งได้ (เช่น ?target_member_id=3) หรือจะไม่กรองเพื่อดูทั้งหมดก็ได้
            const targetMemberId = req.query.target_member_id;
            
            if (targetMemberId) {// Admin อยากดูเฉพาะเจาะจงของสมาชิกคนใดคนหนึ่ง
                ordersQuery = `
                    SELECT o.*, m.name AS member_name, m.email AS member_email 
                    FROM "orders" o
                    JOIN "members" m ON o.member_id = m.id
                    WHERE o.member_id = $1
                    ORDER BY o.created_at DESC
                `;
                queryParams = [targetMemberId];
            } else {    // Admin ไม่ได้กรอง อยากดูคำสั่งซื้อทั้งหมดของทุกคนในระบบ
                ordersQuery = `
                    SELECT o.*, m.name AS member_name, m.email AS member_email 
                    FROM "orders" o
                    JOIN "members" m ON o.member_id = m.id
                    ORDER BY o.created_at DESC
                `;
            }
        } else {
            // ถ้าเป็น Member ทั่วไป จะดูได้เฉพาะคำสั่งซื้อของตัวเองเท่านั้น
            ordersQuery = `
                SELECT o.*, m.name AS member_name, m.email AS member_email 
                FROM "orders" o
                JOIN "members" m ON o.member_id = m.id
                WHERE o.member_id = $1
                ORDER BY o.created_at DESC
            `;
            queryParams = [memberId];
        }

        const ordersResult = await database.query(ordersQuery, queryParams);

        res.status(200).json({
            success: true,
            role: userRole,
            count: ordersResult.rows.length,
            data: ordersResult.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
}

export async function getOrderDetail(req, res, next) {
    try {
        //const memberId = req.user ? req.user.id : null; เอาไว้ทดสอบ กรณี ยิง url
        const memberId = req.user ? req.user.id : null;
        const { orderId } = req.params;

        if (!memberId) {
            return res.status(401).json({ success: false, message: "Unauthorized, please login" });
        }

        // 1. ตรวจสอบสิทธิ์ (role) ของผู้ใช้งานจากตาราง members
        const memberQuery = `SELECT role FROM "members" WHERE "id" = $1`;
        const memberResult = await database.query(memberQuery, [memberId]);

        if (memberResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Member not found" });
        }

        const userRole = memberResult.rows[0].role;

        // 2. ดึงข้อมูลคำสั่งซื้อ (order) ตาม orderId พร้อมข้อมูลเจ้าของออเดอร์
        const orderQuery = `
            SELECT o.*, m.name AS member_name, m.email AS member_email 
            FROM "orders" o
            JOIN "members" m ON o.member_id = m.id
            WHERE o.id = $1
        `;
        const orderResult = await database.query(orderQuery, [orderId]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const order = orderResult.rows[0];

        // 3. ตรวจสอบความปลอดภัย: ถ้าไม่ใช่ Admin และไม่ใช่เจ้าของออเดอร์นี้ ห้ามดู
        if (userRole !== 'admin' && order.member_id !== Number(memberId)) {
            return res.status(403).json({ success: false, message: "Access denied. You can only view your own orders." });
        }

        // 4. ดึงรายการสินค้าทั้งหมดในออเดอร์นั้น (จาก order_items และ join กับ products)
        const itemsQuery = `
            SELECT oi.id AS item_id, oi.qty, oi.unit_price, 
                   p.id AS product_id, p.code, p.name, p.price, p.stock
            FROM "order_items" oi
            JOIN "products" p ON p.id = oi.product_id
            WHERE oi.order_id = $1
        `;
        const itemsResult = await database.query(itemsQuery, [orderId]);

        // 5. ส่งผลลัพธ์ข้อมูลเชิงลึกกลับไป
        res.status(200).json({
            success: true,
            data: {
                order_id: order.id,
                order_no: order.order_no,
                member_id: order.member_id,
                member_name: order.member_name,
                member_email: order.member_email,
                status: order.status,
                total_amount: order.total_amount,
                created_at: order.created_at,
                confirmed_at: order.confirmed_at,
                items: itemsResult.rows
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
}

export async function getOrdersByMember(req, res, next) {
    try {
        //const memberId = req.user ? req.user.id : null; เอาไว้ทดสอบ กรณี ยิง url
        const requesterId = req.user ? req.user.id : null;
        const { memberId } = req.params; // รหัสของลูกค้าที่ต้องการดูประวัติ

        if (!requesterId) {
            return res.status(401).json({ success: false, message: "Unauthorized, please login" });
        }

        // 1. ตรวจสอบสิทธิ์ (role) ของผู้ที่ส่งคำขอเข้ามาจากตาราง members
        const requesterQuery = `SELECT role FROM "members" WHERE "id" = $1`;
        const requesterResult = await database.query(requesterQuery, [requesterId]);

        if (requesterResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Requester member not found" });
        }

        const userRole = requesterResult.rows[0].role;

        // 2. ตรวจสอบความปลอดภัย: ถ้าไม่ใช่ Admin และกำลังพยายามดูประวัติของคนอื่น จะต้องไม่อนุญาต
        if (userRole !== 'admin' && Number(requesterId) !== Number(memberId)) {
            return res.status(403).json({ success: false, message: "Access denied. You can only view your own order history." });
        }

        // 3. ตรวจสอบว่าเป้าหมาย (memberId) มีอยู่จริงไหม และดึงข้อมูลโปรไฟล์ลูกค้ามาด้วย
        const targetMemberQuery = `SELECT id, name, email, phone FROM "members" WHERE "id" = $1`;
        const targetMemberResult = await database.query(targetMemberQuery, [memberId]);

        if (targetMemberResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Target member not found" });
        }

        const targetMember = targetMemberResult.rows[0];

        // 4. ดึงรายการคำสั่งซื้อทั้งหมดของสมาชิกคนนี้ (เช่น เฉพาะที่ confirmed หรือทั้งหมด)
        const ordersQuery = `
            SELECT * FROM "orders" 
            WHERE "member_id" = $1 
            ORDER BY "created_at" DESC
        `;
        const ordersResult = await database.query(ordersQuery, [memberId]);

        // 5. ส่งข้อมูลประวัติการซื้อกลับไป
        res.status(200).json({
            success: true,
            member_info: targetMember,
            total_orders: ordersResult.rows.length,
            data: ordersResult.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
}