const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a buffer to Cloudinary
 */
const uploadToCloudinary = (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', ...options },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

/**
 * Delete a file from Cloudinary by its public_id
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    // Ignore delete errors (file may already be gone)
  }
};

/**
 * Extract the public_id from a Cloudinary URL
 * e.g. https://res.cloudinary.com/dp1xhnltc/image/upload/v123/medical/logo/company-logo
 * → "medical/logo/company-logo"
 */
const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  const parts = url.split('/');
  const uploadIdx = parts.indexOf('upload');
  if (uploadIdx === -1) return null;
  const afterUpload = parts.slice(uploadIdx + 1);
  // Skip version segment (v1234567890)
  if (afterUpload[0] && /^v\d+$/.test(afterUpload[0])) afterUpload.shift();
  // Remove file extension
  return afterUpload.join('/').replace(/\.[^/.]+$/, '');
};

/**
 * Fetch an image from a URL and return it as a Buffer (for PDFKit)
 */
const fetchImageBuffer = (url) => {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
};

module.exports = { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl, fetchImageBuffer };
