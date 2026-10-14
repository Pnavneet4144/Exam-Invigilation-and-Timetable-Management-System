const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/approvalsController');

// All approval routes require authentication
router.use(authenticate);

// Submit — both editors and superadmin can submit
router.post('/submit', ctrl.submitForApproval);

// Pending — both roles can view pending items
router.get('/pending', ctrl.getPending);

// Approve, Reject, Unlock — superadmin only
router.post('/approve', requireRole('superadmin'), ctrl.approve);
router.post('/reject', requireRole('superadmin'), ctrl.reject);
router.post('/unlock', requireRole('superadmin'), ctrl.unlock);

module.exports = router;
