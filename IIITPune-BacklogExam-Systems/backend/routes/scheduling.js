const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/schedulingController');

// All scheduling routes require authentication
router.use(authenticate);

router.post('/suggest-pacing', ctrl.suggestPacing);
router.put('/pacing/:studentId', ctrl.updatePacing);
router.post('/generate', ctrl.generate);
router.get('/preview', ctrl.previewSchedule);
router.put('/exam/:examScheduleId', ctrl.updateExam);

// Time Slots routes
router.get('/time-slots', ctrl.getTimeSlots);
router.post('/time-slots', ctrl.addTimeSlot);
router.delete('/time-slots/:id', ctrl.deleteTimeSlot);

router.get('/export/pdf', ctrl.exportPDF);
router.get('/export/excel', ctrl.exportExcel);

module.exports = router;
