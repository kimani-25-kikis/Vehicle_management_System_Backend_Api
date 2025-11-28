import { Hono } from 'hono'
import * as paymentControllers from './pyment.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const paymentRoutes = new Hono()

// Apply auth middleware to protected routes
// paymentRoutes.use('*', bothRolesAuth)

// Customer routes
paymentRoutes.post('/payments/create-intent', paymentControllers.checkoutBooking)
paymentRoutes.post('/payments/confirm', paymentControllers.confirmPayment)
paymentRoutes.get('/booking/:booking_id', paymentControllers.getPaymentByBookingId)

// Admin only routes
paymentRoutes.get('/', adminRoleAuth, paymentControllers.getAllPayments)
paymentRoutes.post('/refund', paymentControllers.refundPayment)

// Webhook route (no auth required for webhooks)
paymentRoutes.post('/webhook', paymentControllers.processPaymentWebhook)

export default paymentRoutes