const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/dutiesController');

// All duty routes require authentication
router.use(authenticate);

router.post('/generate', ctrl.generateDuties);
router.get('/preview', ctrl.previewDuties);
router.put('/:dutyId', ctrl.updateDuty);

router.get('/export/pdf', ctrl.exportPDF);
router.get('/export/excel', ctrl.exportExcel);

module.exports = router;
