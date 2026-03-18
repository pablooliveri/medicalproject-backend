const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  uploadLogo,
  removeLogo,
  addBranch,
  updateBranch,
  deleteBranch
} = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { uploadLogo: uploadLogoMiddleware } = require('../middleware/upload');

router.use(protect);

router.route('/').get(getSettings).put(updateSettings);
router.post('/logo', (req, res, next) => {
  uploadLogoMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, uploadLogo);
router.delete('/logo', removeLogo);
router.post('/branches', addBranch);
router.put('/branches', updateBranch);
router.delete('/branches/:name', deleteBranch);

module.exports = router;
