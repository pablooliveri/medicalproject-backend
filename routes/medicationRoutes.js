const express = require('express');
const router = express.Router();
const {
  getMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication
} = require('../controllers/medicationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getMedications).post(createMedication);
router.route('/:id').get(getMedication).put(updateMedication).delete(deleteMedication);

module.exports = router;
