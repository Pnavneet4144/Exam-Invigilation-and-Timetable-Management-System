const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/importController');

// Memory storage since we just need the buffer to parse it, not persist it to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload a .xlsx or .xls file.'));
    }
  }
});

router.use(authenticate);

// Preview endpoints
router.post('/faculty-roster/preview', upload.single('file'), ctrl.facultyRosterPreview);
router.post('/seating-plan/preview', upload.single('file'), ctrl.seatingPlanPreview);
router.post('/backlog-matrix/preview', upload.single('file'), ctrl.backlogMatrixPreview);

// Confirm / Cancel endpoints
router.post('/confirm/:previewId', ctrl.confirmImport);
router.post('/cancel/:previewId', ctrl.cancelImport);

module.exports = router;
