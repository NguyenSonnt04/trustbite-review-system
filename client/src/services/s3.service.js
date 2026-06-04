import { api } from './api';

/**
 * Enterprise AWS S3 Integration Service (Client Side)
 * 
 * Typically in production, files are uploaded directly to S3 via presigned URLs
 * to offload bandwidth and CPU from the backend server.
 */
class S3Service {
  /**
   * Request a presigned upload URL from the backend and upload the file to S3
   * @param {File} file - The file object from browser input
   * @param {string} folder - Destination folder in the S3 bucket
   * @returns {Promise<string>} - Returns the URL of the uploaded file
   */
  async uploadFile(file, folder = 'uploads') {
    try {
      // 1. Get presigned URL from backend
      const { uploadUrl, fileUrl } = await api.post('/aws/s3/presigned-url', {
        filename: file.name,
        contentType: file.type,
        folder,
      });

      // 2. Upload file directly to S3 using the presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed with status: ${uploadResponse.status}`);
      }

      // 3. Return S3 public URL
      return fileUrl;
    } catch (error) {
      console.error('S3Service.uploadFile error:', error);
      throw error;
    }
  }
}

export const s3Service = new S3Service();
