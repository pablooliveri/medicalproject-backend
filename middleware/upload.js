const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
const deliveriesDir = path.join(uploadsDir, 'deliveries');
const logoDir = path.join(uploadsDir, 'logo');
const residentsDir = path.join(uploadsDir, 'residents');

[uploadsDir, deliveriesDir, logoDir, residentsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const deliveryStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, deliveriesDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'delivery-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const logoStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, logoDir);
  },
  filename: function(req, file, cb) {
    cb(null, 'logo' + path.extname(file.originalname));
  }
});

const residentStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, residentsDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resident-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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
  storage: deliveryStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).array('photos', 10);

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('logo');

const uploadResidentPhoto = multer({
  storage: residentStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }
}).single('photo');

module.exports = { uploadDeliveryPhotos, uploadLogo, uploadResidentPhoto };
