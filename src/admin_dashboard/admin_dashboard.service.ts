// dashboard-data.service.ts
import sql from 'mssql'
import { getDbPool } from '../db/db.config.ts'  // adjust path if needed

export const getAdminDashboardDataService = async () => {
  const pool = getDbPool()
  const request = pool.request()

  // Example queries - change table names as needed
  const totalUsers = await request.query(`SELECT COUNT(*) AS total FROM Users`)
  const totalVehicles = await request.query(`SELECT COUNT(*) AS total FROM Vehicles`)
  const totalBookings = await request.query(`SELECT COUNT(*) AS total FROM Bookings`)
  const totalRevenue = await request.query(`
    SELECT SUM(amount) AS total FROM Payments
  `)

  return {
    totalUsers: totalUsers.recordset[0].total,
    totalVehicles: totalVehicles.recordset[0].total,
    totalBookings: totalBookings.recordset[0].total,
    totalRevenue: totalRevenue.recordset[0].total || 0,
  }
}

export const getUserDashboardDataService = async (user_id: string) => {
  const pool = getDbPool()
  const request = pool.request()
  request.input('user_id', sql.Int, user_id)

  // Fetch basic user info
  const user = await request.query(`
    SELECT user_id, fullname, email, phone 
    FROM Users 
    WHERE user_id = @user_id
  `)

  if (user.recordset.length === 0) return null

  // Count user bookings
  const bookings = await request.query(`
    SELECT COUNT(*) AS total 
    FROM Bookings 
    WHERE user_id = @user_id
  `)

  // Last 5 bookings
  const recentBookings = await request.query(`
    SELECT TOP 5 *
    FROM Bookings
    WHERE user_id = @user_id
    ORDER BY booking_date DESC
  `)

  return {
    user: user.recordset[0],
    totalBookings: bookings.recordset[0].total,
    recentBookings: recentBookings.recordset,
  }
}
