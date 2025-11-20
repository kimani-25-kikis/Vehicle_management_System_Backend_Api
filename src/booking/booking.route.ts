import {Hono} from 'hono'
import * as bookingControllers from './booking.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const bookingRoutes = new Hono()

bookingRoutes.use('*', bothRolesAuth)

// User routes
bookingRoutes.post('/bookings', bookingControllers.createBooking)
bookingRoutes.get('/bookings/my-bookings', bookingControllers.getUserBookings)
bookingRoutes.get('/bookings/:booking_id', bookingControllers.getBookingById)
bookingRoutes.delete('/bookings/:booking_id', bookingControllers.cancelBooking)

// Admin only routes
bookingRoutes.get('/bookings', adminRoleAuth, bookingControllers.getAllBookings)
bookingRoutes.put('/bookings/:booking_id/status', adminRoleAuth, bookingControllers.updateBookingStatus)

export default bookingRoutes