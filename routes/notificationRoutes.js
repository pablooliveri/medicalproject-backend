const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  deleteNotification,
  checkStock
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { tenant } = require('../middleware/tenant');

router.use(protect, tenant);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/mark-all-read', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);
router.post('/check-stock', checkStock);

module.exports = router;
