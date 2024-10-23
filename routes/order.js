const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// แสดงประวัติออเดอร์ทั้งหมด
router.get('/history', async (req, res) => {
    try {
        // ดึงข้อมูลออเดอร์พร้อมรายละเอียดสินค้า
        const [orders] = await pool.query(
            `SELECT 
                orders.id,
                orders.total_amount,
                orders.status,
                orders.shipping_address,
                orders.created_at,
                GROUP_CONCAT(
                    CONCAT(
                        products.name,
                        ' x ',
                        order_items.quantity,
                        ' (฿',
                        order_items.price,
                        ')'
                    ) SEPARATOR ', '
                ) as items_detail
            FROM orders
            JOIN order_items ON orders.id = order_items.order_id
            JOIN products ON order_items.product_id = products.id
            WHERE orders.session_id = ?
            GROUP BY orders.id
            ORDER BY orders.created_at DESC`,
            [req.session.id]
        );

        res.render('order-history', { orders });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching order history');
    }
});

// ดูรายละเอียดออเดอร์เดี่ยว
router.get('/detail/:orderId', async (req, res) => {
    try {
        // ดึงข้อมูลออเดอร์
        const [orders] = await pool.query(
            'SELECT * FROM orders WHERE id = ? AND session_id = ?',
            [req.params.orderId, req.session.id]
        );

        if (orders.length === 0) {
            return res.status(404).send('Order not found');
        }

        const order = orders[0];

        // ดึงรายละเอียดสินค้าในออเดอร์
        const [items] = await pool.query(
            `SELECT 
                order_items.*,
                products.name,
                products.image_url
            FROM order_items
            JOIN products ON order_items.product_id = products.id
            WHERE order_items.order_id = ?`,
            [req.params.orderId]
        );

        res.render('order-detail', { order, items });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching order details');
    }
});
// หน้า checkout
router.get('/checkout', async (req, res) => {
    try {
        const [cartItems] = await pool.query(
            `SELECT cart_items.*, products.name, products.price 
             FROM cart_items 
             JOIN products ON cart_items.product_id = products.id 
             WHERE session_id = ?`,
            [req.session.id]
        );
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        res.render('checkout', { cartItems, total });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading checkout');
    }
});

// สร้าง order
router.post('/create', async (req, res) => {
    const { address } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Get cart items
        const [cartItems] = await conn.query(
            `SELECT cart_items.*, products.price 
             FROM cart_items 
             JOIN products ON cart_items.product_id = products.id 
             WHERE session_id = ?`,
            [req.session.id]
        );

        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Create order
        const [order] = await conn.query(
            'INSERT INTO orders (session_id, total_amount, status, shipping_address) VALUES (?, ?, ?, ?)',
            [req.session.id, total, 'pending', address]
        );

        // Create order items
        for (const item of cartItems) {
            await conn.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [order.insertId, item.product_id, item.quantity, item.price]
            );
            
            // Update stock
            await conn.query(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        // Clear cart
        await conn.query('DELETE FROM cart_items WHERE session_id = ?', [req.session.id]);

        await conn.commit();
        res.redirect('/order/confirmation');
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).send('Error creating order');
    } finally {
        conn.release();
    }
});

// หน้ายืนยันการสั่งซื้อ
router.get('/confirmation', (req, res) => {
    res.render('confirmation');
});

module.exports = router;
