const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

/**
 * Upload a buffer to Cloudflare R2
 * Returns { secure_url } for compatibility with existing code
 */
let counter = 0;
const uploadImage = async (buffer, folder, options = {}) => {
  counter++;
  const uniqueId = options.public_id || `${Date.now()}-${counter}-${crypto.randomBytes(8).toString('hex')}`;
  const key = `${folder}/${uniqueId}`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: options.contentType || 'image/jpeg',
  }));

  return { secure_url: `${PUBLIC_URL}/${key}` };
};

/**
 * Delete a file from R2 by its key
 */
const deleteImage = async (key) => {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
  } catch (e) {
    // Ignore delete errors (file may already be gone)
  }
};

/**
 * Extract the R2 key from a public URL.
 * Also handles legacy Cloudinary URLs for backward compatibility.
 */
const getKeyFromUrl = (url) => {
  if (!url) return null;

  // Handle R2 public URLs
  if (url.includes('.r2.dev/')) {
    return url.split('.r2.dev/')[1];
  }

  // Handle old Cloudinary URLs (backward compat for existing DB records)
  if (url.includes('cloudinary.com')) {
    const parts = url.split('/');
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx === -1) return null;
    const afterUpload = parts.slice(uploadIdx + 1);
    if (afterUpload[0] && /^v\d+$/.test(afterUpload[0])) afterUpload.shift();
    return afterUpload.join('/').replace(/\.[^/.]+$/, '');
  }

  return null;
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

module.exports = { uploadImage, deleteImage, getKeyFromUrl, fetchImageBuffer };
