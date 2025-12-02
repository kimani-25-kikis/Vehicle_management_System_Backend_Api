import { Hono } from 'hono'
import * as bookingControllers from './booking.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const bookingRoutes = new Hono()

// Apply auth middleware to all routes
bookingRoutes.use('*', bothRolesAuth)

// User routes
bookingRoutes.post('', bookingControllers.createBooking)
bookingRoutes.get('/my-bookings', bookingControllers.getUserBookings)
bookingRoutes.get('/:booking_id', bookingControllers.getBookingById)
bookingRoutes.delete('/:booking_id', bookingControllers.cancelBooking)

// Payment-related routes
bookingRoutes.post('/:booking_id/confirm-payment', bookingControllers.confirmBookingPayment)
bookingRoutes.put('/:booking_id/extend', bookingControllers.extendBooking)

// Admin only routes
bookingRoutes.get('',  bookingControllers.getAllBookings)
bookingRoutes.put('/:booking_id/status',  bookingControllers.updateBookingStatus)
bookingRoutes.post('/:booking_id/refund',  bookingControllers.refundBookingPayment)

// NEW: Admin statistics and management routes
bookingRoutes.get('/stats', bookingControllers.getBookingStats)
bookingRoutes.patch('/:booking_id/verify-license', bookingControllers.verifyDriverLicense)
bookingRoutes.get('/export',  bookingControllers.exportBookings)

// NEW: Driver license download routes
bookingRoutes.get('/:booking_id/license/front',  bookingControllers.downloadDriverLicenseFront)
bookingRoutes.get('/:booking_id/license/back',  bookingControllers.downloadDriverLicenseBack)

export default bookingRoutes