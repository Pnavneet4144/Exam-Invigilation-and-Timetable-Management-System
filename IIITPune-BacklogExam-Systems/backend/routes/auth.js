const express = require('express');
const router = express.Router();
const { loginAdmin, loginStaff, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login/admin', loginAdmin);
router.post('/login/staff', loginStaff);
router.get('/me', authenticate, getMe);

module.exports = router;
