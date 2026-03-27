const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { superAdmin } = require('../middleware/superAdmin');
const {
  getDashboard,
  getInstitutions,
  createInstitution,
  getInstitution,
  updateInstitution,
  updateStatus,
  updateSubscription,
  resetPassword,
  updateUser,
  deleteInstitution,
  updateAccount
} = require('../controllers/superAdminController');

router.use(protect, superAdmin);

router.get('/dashboard', getDashboard);
router.route('/institutions').get(getInstitutions).post(createInstitution);
router.route('/institutions/:id').get(getInstitution).put(updateInstitution).delete(deleteInstitution);
router.put('/institutions/:id/status', updateStatus);
router.put('/institutions/:id/subscription', updateSubscription);
router.put('/institutions/:id/reset-password', resetPassword);
router.put('/institutions/:id/update-user', updateUser);
router.put('/account', updateAccount);

module.exports = router;
