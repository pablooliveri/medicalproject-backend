const express = require('express');
const router = express.Router();
const {
  getResidentHistory,
  getAvailableMonths,
  getMonthlySnapshot
} = require('../controllers/medicationHistoryController');
const { protect } = require('../middleware/auth');
const { tenant } = require('../middleware/tenant');

router.use(protect, tenant);

router.get('/:residentId', getResidentHistory);
router.get('/:residentId/months', getAvailableMonths);
router.get('/:residentId/snapshot', getMonthlySnapshot);

module.exports = router;
