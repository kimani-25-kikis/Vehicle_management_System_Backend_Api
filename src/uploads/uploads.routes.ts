// uploads.route.ts
import { Hono } from 'hono'
import { 
  uploadDriverLicense, 
  getDriverLicenseUploads, 
  getDriverLicenseUploadsByUser,
  verifyDriverLicense, 
  getUploadStats,
  serveLicenseFile,
  deleteDriverLicenseUpload,
  getFileInfo
} from './uploads.controller.ts'
import { adminRoleAuth, customerRoleAuth, bothRolesAuth } from '../middleware/bearAuth.ts'

const uploadRoutes = new Hono()

// Apply authentication middleware to all upload routes
uploadRoutes.use('*', bothRolesAuth)

// Upload driver's license images (both customers and admins can upload)
uploadRoutes.post('/uploads/driver-license', uploadDriverLicense)

// Get uploads (admin only)
uploadRoutes.get('/uploads/driver-license', adminRoleAuth, getDriverLicenseUploads)

// Get uploads by specific user
uploadRoutes.get('/uploads/driver-license/user/:userId', getDriverLicenseUploadsByUser)

// Get upload statistics (admin only)
uploadRoutes.get('/uploads/driver-license/stats', adminRoleAuth, getUploadStats)

// Verify license (admin only)
uploadRoutes.patch('/uploads/driver-license/:uploadId/verify', adminRoleAuth, verifyDriverLicense)

// Serve license file (with proper authentication)
uploadRoutes.get('/uploads/driver-license/file/:filename', serveLicenseFile)

// Get file info (for debugging)
uploadRoutes.get('/uploads/driver-license/info/:filename', getFileInfo)

// Delete upload
uploadRoutes.delete('/uploads/driver-license/:uploadId', deleteDriverLicenseUpload)

export default uploadRoutes