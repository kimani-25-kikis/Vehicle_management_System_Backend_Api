import { Hono } from 'hono' 
type Context = Hono['Context'] 

import { 
  uploadDriverLicenseService, 
  getDriverLicenseUploadsService, 
  verifyDriverLicenseService,
  getUploadStatsService,
  deleteUploadService,
  getFileDataService,
  readFileFromDisk
} from './uploads.service.ts'
import { getDbPool } from '../db/db.config.ts'


const getUserRole = (user: any): string => {
  return user.user_type || 'customer' 
}

const isAdmin = (user: any): boolean => {
  return getUserRole(user) === 'admin'
}

export const uploadDriverLicense = async (c: Context) => {
  try {
    const body = await c.req.parseBody()
    const file = body['file'] as File
    const type = body['type'] as string
    const licenseNumber = body['licenseNumber'] as string
    const user = c.customer

    console.log(`📤 Upload request from user ${user.user_id}`)
    console.log(`📄 File info: ${file?.name} (${file?.size} bytes)`)
    console.log(`📋 Type: ${type}, License: ${licenseNumber}`)

    // Validate required fields
    if (!file || !type || !licenseNumber) {
      console.error('❌ Missing required fields')
      return c.json({ 
        success: false,
        error: 'File, type, and license number are required' 
      }, 400)
    }

    if (!['front', 'back'].includes(type)) {
      console.error(`❌ Invalid type: ${type}`)
      return c.json({ 
        success: false,
        error: 'Type must be either "front" or "back"' 
      }, 400)
    }

    if (!file.type.startsWith('image/')) {
      console.error(`❌ Invalid file type: ${file.type}`)
      return c.json({ 
        success: false,
        error: 'Only image files are allowed' 
      }, 400)
    }

    if (file.size > 5 * 1024 * 1024) {
      console.error(`❌ File too large: ${file.size} bytes`)
      return c.json({ 
        success: false,
        error: 'File size must be less than 5MB' 
      }, 400)
    }

    if (licenseNumber.trim().length < 5) {
      console.error(`❌ License number too short: ${licenseNumber}`)
      return c.json({ 
        success: false,
        error: 'License number must be at least 5 characters long' 
      }, 400)
    }

    const result = await uploadDriverLicenseService(
      file,
      type as 'front' | 'back',
      licenseNumber.trim(),
      user.user_id
    )

    console.log(`✅ Upload successful: ${result.fileName}`)
    console.log(`🔗 URL: ${result.url}`)

    return c.json({
      success: true,
      message: 'License image uploaded successfully',
      data: {
        filePath: result.filePath,
        fileName: result.fileName,
        url: result.url,
        uploadId: result.uploadId
      }
    }, 201)

  } catch (error: any) {
    console.error('❌ Error uploading driver license:', error.message)
    
    if (error.message.includes('file system') || error.message.includes('directory')) {
      return c.json({ 
        success: false,
        error: 'Server storage error. Please try again.' 
      }, 500)
    }
    
    if (error.message.includes('database')) {
      return c.json({ 
        success: false,
        error: 'Database error. Please try again.' 
      }, 500)
    }

    return c.json({ 
      success: false,
      error: 'Failed to upload driver license: ' + error.message
    }, 500)
  }
}

export const getDriverLicenseUploads = async (c: Context) => {
  try {
    const user = c.customer
    
    console.log(`📋 Get uploads request from user ${user.user_id} (${getUserRole(user)})`)
    
    // Use the helper function to check admin status
    if (!isAdmin(user)) {
      console.error(`❌ Unauthorized: User ${user.user_id} is not admin`)
      return c.json({ 
        success: false,
        error: 'Unauthorized. Admin access required.' 
      }, 403)
    }

    const verified = c.req.query('verified')
    const userId = c.req.query('userId')
    const licenseNumber = c.req.query('licenseNumber')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')

    console.log(`🔍 Filters: verified=${verified}, userId=${userId}, licenseNumber=${licenseNumber}`)

    const uploads = await getDriverLicenseUploadsService({
      verified: verified ? verified === 'true' : undefined,
      userId: userId ? parseInt(userId) : undefined,
      licenseNumber: licenseNumber || undefined,
      page,
      limit
    })

    console.log(`✅ Found ${uploads.data.length} uploads`)

    return c.json({
      success: true,
      data: {
        uploads: uploads.data,
        pagination: uploads.pagination
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching driver license uploads:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to fetch driver license uploads: ' + error.message
    }, 500)
  }
}

export const getDriverLicenseUploadsByUser = async (c: Context) => {
  try {
    const user = c.customer
    const userId = parseInt(c.req.param('userId'))

    console.log(`📋 Get uploads for user ${userId} requested by ${user.user_id}`)

    // Users can only access their own uploads, admins can access any
    if (!isAdmin(user) && user.user_id !== userId) {
      console.error(`❌ Unauthorized: User ${user.user_id} cannot access uploads of user ${userId}`)
      return c.json({ 
        success: false,
        error: 'Unauthorized' 
      }, 403)
    }

    const uploads = await getDriverLicenseUploadsService({
      userId: userId,
      page: 1,
      limit: 50
    })

    console.log(`✅ Found ${uploads.data.length} uploads for user ${userId}`)

    return c.json({
      success: true,
      data: {
        uploads: uploads.data
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching user driver license uploads:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to fetch driver license uploads: ' + error.message
    }, 500)
  }
}

export const verifyDriverLicense = async (c: Context) => {
  try {
    const user = c.customer
    const uploadId = parseInt(c.req.param('uploadId'))
    
    console.log(`🔍 Verify request for upload ${uploadId} by user ${user.user_id}`)
    
    if (!isAdmin(user)) {
      console.error(`❌ Unauthorized: User ${user.user_id} is not admin`)
      return c.json({ 
        success: false,
        error: 'Unauthorized. Admin access required.' 
      }, 403)
    }

    const body = await c.req.json()
    const { verified, notes } = body

    if (typeof verified !== 'boolean') {
      console.error(`❌ Invalid verified field: ${verified}`)
      return c.json({ 
        success: false,
        error: 'Verified field is required and must be a boolean' 
      }, 400)
    }

    if (notes && notes.length > 500) {
      console.error(`❌ Notes too long: ${notes.length} characters`)
      return c.json({ 
        success: false,
        error: 'Verification notes must be less than 500 characters' 
      }, 400)
    }

    const result = await verifyDriverLicenseService(uploadId, verified, notes)

    if (!result.success) {
      console.error(`❌ Verification failed: ${result.error}`)
      return c.json({ 
        success: false,
        error: result.error 
      }, 404)
    }

    console.log(`✅ Upload ${uploadId} ${verified ? 'verified' : 'rejected'} successfully`)

    return c.json({
      success: true,
      message: `License ${verified ? 'verified' : 'rejected'} successfully`,
      data: {
        uploadId: result.uploadId,
        verified: result.verified,
        verifiedAt: result.verifiedAt
      }
    })

  } catch (error: any) {
    console.error('❌ Error verifying driver license:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to verify driver license: ' + error.message
    }, 500)
  }
}

export const getUploadStats = async (c: Context) => {
  try {
    const user = c.customer
    
    console.log(`📊 Stats request from user ${user.user_id}`)
    
    if (!isAdmin(user)) {
      console.error(`❌ Unauthorized: User ${user.user_id} is not admin`)
      return c.json({ 
        success: false,
        error: 'Unauthorized. Admin access required.' 
      }, 403)
    }

    const stats = await getUploadStatsService()

    console.log(`✅ Stats fetched: ${stats.overall.totalUploads} total uploads`)

    return c.json({
      success: true,
      data: stats
    })

  } catch (error: any) {
    console.error('❌ Error fetching upload stats:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to fetch upload statistics: ' + error.message
    }, 500)
  }
}

