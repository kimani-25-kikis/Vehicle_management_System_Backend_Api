// dashboard-data.route.ts
import { Hono } from 'hono'
import * as dataControllers from './admin_dashboard.controller.ts'
import { adminRoleAuth, bothRolesAuth } from '../middleware/bearAuth.js'

const dataRoutes = new Hono()

// ----------------------------
// ADMIN DASHBOARD ROUTES
// ----------------------------

// GET admin dashboard summary stats
dataRoutes.get('/admin',adminRoleAuth, dataControllers.getAdminData)

// ----------------------------
// USER DASHBOARD ROUTES
// ----------------------------

// GET dashboard data for a specific user
dataRoutes.get(
  '/dashboard/:user_id',
  // bothRolesAuth,             // Enable if you want Admin/User auth checking
  dataControllers.getUserDataById
)

export default dataRoutes
