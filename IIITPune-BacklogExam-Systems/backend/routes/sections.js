const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/sectionsController');

router.use(authenticate);
router.get('/', ctrl.getSections);
router.post('/', ctrl.createSection);
router.delete('/:id', ctrl.deleteSection);

module.exports = router;