export const serveLicenseFile = async (c: Context) => {
  try {
    const filename = c.req.param('filename')
    const user = c.customer

    console.log(`📄 File request: ${filename} by user ${user.user_id}`)

    if (!filename || filename.includes('..') || filename.includes('/')) {
      console.error(`❌ Invalid filename: ${filename}`)
      return c.json({ 
        success: false,
        error: 'Invalid filename' 
      }, 400)
    }

    // Get file data with authentication check
    const fileData = await getFileDataService(filename, user.user_id, getUserRole(user))

    if (!fileData) {
      console.error(`❌ File not found or unauthorized: ${filename}`)
      return c.json({ 
        success: false,
        error: 'File not found or access denied' 
      }, 404)
    }

    // Read the file from disk
    const fileBuffer = await readFileFromDisk(fileData.filePath)
    
    if (!fileBuffer) {
      console.error(`❌ Failed to read file: ${fileData.filePath}`)
      return c.json({ 
        success: false,
        error: 'Failed to read file from server' 
      }, 500)
    }

    console.log(`✅ Serving file: ${filename} (${fileBuffer.length} bytes)`)

    // Set headers for file download/viewing
    c.header('Content-Type', fileData.contentType)
    c.header('Content-Disposition', `inline; filename="${fileData.fileName}"`)
    c.header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
    c.header('Content-Length', fileBuffer.length.toString())

    return c.body(fileBuffer)

  } catch (error: any) {
    console.error('❌ Error serving license file:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to serve file: ' + error.message
    }, 500)
  }
}

export const deleteDriverLicenseUpload = async (c: Context) => {
  try {
    const user = c.customer
    const uploadId = parseInt(c.req.param('uploadId'))

    console.log(`🗑️ Delete request for upload ${uploadId} by user ${user.user_id}`)

    const result = await deleteUploadService(uploadId, user.user_id, getUserRole(user))

    if (!result.success) {
      console.error(`❌ Delete failed: ${result.error}`)
      return c.json({ 
        success: false,
        error: result.error 
      }, result.error === 'Upload not found' ? 404 : 403)
    }

    console.log(`✅ Upload ${uploadId} deleted successfully`)

    return c.json({
      success: true,
      message: result.message
    })

  } catch (error: any) {
    console.error('❌ Error deleting driver license upload:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to delete driver license upload: ' + error.message
    }, 500)
  }
}

// NEW: Endpoint to get file info (for debugging)
export const getFileInfo = async (c: Context) => {
  try {
    const filename = c.req.param('filename')
    const user = c.customer

    console.log(`🔍 File info request: ${filename} by user ${user.user_id}`)

    if (!filename) {
      return c.json({ 
        success: false,
        error: 'Filename is required' 
      }, 400)
    }

    const fileData = await getFileDataService(filename, user.user_id, getUserRole(user))

    if (!fileData) {
      return c.json({ 
        success: false,
        error: 'File not found or access denied' 
      }, 404)
    }

    return c.json({
      success: true,
      data: {
        fileName: fileData.fileName,
        filePath: fileData.filePath,
        contentType: fileData.contentType,
        userId: fileData.userId,
        userName: fileData.userName
      }
    })

  } catch (error: any) {
    console.error('❌ Error getting file info:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to get file info: ' + error.message
    }, 500)
  }
}