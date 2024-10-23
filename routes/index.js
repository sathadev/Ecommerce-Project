const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products');
        res.render('index', { products });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching products');
    }
});

module.exports = router;
