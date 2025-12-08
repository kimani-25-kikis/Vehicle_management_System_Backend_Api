import { Hono } from 'hono'
import * as paymentControllers from './pyment.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const paymentRoutes = new Hono()


// paymentRoutes.use('*', bothRolesAuth)


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
paymentRoutes.post('/payments/paystack-webhook', paymentControllers.handlePaystackWebhook);

// ==================== M-PESA (PAYSTACK) ROUTES ====================
paymentRoutes.post('/payments/mpesa/initialize', paymentControllers.initializeMpesaPayment)


export default paymentRoutes