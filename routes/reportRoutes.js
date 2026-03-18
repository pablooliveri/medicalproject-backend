const express = require('express');
const router = express.Router();
const { generateDeliveryReport, generateResidentReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/delivery/:id', generateDeliveryReport);
router.get('/resident/:id', generateResidentReport);

module.exports = router;
