const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { parseFile } = require('../utils/fileParser');
const ctrl = require('../controllers/uploadController');

// Configure multer to store files in memory (no disk writes needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    // Also check extension since MIME types can be unreliable
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowedTypes.includes(file.mimetype) || ['csv', 'xlsx', 'xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload a .csv or .xlsx file.'));
    }
  }
});

// Middleware to parse the uploaded file into rows
const parseUploadedFile = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    req.parsedRows = parseFile(req.file.buffer, req.file.originalname);
    if (req.parsedRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded file contains no data rows.' });
    }
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

router.use(authenticate);
router.post('/students', upload.single('file'), parseUploadedFile, ctrl.uploadStudents);
router.post('/subjects', upload.single('file'), parseUploadedFile, ctrl.uploadSubjects);
router.post('/rooms', upload.single('file'), parseUploadedFile, ctrl.uploadRooms);
router.post('/faculty', upload.single('file'), parseUploadedFile, ctrl.uploadFaculty);

module.exports = router;
