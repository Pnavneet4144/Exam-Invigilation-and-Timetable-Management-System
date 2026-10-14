const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/roomsController');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/count', ctrl.getCount);
router.get('/:id', ctrl.getById);
router.delete('/:id', ctrl.deleteById);

module.exports = router;
