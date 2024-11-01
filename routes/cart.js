const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// แสดงตะกร้าสินค้า
router.get('/', async (req, res) => {
    try {
        const [cartItems] = await pool.query(
            `SELECT cart_items.*, products.name, products.price, products.stock
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

        if (quantity > product.stock) {
            return res.status(400).send('สินค้ามีจำนวนไม่เพียงพอ');
        }

        // ตรวจสอบว่ามีสินค้านี้ในตะกร้าแล้วหรือไม่
        const [[existingItem]] = await pool.query(
            'SELECT * FROM cart_items WHERE session_id = ? AND product_id = ?',
            [req.session.id, productId]
        );

        if (existingItem) {
            // ถ้ามีแล้วให้อัพเดทจำนวน
            const newQuantity = existingItem.quantity + parseInt(quantity);
            if (newQuantity > product.stock) {
                return res.status(400).send('สินค้ามีจำนวนไม่เพียงพอ');
            }
            await pool.query(
                'UPDATE cart_items SET quantity = ? WHERE id = ?',
                [newQuantity, existingItem.id]
            );
        } else {
            // ถ้ายังไม่มีให้เพิ่มใหม่
            await pool.query(
                'INSERT INTO cart_items (session_id, product_id, quantity) VALUES (?, ?, ?)',
                [req.session.id, productId, quantity]
            );
        }

        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error adding to cart');
    }
});

// อัพเดทจำนวนสินค้าในตะกร้า
router.post('/update', async (req, res) => {
    const { cartItemId, quantity } = req.body;
    try {
        // เช็คว่ามีสินค้านี้ในตะกร้าหรือไม่
        const [[cartItem]] = await pool.query(
            `SELECT cart_items.*, products.stock 
             FROM cart_items 
             JOIN products ON cart_items.product_id = products.id 
             WHERE cart_items.id = ? AND cart_items.session_id = ?`,
            [cartItemId, req.session.id]
        );

        if (!cartItem) {
            return res.status(404).send('Cart item not found');
        }

        // ตรวจสอบว่าจำนวนที่ต้องการอัพเดทไม่เกิน stock
        if (quantity > cartItem.stock) {
            return res.status(400).send('สินค้ามีจำนวนไม่เพียงพอ');
        }

        // อัพเดทจำนวนสินค้า
        await pool.query(
            'UPDATE cart_items SET quantity = ? WHERE id = ? AND session_id = ?',
            [quantity, cartItemId, req.session.id]
        );

        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating cart');
    }
});

// ลบสินค้าออกจากตะกร้า
router.post('/remove', async (req, res) => {
    const { cartItemId } = req.body;
    try {
        await pool.query(
            'DELETE FROM cart_items WHERE id = ? AND session_id = ?',
            [cartItemId, req.session.id]
        );
        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error removing item from cart');
    }
});

module.exports = router;