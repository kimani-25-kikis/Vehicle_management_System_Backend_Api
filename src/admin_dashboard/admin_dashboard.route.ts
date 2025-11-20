import {Hono} from 'hono'
import * as analyticsControllers from './admin_dashboard.controller.ts'
import { adminRoleAuth } from '../middleware/bearAuth.ts'

const analyticsRoutes = new Hono()

// Apply admin auth middleware to all analytics routes
analyticsRoutes.use('*', adminRoleAuth)

// Analytics endpoints
analyticsRoutes.get('/analytics/overview', analyticsControllers.getOverviewStats)
analyticsRoutes.get('/analytics/revenue', analyticsControllers.getRevenueChartData)
analyticsRoutes.get('/analytics/top-vehicles', analyticsControllers.getTopRentedVehicles)
analyticsRoutes.get('/analytics/booking-trends', analyticsControllers.getBookingTrends)
analyticsRoutes.get('/analytics/user-stats', analyticsControllers.getUserStats)
analyticsRoutes.get('/analytics/location-insights', analyticsControllers.getLocationInsights)

export default analyticsRoutes