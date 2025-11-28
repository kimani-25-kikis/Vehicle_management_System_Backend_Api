import { Hono } from 'hono'
import * as bookingControllers from './booking.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const bookingRoutes = new Hono()

// Apply auth middleware to all routes
bookingRoutes.use('*', bothRolesAuth)

// User routes
bookingRoutes.post('/bookings', bookingControllers.createBooking)
bookingRoutes.get('/bookings/my-bookings', bookingControllers.getUserBookings)
bookingRoutes.get('/bookings/:booking_id', bookingControllers.getBookingById)
bookingRoutes.delete('/bookings/:booking_id', bookingControllers.cancelBooking)

// NEW: Payment-related booking routes
bookingRoutes.post('/:booking_id/confirm-payment', bookingControllers.confirmBookingPayment)
bookingRoutes.put('/:booking_id/extend', bookingControllers.extendBooking)

// Admin only routes
bookingRoutes.get('/', adminRoleAuth, bookingControllers.getAllBookings)
bookingRoutes.put('/:booking_id/status', adminRoleAuth, bookingControllers.updateBookingStatus)

// NEW: Admin payment management
bookingRoutes.post('/:booking_id/refund', adminRoleAuth, bookingControllers.refundBookingPayment)

export default bookingRoutes