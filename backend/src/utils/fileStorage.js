import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '../../uploads');

// Yandex S3 client (S3-compatible)
let s3Client = null;
if (process.env.YANDEX_S3_ENDPOINT && process.env.YANDEX_S3_ACCESS_KEY_ID && process.env.YANDEX_S3_SECRET_ACCESS_KEY && process.env.YANDEX_S3_BUCKET) {
  try {
    s3Client = new S3Client({
      endpoint: process.env.YANDEX_S3_ENDPOINT,
      region: process.env.YANDEX_S3_REGION || 'ru-central1',
      credentials: {
        accessKeyId: process.env.YANDEX_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.YANDEX_S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true, // Required for Yandex S3
    });
    console.log('Yandex S3 client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize S3 client:', error);
  }
} else {
  console.log('S3 not configured, using local storage');
  console.log('Missing:', {
    endpoint: !process.env.YANDEX_S3_ENDPOINT,
    accessKey: !process.env.YANDEX_S3_ACCESS_KEY_ID,
    secretKey: !process.env.YANDEX_S3_SECRET_ACCESS_KEY,
    bucket: !process.env.YANDEX_S3_BUCKET,
  });
}

// Ensure upload directory exists (for local storage fallback)
export const ensureUploadDir = async () => {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
};

// Save uploaded file (S3 or local)
// Accepts either a file object (with toBuffer() method) or a Buffer directly
export const saveFile = async (fileOrBuffer, filename, contentType = 'image/png', folder = 'plans') => {
  let buffer;
  let mimetype = contentType;
  
  // Handle both file objects and buffers
  if (Buffer.isBuffer(fileOrBuffer)) {
    buffer = fileOrBuffer;
  } else if (fileOrBuffer && typeof fileOrBuffer.toBuffer === 'function') {
    buffer = await fileOrBuffer.toBuffer();
    mimetype = fileOrBuffer.mimetype || contentType;
  } else {
    throw new Error('Invalid file or buffer provided');
  }
  
  // Use S3 if configured
  if (s3Client && process.env.YANDEX_S3_BUCKET) {
    try {
      const bucket = process.env.YANDEX_S3_BUCKET;
      const key = `${folder}/${filename}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }));
      
      // Construct S3 URL
      // Yandex S3 public URL format: https://storage.yandexcloud.net/bucket-name/key
      let s3Url;
      if (process.env.YANDEX_S3_PUBLIC_URL) {
        // If custom public URL is set, use it
        s3Url = `${process.env.YANDEX_S3_PUBLIC_URL}/${key}`;
      } else {
        // Default Yandex S3 public URL format
        s3Url = `https://storage.yandexcloud.net/${bucket}/${key}`;
      }
      
      console.log(`File uploaded to S3: ${s3Url}`);
      return s3Url;
    } catch (error) {
      console.error('S3 upload failed, falling back to local storage:', error);
      // Fall through to local storage
    }
  }
  
  // Fallback to local storage
  await ensureUploadDir();
  const folderPath = join(UPLOAD_DIR, folder);
  if (!existsSync(folderPath)) {
    await mkdir(folderPath, { recursive: true });
  }
  const filePath = join(folderPath, filename);
  await writeFile(filePath, buffer);
  console.log(`File saved locally: ${filePath}`);
  
  // Return URL for local storage
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/uploads/${folder}/${filename}`;
};

// Generate unique filename
export const generateFilename = (originalFilename, prefix = '') => {
  const ext = extname(originalFilename);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}${timestamp}_${random}${ext}`;
};

// Validate file type
export const validateFileType = (mimetype) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  return allowedTypes.includes(mimetype);
};

// Get file URL
export const getFileUrl = (filePathOrUrl) => {
  // If using S3, the filePathOrUrl is already the S3 URL
  if (filePathOrUrl && (filePathOrUrl.startsWith('http://') || filePathOrUrl.startsWith('https://'))) {
    return filePathOrUrl;
  }
  
  // Extract filename from local path if it's a full path
  const filename = filePathOrUrl.includes('/') ? filePathOrUrl.split('/').pop() : filePathOrUrl;
  
  // Local storage URL
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/uploads/${filename}`;
};
