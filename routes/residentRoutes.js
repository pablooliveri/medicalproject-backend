const express = require('express');
const router = express.Router();
const {
  getResidents,
  getResident,
  createResident,
  updateResident,
  deleteResident,
  getResidentWithMedications
} = require('../controllers/residentController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getResidents).post(createResident);
router.route('/:id').get(getResident).put(updateResident).delete(deleteResident);
router.get('/:id/full', getResidentWithMedications);

module.exports = router;
