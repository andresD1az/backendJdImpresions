import multer from 'multer';
import { Request } from 'express';

// Configure multer to use memory storage (files stored as Buffer)
const storage = multer.memoryStorage();

// File filter to only accept images
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    callback(null, true);
  } else {
    callback(new Error('Only image files are allowed'));
  }
};

// Configure multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});
