const express = require('express');
const router = express.Router();
const {
  getStockStatus,
  adjustStock,
  manualDailyDeduction,
  getStockMovements
} = require('../controllers/stockController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/status/:residentId', getStockStatus);
router.put('/adjust', adjustStock);
router.post('/deduct', manualDailyDeduction);
router.get('/movements', getStockMovements);

module.exports = router;
