const express = require('express');
const router = express.Router();
const { generateDeliveryReport, generateResidentReport, generateAllResidentsReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { tenant } = require('../middleware/tenant');

router.use(protect, tenant);

router.get('/all-residents', generateAllResidentsReport);
router.get('/delivery/:id', generateDeliveryReport);
router.get('/resident/:id', generateResidentReport);

module.exports = router;
