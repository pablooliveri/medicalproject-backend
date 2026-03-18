const express = require('express');
const router = express.Router();
const {
  getDeliveries,
  getDelivery,
  createDelivery,
  getDeliveryHistory
} = require('../controllers/deliveryController');
const { protect } = require('../middleware/auth');
const { uploadDeliveryPhotos } = require('../middleware/upload');

router.use(protect);

router.get('/history', getDeliveryHistory);
router.route('/').get(getDeliveries).post(uploadDeliveryPhotos, createDelivery);
router.route('/:id').get(getDelivery);

module.exports = router;
