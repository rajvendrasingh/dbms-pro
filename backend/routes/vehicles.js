const express = require('express');
const router  = express.Router();
const {
  registerOwner, registerVehicle, getVehicleByReg,
  getAllVehicles, toggleBlacklist, searchOwners
} = require('../controllers/vehicleController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken);

router.get('/owners/search',  searchOwners);
router.post('/owner',         registerOwner);
router.get('/',               getAllVehicles);
router.post('/',              registerVehicle);
router.get('/:reg',           getVehicleByReg);
router.patch('/:id/blacklist',requireAdmin, toggleBlacklist);

module.exports = router;
