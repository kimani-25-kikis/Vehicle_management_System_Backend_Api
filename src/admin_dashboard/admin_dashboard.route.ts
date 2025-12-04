// dashboard-data.route.ts
import { Hono } from 'hono'
import * as dataControllers from './admin_dashboard.controller.ts'
import { adminRoleAuth, bothRolesAuth } from '../middleware/bearAuth.js'

const dataRoutes = new Hono()

// GET admin dashboard summary stats
dataRoutes.get('/admin',adminRoleAuth, dataControllers.getAdminData)

// GET dashboard data for a specific user
dataRoutes.get(
  '/dashboard/:user_id',
  // bothRolesAuth,             
  dataControllers.getUserDataById
)

export default dataRoutes
