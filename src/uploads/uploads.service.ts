import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getDbPool } from '../db/db.config.ts'

interface UploadResult {
  filePath: string
  fileName: string
  url: string
  uploadId: number
}

interface GetUploadsFilters {
  verified?: boolean
  userId?: number
  licenseNumber?: string
  page?: number
  limit?: number
}

interface GetUploadsResult {
  data: any[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

interface VerifyResult {
  success: boolean
  uploadId?: number
  verified?: boolean
  verifiedAt?: Date
  error?: string
}

export const uploadDriverLicenseService = async (
  file: File,
  type: 'front' | 'back',
  licenseNumber: string,
  userId: number
): Promise<UploadResult> => {
  const db = getDbPool()
  let filePath: string = '' // Declare filePath outside try block
  
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'driver-licenses')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileName = `${userId}_${licenseNumber}_${type}_${timestamp}_${randomString}.${fileExtension}`
    filePath = path.join(uploadsDir, fileName) // Assign to the outer variable

    // Convert file to buffer and save
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await writeFile(filePath, buffer)

    // Store file info in database for admin access
    const query = `
      INSERT INTO DriverLicenseUploads 
      (user_id, license_number, file_type, file_name, file_path, uploaded_at)
      OUTPUT INSERTED.upload_id
      VALUES (@user_id, @license_number, @file_type, @file_name, @file_path, GETDATE())
    `

    const result = await db.request()
      .input('user_id', userId)
      .input('license_number', licenseNumber)
      .input('file_type', type)
      .input('file_name', fileName)
      .input('file_path', filePath)
      .query(query)

    if (!result.recordset[0]) {
      throw new Error('Failed to save upload record to database')
    }

    const uploadId = result.recordset[0].upload_id

    // Return accessible URL
    const fileUrl = `/api/uploads/driver-license/file/${fileName}`

    return {
      filePath,
      fileName,
      url: fileUrl,
      uploadId
    }

  } catch (error: any) {
    console.error('Error in uploadDriverLicenseService:', error)
    
    // Clean up file if it was created but database failed
    if (error.message.includes('database') && filePath && existsSync(filePath)) {
      try {
        await unlink(filePath)
      } catch (cleanupError) {
        console.error('Failed to clean up file after database error:', cleanupError)
      }
    }
    
    throw new Error('Failed to process file upload')
  }
}

