import { Hono } from 'hono'
import * as paymentControllers from './pyment.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const paymentRoutes = new Hono()

// ADD THIS LINE - Apply auth to all payment routes
paymentRoutes.use('*', bothRolesAuth)

// Now all these routes will be protected
paymentRoutes.post('/payments/create-intent', paymentControllers.checkoutBooking)
paymentRoutes.post('/payments/confirm', paymentControllers.confirmPayment)
paymentRoutes.get('/payments/booking/:booking_id', paymentControllers.getPaymentByBookingId)
paymentRoutes.get('/payments', adminRoleAuth, paymentControllers.getAllPayments)
paymentRoutes.post('/payments/refund', paymentControllers.refundPayment)
paymentRoutes.get('/payments/stats', adminRoleAuth, paymentControllers.getPaymentStats)
paymentRoutes.get('/payments/export', adminRoleAuth, paymentControllers.exportPayments)

paymentRoutes.get('/payments/my-payments', paymentControllers.getMyPayments)
paymentRoutes.get('/payments/my-spending-stats', paymentControllers.getMySpendingStats)
paymentRoutes.put('/payments/:payment_id/status', adminRoleAuth, paymentControllers.updatePaymentStatus)

// Webhook route (no auth required for webhooks)
paymentRoutes.post('/payments/webhook', paymentControllers.processPaymentWebhook)

export default paymentRoutes