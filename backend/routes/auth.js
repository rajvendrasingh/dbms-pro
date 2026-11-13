const express = require('express');
const router  = express.Router();
const { login, changePassword, getMe } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login',           login);
router.post('/change-password', verifyToken, changePassword);
router.get('/me',               verifyToken, getMe);

module.exports = router;
