// services/vehicleCloudinary.service.ts
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary (use the same as user service)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export interface VehicleImageUploadOptions {
  folder?: string;
  transformation?: any[];
  tags?: string[];
}

export const uploadVehicleImage = async (
  fileBuffer: Buffer,
  fileName: string,
  vehicleId?: number,
  options: VehicleImageUploadOptions = {}
): Promise<CloudinaryUploadResult> => {
  try {
    const folderPath = vehicleId 
      ? `car-rental/vehicles/${vehicleId}` 
      : 'car-rental/vehicles/temp';
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          public_id: `vehicle_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          transformation: options.transformation || [
            { width: 1200, height: 800, crop: 'fill', gravity: 'auto' },
            { quality: 'auto', fetch_format: 'auto' }
          ],
          resource_type: 'image',
          tags: options.tags || ['vehicle'],
          context: `filename=${fileName}`
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error('Failed to upload image to Cloudinary'));
          } else if (result) {
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id,
              format: result.format,
              width: result.width,
              height: result.height,
              bytes: result.bytes
            });
          }
        }
      );
      
      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error('Upload vehicle image error:', error);
    throw error;
  }
};

export const uploadVehicleImages = async (
  files: Array<{ buffer: Buffer; fileName: string }>,
  vehicleId?: number
): Promise<CloudinaryUploadResult[]> => {
  try {
    const uploadPromises = files.map(file => 
      uploadVehicleImage(file.buffer, file.fileName, vehicleId)
    );
    
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Upload multiple vehicle images error:', error);
    throw error;
  }
};

export const deleteVehicleImage = async (publicId: string): Promise<boolean> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Delete vehicle image error:', error);
    throw error;
  }
};

// Fix: Add the missing deleteVehicleImages function
export const deleteVehicleImages = async (publicIds: string[]): Promise<boolean[]> => {
  try {
    const deletePromises = publicIds.map(publicId => deleteVehicleImage(publicId));
    return await Promise.all(deletePromises);
  } catch (error) {
    console.error('Delete multiple vehicle images error:', error);
    throw error;
  }
};

// Generate thumbnail URL
export const getVehicleThumbnailUrl = (publicId: string, width: number = 400, height: number = 300): string => {
  return cloudinary.url(publicId, {
    transformation: [
      { width, height, crop: 'fill', gravity: 'auto' },
      { quality: 'auto' }
    ]
  });
};

// Generate optimized display URL
export const getOptimizedVehicleImageUrl = (publicId: string): string => {
  return cloudinary.url(publicId, {
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ]
  });
};