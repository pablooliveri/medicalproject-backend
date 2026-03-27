const Institution = require('../models/Institution');

const tenant = async (req, res, next) => {
  try {
    // Superadmin bypasses tenant filter
    if (req.user.role === 'superadmin') {
      return next();
    }

    if (!req.user.institution) {
      return res.status(403).json({ message: 'No institution assigned to this user' });
    }

    const institution = await Institution.findById(req.user.institution);
    if (!institution) {
      return res.status(403).json({ message: 'Institution not found' });
    }

    if (!institution.isActive) {
      return res.status(403).json({ message: 'Your institution has been disabled. Contact the administrator.', code: 'INSTITUTION_BLOCKED' });
    }

    if (institution.subscriptionStatus === 'blocked') {
      return res.status(403).json({ message: 'Your institution has been blocked. Contact the administrator.', code: 'INSTITUTION_BLOCKED' });
    }

    if (institution.subscriptionStatus === 'expired') {
      return res.status(403).json({ message: 'Your subscription has expired. Contact the administrator.', code: 'SUBSCRIPTION_EXPIRED' });
    }

    // Auto-expire if past end date
    if (institution.subscriptionEndDate && institution.subscriptionEndDate < new Date()) {
      institution.subscriptionStatus = 'expired';
      await institution.save();
      return res.status(403).json({ message: 'Your subscription has expired. Contact the administrator.', code: 'SUBSCRIPTION_EXPIRED' });
    }

    req.institution = institution;
    req.tenantFilter = { institution: req.user.institution };

    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { tenant };
