const express = require('express');
const router = express.Router();
const resetController = require('../controllers/resetController');
const { authenticate } = require('../middleware/auth');

router.get('/info', authenticate, resetController.getResetInfo);
router.post('/full', authenticate, resetController.resetFull);
router.post('/year', authenticate, resetController.resetYear);

module.exports = router;
