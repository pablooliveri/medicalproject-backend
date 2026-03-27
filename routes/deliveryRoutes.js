const express = require('express');
const router = express.Router();
const {
  getDeliveries,
  getDelivery,
  createDelivery,
  getDeliveryHistory,
  updateDelivery,
  deleteDelivery
} = require('../controllers/deliveryController');
const { protect } = require('../middleware/auth');
const { tenant } = require('../middleware/tenant');
const { uploadDeliveryPhotos } = require('../middleware/upload');

router.use(protect, tenant);

router.get('/history', getDeliveryHistory);
router.route('/').get(getDeliveries).post(uploadDeliveryPhotos, createDelivery);
router.route('/:id').get(getDelivery).put(uploadDeliveryPhotos, updateDelivery).delete(deleteDelivery);

module.exports = router;
