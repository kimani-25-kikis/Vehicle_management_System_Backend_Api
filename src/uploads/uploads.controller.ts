// uploads.controller.ts
import { Hono } from 'hono' 
type Context = Hono['Context'] 

import { 
  uploadDriverLicenseService, 
  getDriverLicenseUploadsService, 
  verifyDriverLicenseService,
  getUploadStatsService,
  deleteUploadService
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

    // Validate required fields
    if (!file || !type || !licenseNumber) {
      return c.json({ 
        success: false,
        error: 'File, type, and license number are required' 
      }, 400)
    }

    if (!['front', 'back'].includes(type)) {
      return c.json({ 
        success: false,
        error: 'Type must be either "front" or "back"' 
      }, 400)
    }

    if (!file.type.startsWith('image/')) {
      return c.json({ 
        success: false,
        error: 'Only image files are allowed' 
      }, 400)
    }

    if (file.size > 5 * 1024 * 1024) {
      return c.json({ 
        success: false,
        error: 'File size must be less than 5MB' 
      }, 400)
    }

    if (licenseNumber.trim().length < 5) {
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
    console.error('Error uploading driver license:', error.message)
    
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
      error: 'Failed to upload driver license' 
    }, 500)
  }
}

export const getDriverLicenseUploads = async (c: Context) => {
  try {
    const user = c.customer
    
    // Use the helper function to check admin status
    if (!isAdmin(user)) {
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

    const uploads = await getDriverLicenseUploadsService({
      verified: verified ? verified === 'true' : undefined,
      userId: userId ? parseInt(userId) : undefined,
      licenseNumber: licenseNumber || undefined,
      page,
      limit
    })

    return c.json({
      success: true,
      data: {
        uploads: uploads.data,
        pagination: uploads.pagination
      }
    })

  } catch (error: any) {
    console.error('Error fetching driver license uploads:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to fetch driver license uploads' 
    }, 500)
  }
}

export const getDriverLicenseUploadsByUser = async (c: Context) => {
  try {
    const user = c.customer
    const userId = parseInt(c.req.param('userId'))

    // Users can only access their own uploads, admins can access any
    if (!isAdmin(user) && user.user_id !== userId) {
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

    return c.json({
      success: true,
      data: {
        uploads: uploads.data
      }
    })

  } catch (error: any) {
    console.error('Error fetching user driver license uploads:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to fetch driver license uploads' 
    }, 500)
  }
}

export const verifyDriverLicense = async (c: Context) => {
  try {
    const user = c.customer
    
    if (!isAdmin(user)) {
      return c.json({ 
        success: false,
        error: 'Unauthorized. Admin access required.' 
      }, 403)
    }

    const uploadId = parseInt(c.req.param('uploadId'))
    const body = await c.req.json()
    const { verified, notes } = body

    if (typeof verified !== 'boolean') {
      return c.json({ 
        success: false,
        error: 'Verified field is required and must be a boolean' 
      }, 400)
    }

    if (notes && notes.length > 500) {
      return c.json({ 
        success: false,
        error: 'Verification notes must be less than 500 characters' 
      }, 400)
    }

    const result = await verifyDriverLicenseService(uploadId, verified, notes)

    if (!result.success) {
      return c.json({ 
        success: false,
        error: result.error 
      }, 404)
    }

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
    console.error('Error verifying driver license:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to verify driver license' 
    }, 500)
  }
}

export const getUploadStats = async (c: Context) => {
  try {
    const user = c.customer
    
    if (!isAdmin(user)) {
      return c.json({ 
        success: false,
        error: 'Unauthorized. Admin access required.' 
      }, 403)
    }

    const stats = await getUploadStatsService()

    return c.json({
      success: true,
      data: stats
    })

  } catch (error: any) {
    console.error('Error fetching upload stats:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to fetch upload statistics' 
    }, 500)
  }
}

export const serveLicenseFile = async (c: Context) => {
  try {
    const filename = c.req.param('filename')
    const user = c.customer

    if (!filename || filename.includes('..') || filename.includes('/')) {
      return c.json({ 
        success: false,
        error: 'Invalid filename' 
      }, 400)
    }

    const db = getDbPool()
    const query = `
      SELECT dlu.*, u.user_id, u.role
      FROM DriverLicenseUploads dlu
      JOIN Users u ON dlu.user_id = u.user_id
      WHERE dlu.file_name = @filename
    `

    const result = await db.request()
      .input('filename', filename)
      .query(query)

    if (!result.recordset[0]) {
      return c.json({ 
        success: false,
        error: 'File not found' 
      }, 404)
    }

    const upload = result.recordset[0]

    // Use helper function to check permissions
    if (!isAdmin(user) && user.user_id !== upload.user_id) {
      return c.json({ 
        success: false,
        error: 'Unauthorized to access this file' 
      }, 403)
    }

    return c.json({
      success: true,
      data: {
        filename: upload.file_name,
        fileType: upload.file_type,
        licenseNumber: upload.license_number,
        uploadedAt: upload.uploaded_at,
        verified: upload.verified_by_admin,
        userName: `${upload.first_name} ${upload.last_name}`
      }
    })

  } catch (error: any) {
    console.error('Error serving license file:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to serve file' 
    }, 500)
  }
}

export const deleteDriverLicenseUpload = async (c: Context) => {
  try {
    const user = c.customer
    const uploadId = parseInt(c.req.param('uploadId'))

    const result = await deleteUploadService(uploadId, user.user_id, getUserRole(user))

    if (!result.success) {
      return c.json({ 
        success: false,
        error: result.error 
      }, result.error === 'Upload not found' ? 404 : 403)
    }

    return c.json({
      success: true,
      message: result.message
    })

  } catch (error: any) {
    console.error('Error deleting driver license upload:', error.message)
    return c.json({ 
      success: false,
      error: 'Failed to delete driver license upload' 
    }, 500)
  }
}