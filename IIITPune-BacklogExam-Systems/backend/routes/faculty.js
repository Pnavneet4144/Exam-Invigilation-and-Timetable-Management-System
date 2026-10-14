const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/facultyController');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/count', ctrl.getCount);
router.get('/:id', ctrl.getById);

router.post('/', ctrl.createFaculty);
router.put('/:id', ctrl.updateFaculty);
router.delete('/:id', ctrl.deleteFaculty);

module.exports = router;
