const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// แสดงตะกร้าสินค้า
router.get('/', async (req, res) => {
    try {
        const [cartItems] = await pool.query(
            `SELECT cart_items.*, products.name, products.price 
             FROM cart_items 
             JOIN products ON cart_items.product_id = products.id 
             WHERE session_id = ?`,
            [req.session.id]
        );
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        res.render('cart', { cartItems, total });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching cart');
    }
});

// เพิ่มสินค้าลงตะกร้า
router.post('/add', async (req, res) => {
    const { productId, quantity } = req.body;
    try {
        // เช็คจำนวน stock ของสินค้า
        const [[product]] = await pool.query('SELECT stock FROM products WHERE id = ?', [productId]);

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // ตรวจสอบว่าจำนวนที่ต้องการเพิ่มมากกว่าจำนวน stock หรือไม่
        if (quantity > product.stock) {
            return res.status(400).send('สินค้ามีจำนวนไม่เพียงพอ');
        }

        // เพิ่มสินค้าลงใน cart
        await pool.query(
            'INSERT INTO cart_items (session_id, product_id, quantity) VALUES (?, ?, ?)',
            [req.session.id, productId, quantity]
        );

        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error adding to cart');
    }
});

module.exports = router;
