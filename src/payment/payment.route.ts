import {Hono} from 'hono'
import * as paymentControllers from './pyment.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const paymentRoutes = new Hono()

// Apply auth middleware to protected routes
paymentRoutes.use('*', bothRolesAuth)

// Customer routes
paymentRoutes.post('/payments/create-intent', paymentControllers.createPaymentIntent)
paymentRoutes.post('/payments/confirm', paymentControllers.confirmPayment)
paymentRoutes.get('/payments/booking/:booking_id', paymentControllers.getPaymentByBookingId)

// Admin only routes
paymentRoutes.get('/payments', adminRoleAuth, paymentControllers.getAllPayments)

// Webhook route (no auth required for webhooks)
paymentRoutes.post('/payments/webhook', paymentControllers.processPaymentWebhook)

export default paymentRoutes