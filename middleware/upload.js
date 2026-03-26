const multer = require('multer');
const path = require('path');

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|gif|webp|svg|bmp|ico/;
  const allowedMimes = /image\//;
  const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed'));
};

const uploadDeliveryPhotos = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).array('photos', 1);

const uploadLogo = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('logo');

const uploadResidentPhoto = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('photo');

const uploadExpensePhoto = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('photo');

module.exports = { uploadDeliveryPhotos, uploadLogo, uploadResidentPhoto, uploadExpensePhoto };
