const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authenticateToken } = require('../middleware/auth');
const authService = require('../services/AuthService');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login requests per `window` per 15 minutes
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true, 
    legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await authService.authenticateUser(username, password);
        res.json(result);
    } catch (error) {
        if (error.message === 'Username and password are required') {
            return res.status(400).json({ error: error.message });
        }
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
