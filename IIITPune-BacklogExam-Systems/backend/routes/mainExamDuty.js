const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mainExamDutyController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/generate', ctrl.generate);
router.get('/preview', ctrl.getPreview);
router.put('/:id', ctrl.updateDuty);
router.get('/export/pdf', ctrl.exportPDF);
router.get('/export/excel', ctrl.exportExcel);

module.exports = router;
