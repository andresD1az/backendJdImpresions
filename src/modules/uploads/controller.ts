import { Request, Response } from 'express';
import { uploadToAzure } from '../../lib/azureStorage';

/**
 * Upload a single file to Azure Storage
 */
export async function uploadFile(req: Request, res: Response) {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const { buffer, originalname, mimetype } = req.file;

    // Upload to Azure Storage
    const url = await uploadToAzure(buffer, originalname, mimetype);

    return res.status(200).json({
      success: true,
      url: url,
      filename: originalname,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Upload multiple files to Azure Storage
 */
export async function uploadMultipleFiles(req: Request, res: Response) {
  try {
    // Check if files exist
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      const { buffer, originalname, mimetype } = file;
      const url = await uploadToAzure(buffer, originalname, mimetype);
      return {
        url,
        filename: originalname,
      };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload files',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
