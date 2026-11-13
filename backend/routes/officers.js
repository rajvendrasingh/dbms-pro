const express = require('express');
const router  = express.Router();
const { getAllOfficers, createOfficer, getOfficerStats, updateOfficer } = require('../controllers/officerController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken);

router.get('/',          requireAdmin, getAllOfficers);
router.post('/',         requireAdmin, createOfficer);
router.get('/:id/stats', getOfficerStats);
router.patch('/:id',     requireAdmin, updateOfficer);

module.exports = router;
