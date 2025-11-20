import { type Context } from "hono"
import * as paymentServices from "./payment.service.ts";

// Create payment intent
export const createPaymentIntent = async (c: Context) => {
    try {
        const customer = c.customer;
        const body = await c.req.json()

        // Validate required fields
        if (!body.booking_id || !body.amount) {
            return c.json({ error: 'Booking ID and amount are required' }, 400);
        }

        const result = await paymentServices.createPaymentIntentService(
            body.booking_id,
            body.amount,
            customer.user_id
        );

        if (typeof result === "string") {
            return c.json({ error: result }, 400);
        }

        return c.json({ 
            message: 'Payment intent created successfully', 
            payment_intent: result 
        }, 201);
    } catch (error: any) {
        console.error('Error creating payment intent:', error.message);
        return c.json({ error: error.message }, 500);
    }
}

// Confirm payment
export const confirmPayment = async (c: Context) => {
    try {
        const customer = c.customer;
        const body = await c.req.json()

        // Validate required fields
        if (!body.payment_intent_id || !body.booking_id) {
            return c.json({ error: 'Payment intent ID and booking ID are required' }, 400);
        }

        const result = await paymentServices.confirmPaymentService(
            body.payment_intent_id,
            body.booking_id,
            customer.user_id
        );

        if (typeof result === "string") {
            return c.json({ error: result }, 400);
        }

        return c.json({ 
            message: 'Payment confirmed successfully 🎊', 
            payment: result 
        }, 200);
    } catch (error: any) {
        console.error('Error confirming payment:', error.message);
        return c.json({ error: error.message }, 500);
    }
}

// Get payment by booking ID
export const getPaymentByBookingId = async (c: Context) => {
    const booking_id = parseInt(c.req.param('booking_id'))
    try {
        const customer = c.customer;
        
        const result = await paymentServices.getPaymentByBookingIdService(booking_id);
        if (result === null) {
            return c.json({ error: 'Payment not found' }, 404);
        }

        // Users can only see their own payments, admins can see all
        const booking = await paymentServices.getBookingByIdService(booking_id);
        if (customer.user_type !== 'admin' && booking.user_id !== customer.user_id) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        return c.json(result);
    } catch (error) {
        console.error('Error fetching payment:', error);
        return c.json({ error: 'Failed to fetch payment' }, 500);
    }
}

// Get all payments (admin only)
export const getAllPayments = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await paymentServices.getAllPaymentsService();
        
        if (result.length === 0) {
            return c.json({ message: 'No payments found' }, 404);
        }
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching all payments:', error.message);
        return c.json({ error: 'Failed to fetch payments' }, 500);
    }
}

// Process payment webhook (for Stripe/M-Pesa)
export const processPaymentWebhook = async (c: Context) => {
    try {
        const body = await c.req.json();
        
        const result = await paymentServices.processPaymentWebhookService(body);

        if (typeof result === "string") {
            return c.json({ error: result }, 400);
        }

        return c.json({ 
            message: 'Webhook processed successfully', 
            result 
        }, 200);
    } catch (error: any) {
        console.error('Error processing webhook:', error.message);
        return c.json({ error: 'Failed to process webhook' }, 500);
    }
}