export const getDriverLicenseUploadsService = async (
  filters: GetUploadsFilters = {}
): Promise<GetUploadsResult> => {
  const db = getDbPool()
  
  try {
    const {
      verified,
      userId,
      licenseNumber,
      page = 1,
      limit = 20
    } = filters

    // Calculate pagination
    const offset = (page - 1) * limit

    // Build WHERE clause dynamically
    let whereClause = 'WHERE 1=1'
    const request = db.request()

    if (verified !== undefined) {
      whereClause += ' AND dlu.verified_by_admin = @verified'
      request.input('verified', verified ? 1 : 0)
    }

    if (userId) {
      whereClause += ' AND dlu.user_id = @user_id'
      request.input('user_id', userId)
    }

    if (licenseNumber) {
      whereClause += ' AND dlu.license_number LIKE @license_number'
      request.input('license_number', `%${licenseNumber}%`)
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM DriverLicenseUploads dlu
      ${whereClause}
    `

    const countResult = await request.query(countQuery)
    const total = countResult.recordset[0]?.total || 0
    const totalPages = Math.ceil(total / limit)

    // Get paginated data
    const dataQuery = `
      SELECT 
        dlu.upload_id,
        dlu.user_id,
        dlu.license_number,
        dlu.file_type,
        dlu.file_name,
        dlu.file_path,
        dlu.uploaded_at,
        dlu.verified_by_admin,
        dlu.verified_at,
        dlu.verification_notes,
        u.first_name,
        u.last_name,
        u.email,
        u.contact_phone,
        u.role
      FROM DriverLicenseUploads dlu
      JOIN Users u ON dlu.user_id = u.user_id
      ${whereClause}
      ORDER BY dlu.uploaded_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `

    request.input('offset', offset)
    request.input('limit', limit)

    const dataResult = await request.query(dataQuery)

    const uploads = dataResult.recordset.map(upload => ({
      uploadId: upload.upload_id,
      userId: upload.user_id,
      licenseNumber: upload.license_number,
      fileType: upload.file_type,
      fileName: upload.file_name,
      filePath: upload.file_path,
      uploadedAt: upload.uploaded_at,
      verified: upload.verified_by_admin,
      verifiedAt: upload.verified_at,
      verificationNotes: upload.verification_notes,
      user: {
        firstName: upload.first_name,
        lastName: upload.last_name,
        email: upload.email,
        contactPhone: upload.contact_phone,
        role: upload.role
      }
    }))

    return {
      data: uploads,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }

  } catch (error: any) {
    console.error('Error in getDriverLicenseUploadsService:', error)
    throw new Error('Failed to fetch driver license uploads')
  }
}

export const verifyDriverLicenseService = async (
  uploadId: number,
  verified: boolean,
  notes?: string
): Promise<VerifyResult> => {
  const db = getDbPool()
  
  try {
    // First check if upload exists
    const checkQuery = `
      SELECT upload_id FROM DriverLicenseUploads WHERE upload_id = @upload_id
    `

    const checkResult = await db.request()
      .input('upload_id', uploadId)
      .query(checkQuery)

    if (!checkResult.recordset[0]) {
      return {
        success: false,
        error: 'Upload not found'
      }
    }

    // Update verification status
    const updateQuery = `
      UPDATE DriverLicenseUploads 
      SET 
        verified_by_admin = @verified,
        verification_notes = @notes,
        verified_at = CASE WHEN @verified = 1 THEN GETDATE() ELSE NULL END
      OUTPUT INSERTED.upload_id, INSERTED.verified_by_admin, INSERTED.verified_at
      WHERE upload_id = @upload_id
    `

    const updateResult = await db.request()
      .input('verified', verified ? 1 : 0)
      .input('notes', notes || null)
      .input('upload_id', uploadId)
      .query(updateQuery)

    if (!updateResult.recordset[0]) {
      return {
        success: false,
        error: 'Failed to update verification status'
      }
    }

    const result = updateResult.recordset[0]

    return {
      success: true,
      uploadId: result.upload_id,
      verified: result.verified_by_admin,
      verifiedAt: result.verified_at
    }

  } catch (error: any) {
    console.error('Error in verifyDriverLicenseService:', error)
    return {
      success: false,
      error: 'Failed to verify driver license'
    }
  }
}

export const getUploadStatsService = async () => {
  const db = getDbPool()
  
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_uploads,
        SUM(CASE WHEN verified_by_admin = 1 THEN 1 ELSE 0 END) as verified_uploads,
        SUM(CASE WHEN verified_by_admin = 0 THEN 1 ELSE 0 END) as pending_uploads,
        COUNT(DISTINCT user_id) as unique_users,
        MIN(uploaded_at) as oldest_upload,
        MAX(uploaded_at) as latest_upload
      FROM DriverLicenseUploads
    `

    const dailyStatsQuery = `
      SELECT 
        CAST(uploaded_at AS DATE) as upload_date,
        COUNT(*) as daily_uploads,
        SUM(CASE WHEN verified_by_admin = 1 THEN 1 ELSE 0 END) as daily_verified
      FROM DriverLicenseUploads
      WHERE uploaded_at >= DATEADD(day, -30, GETDATE())
      GROUP BY CAST(uploaded_at AS DATE)
      ORDER BY upload_date DESC
    `

    const userStatsQuery = `
      SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        COUNT(dlu.upload_id) as total_uploads,
        SUM(CASE WHEN dlu.verified_by_admin = 1 THEN 1 ELSE 0 END) as verified_uploads
      FROM Users u
      LEFT JOIN DriverLicenseUploads dlu ON u.user_id = dlu.user_id
      WHERE dlu.upload_id IS NOT NULL
      GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.role
      ORDER BY total_uploads DESC
    `

    const [statsResult, dailyStatsResult, userStatsResult] = await Promise.all([
      db.request().query(statsQuery),
      db.request().query(dailyStatsQuery),
      db.request().query(userStatsQuery)
    ])

    const stats = statsResult.recordset[0] || {
      total_uploads: 0,
      verified_uploads: 0,
      pending_uploads: 0,
      unique_users: 0,
      oldest_upload: null,
      latest_upload: null
    }

    const dailyStats = dailyStatsResult.recordset || []
    const userStats = userStatsResult.recordset || []

    const verificationRate = stats.total_uploads > 0 ? 
      (stats.verified_uploads / stats.total_uploads) * 100 : 0

    return {
      overall: {
        totalUploads: stats.total_uploads || 0,
        verifiedUploads: stats.verified_uploads || 0,
        pendingUploads: stats.pending_uploads || 0,
        uniqueUsers: stats.unique_users || 0,
        verificationRate: Math.round(verificationRate * 100) / 100,
        oldestUpload: stats.oldest_upload,
        latestUpload: stats.latest_upload
      },
      dailyStats: dailyStats.map(day => ({
        date: day.upload_date,
        uploads: day.daily_uploads || 0,
        verified: day.daily_verified || 0
      })),
      topUsers: userStats.map(user => ({
        userId: user.user_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        totalUploads: user.total_uploads || 0,
        verifiedUploads: user.verified_uploads || 0
      }))
    }

  } catch (error: any) {
    console.error('Error in getUploadStatsService:', error)
    throw new Error('Failed to fetch upload statistics')
  }
}

export const getUploadByIdService = async (uploadId: number, requestingUserId: number, requestingUserRole: string) => {
  const db = getDbPool()
  
  try {
    const query = `
      SELECT 
        dlu.*,
        u.first_name,
        u.last_name,
        u.email,
        u.contact_phone,
        u.role
      FROM DriverLicenseUploads dlu
      JOIN Users u ON dlu.user_id = u.user_id
      WHERE dlu.upload_id = @upload_id
    `

    const result = await db.request()
      .input('upload_id', uploadId)
      .query(query)

    if (!result.recordset[0]) {
      return null
    }

    const upload = result.recordset[0]

    // Check permissions: users can access their own uploads, admins can access all
    if (requestingUserRole !== 'admin' && requestingUserId !== upload.user_id) {
      return null
    }

    return {
      uploadId: upload.upload_id,
      userId: upload.user_id,
      licenseNumber: upload.license_number,
      fileType: upload.file_type,
      fileName: upload.file_name,
      filePath: upload.file_path,
      uploadedAt: upload.uploaded_at,
      verified: upload.verified_by_admin,
      verifiedAt: upload.verified_at,
      verificationNotes: upload.verification_notes,
      user: {
        firstName: upload.first_name,
        lastName: upload.last_name,
        email: upload.email,
        contactPhone: upload.contact_phone,
        role: upload.role
      }
    }

  } catch (error: any) {
    console.error('Error in getUploadByIdService:', error)
    throw new Error('Failed to fetch upload details')
  }
}

export const deleteUploadService = async (uploadId: number, requestingUserId: number, requestingUserRole: string) => {
  const db = getDbPool()
  
  try {
    // First get the upload to check permissions and file path
    const getQuery = `
      SELECT user_id, file_path FROM DriverLicenseUploads WHERE upload_id = @upload_id
    `
    
    const getResult = await db.request()
      .input('upload_id', uploadId)
      .query(getQuery)

    if (!getResult.recordset[0]) {
      return {
        success: false,
        error: 'Upload not found'
      }
    }

    const upload = getResult.recordset[0]

    // Check permissions: users can only delete their own uploads, admins can delete any
    if (requestingUserRole !== 'admin' && requestingUserId !== upload.user_id) {
      return {
        success: false,
        error: 'Unauthorized to delete this upload'
      }
    }

    // Delete from database
    const deleteQuery = `
      DELETE FROM DriverLicenseUploads WHERE upload_id = @upload_id
    `
    
    const deleteResult = await db.request()
      .input('upload_id', uploadId)
      .query(deleteQuery)

    if (deleteResult.rowsAffected[0] === 0) {
      return {
        success: false,
        error: 'Failed to delete upload from database'
      }
    }

    // Delete physical file
    try {
      if (existsSync(upload.file_path)) {
        await unlink(upload.file_path)
      }
    } catch (fileError) {
      console.error('Failed to delete physical file:', fileError)
      // Continue even if file deletion fails - the database record is already deleted
    }

    return {
      success: true,
      message: 'Upload deleted successfully'
    }

  } catch (error: any) {
    console.error('Error in deleteUploadService:', error)
    return {
      success: false,
      error: 'Failed to delete upload'
    }
  }
}

export const getUserUploadStatsService = async (userId: number) => {
  const db = getDbPool()
  
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_uploads,
        SUM(CASE WHEN verified_by_admin = 1 THEN 1 ELSE 0 END) as verified_uploads,
        SUM(CASE WHEN verified_by_admin = 0 THEN 1 ELSE 0 END) as pending_uploads,
        MIN(uploaded_at) as first_upload,
        MAX(uploaded_at) as last_upload
      FROM DriverLicenseUploads
      WHERE user_id = @user_id
    `

    const recentUploadsQuery = `
      SELECT TOP 5 
        upload_id,
        file_type,
        file_name,
        uploaded_at,
        verified_by_admin,
        verified_at
      FROM DriverLicenseUploads
      WHERE user_id = @user_id
      ORDER BY uploaded_at DESC
    `

    const [statsResult, recentUploadsResult] = await Promise.all([
      db.request().input('user_id', userId).query(statsQuery),
      db.request().input('user_id', userId).query(recentUploadsQuery)
    ])

    const stats = statsResult.recordset[0] || {
      total_uploads: 0,
      verified_uploads: 0,
      pending_uploads: 0,
      first_upload: null,
      last_upload: null
    }

    const recentUploads = recentUploadsResult.recordset || []

    return {
      totalUploads: stats.total_uploads || 0,
      verifiedUploads: stats.verified_uploads || 0,
      pendingUploads: stats.pending_uploads || 0,
      firstUpload: stats.first_upload,
      lastUpload: stats.last_upload,
      recentUploads: recentUploads.map(upload => ({
        uploadId: upload.upload_id,
        fileType: upload.file_type,
        fileName: upload.file_name,
        uploadedAt: upload.uploaded_at,
        verified: upload.verified_by_admin,
        verifiedAt: upload.verified_at
      }))
    }

  } catch (error: any) {
    console.error('Error in getUserUploadStatsService:', error)
    throw new Error('Failed to fetch user upload statistics')
  }
}