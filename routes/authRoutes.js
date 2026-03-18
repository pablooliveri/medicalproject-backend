const express = require('express');
const router = express.Router();
const { login, register, getProfile, seedAdmin } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', protect, register);
router.get('/profile', protect, getProfile);
router.post('/seed', seedAdmin);

module.exports = router;
