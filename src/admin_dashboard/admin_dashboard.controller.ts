// dashboard-data.controller.ts
import type { Context } from 'hono'
import {
  getAdminDashboardDataService,
  getUserDashboardDataService,
} from './admin_dashboard.service.ts'

export const getAdminData = async (c: Context) => {
  try {
    const data = await getAdminDashboardDataService()

    return c.json({
      success: true,
      message: 'Admin dashboard data fetched successfully',
      data,
    })
  } catch (error: any) {
    console.error('Admin Dashboard Error:', error)

    return c.json(
      {
        success: false,
        message: 'Failed to fetch admin dashboard data',
      },
      500
    )
  }
}

export const getUserDataById = async (c: Context) => {
  try {
    const user_id = c.req.param('user_id')
    const data = await getUserDashboardDataService(user_id)

    if (!data) {
      return c.json(
        { success: false, message: 'User not found' },
        404
      )
    }

    return c.json({
      success: true,
      message: 'User dashboard data fetched successfully',
      data,
    })
  } catch (error: any) {
    console.error('User Dashboard Error:', error)

    return c.json(
      {
        success: false,
        message: 'Failed to fetch user dashboard data',
      },
      500
    )
  }
}
