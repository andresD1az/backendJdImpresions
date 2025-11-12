import { Router } from 'express';
import { upload } from '../../middleware/upload';
import { uploadFile, uploadMultipleFiles } from './controller';

const router = Router();

// Single file upload endpoint
// POST /manager/uploads
router.post('/uploads', upload.single('file'), uploadFile);

// Multiple files upload endpoint
// POST /manager/uploads/multiple
router.post('/uploads/multiple', upload.array('files', 10), uploadMultipleFiles);

export default router;
