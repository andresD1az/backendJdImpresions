import { BlobServiceClient } from '@azure/storage-blob';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'product-images';

if (!connectionString) {
  throw new Error('AZURE_STORAGE_CONNECTION_STRING is not defined');
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

/**
 * Upload a file buffer to Azure Blob Storage
 * @param buffer File buffer
 * @param filename Original filename
 * @param mimetype File mimetype
 * @returns Public URL of the uploaded file
 */
export async function uploadToAzure(
  buffer: Buffer,
  filename: string,
  mimetype: string
): Promise<string> {
  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const ext = filename.split('.').pop();
  const blobName = `${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Upload buffer to Azure Blob Storage
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimetype,
    },
  });

  // Return the public URL
  return blockBlobClient.url;
}

/**
 * Delete a file from Azure Blob Storage
 * @param url Public URL of the file
 */
export async function deleteFromAzure(url: string): Promise<void> {
  try {
    const blobName = url.split('/').pop();
    if (!blobName) return;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  } catch (error) {
    console.error('Error deleting from Azure:', error);
  }
}
