import { Hono } from 'hono'
import * as bookingControllers from './booking.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const bookingRoutes = new Hono()

// ========== USER ROUTES (with bothRolesAuth) ==========
bookingRoutes.use('*', bothRolesAuth)
bookingRoutes.get('/admin-stats', adminRoleAuth, bookingControllers.getBookingStats)

// User bookings
bookingRoutes.post('', bookingControllers.createBooking)
bookingRoutes.get('/my-bookings', bookingControllers.getUserBookings)
bookingRoutes.get('/:booking_id', bookingControllers.getBookingById)
bookingRoutes.delete('/:booking_id', bookingControllers.cancelBooking)
bookingRoutes.put('/:booking_id/extend', bookingControllers.extendBooking)
bookingRoutes.post('/:booking_id/confirm-payment', bookingControllers.confirmBookingPayment)

// ========== ADMIN ROUTES (with adminRoleAuth) ==========
bookingRoutes.get('', adminRoleAuth, bookingControllers.getAllBookings)
bookingRoutes.put('/:booking_id/status', adminRoleAuth, bookingControllers.updateBookingStatus)
bookingRoutes.post('/:booking_id/refund', adminRoleAuth, bookingControllers.refundBookingPayment)
bookingRoutes.patch('/:booking_id/verify-license', adminRoleAuth, bookingControllers.verifyDriverLicense)
bookingRoutes.get('/export', adminRoleAuth, bookingControllers.exportBookings)

bookingRoutes.get('/:booking_id/license/front', adminRoleAuth, bookingControllers.downloadDriverLicenseFront)
bookingRoutes.get('/:booking_id/license/back', adminRoleAuth, bookingControllers.downloadDriverLicenseBack)

export default bookingRoutes