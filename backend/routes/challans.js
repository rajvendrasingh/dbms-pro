const express = require('express');
const router  = express.Router();
const {
  issueChallan, getAllChallans, getChallanById,
  getChallansByVehicle, payChallan, updateStatus, getDashboardStats
} = require('../controllers/challanController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken);

router.get('/stats/dashboard',         getDashboardStats);
router.get('/',                        getAllChallans);
router.post('/',                       issueChallan);
router.get('/vehicle/:reg',            getChallansByVehicle);
router.get('/:id',                     getChallanById);
router.post('/:id/pay',                payChallan);
router.patch('/:id/status',            requireAdmin, updateStatus);

module.exports = router;
