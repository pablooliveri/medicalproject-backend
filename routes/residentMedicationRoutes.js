const express = require('express');
const router = express.Router();
const {
  getResidentMedications,
  getResidentMedication,
  assignMedication,
  updateMedication,
  deactivateMedication,
  reactivateMedication
} = require('../controllers/residentMedicationController');
const { protect } = require('../middleware/auth');
const { tenant } = require('../middleware/tenant');

router.use(protect, tenant);

router.route('/').get(getResidentMedications).post(assignMedication);
router.route('/:id').get(getResidentMedication).put(updateMedication);
router.put('/:id/deactivate', deactivateMedication);
router.put('/:id/reactivate', reactivateMedication);

module.exports = router;
