const express = require('express');
const router = express.Router();
const {
  getStockStatus,
  adjustStock,
  manualDailyDeduction,
  getStockMovements
} = require('../controllers/stockController');
const { protect } = require('../middleware/auth');
const { tenant } = require('../middleware/tenant');

router.use(protect, tenant);

router.get('/status/:residentId', getStockStatus);
router.put('/adjust', adjustStock);
router.post('/deduct', manualDailyDeduction);
router.get('/movements', getStockMovements);

module.exports = router;
