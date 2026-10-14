const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/regularDutyController');

router.use(authenticate);
router.post('/create', ctrl.createSession);
router.get('/preview', ctrl.preview);
router.put('/:id', ctrl.updateSession);

router.get('/export/pdf', ctrl.exportPDF);
router.get('/export/excel', ctrl.exportExcel);

module.exports = router;
