import { getDbPool } from "../db/db.config.ts"

interface PaymentResponse {
    payment_id: number;
    booking_id: number;
    amount: number;
    payment_status: string;
    payment_date: string;
    payment_method: string;
    transaction_id: string;
    created_at: string;
    updated_at: string;
}

interface PaymentWithDetails extends PaymentResponse {
    user_name: string;
    user_email: string;
    booking_status: string;
    vehicle_model: string;
}

// Create payment intent
export const createPaymentIntentService = async (
    booking_id: number,
    amount: number,
    user_id: number
): Promise<any | string> => {
    const db = getDbPool();
    
    try {
        // Check if booking exists and belongs to user
        const bookingQuery = `
            SELECT b.*, u.user_id 
            FROM Bookings b 
            JOIN Users u ON b.user_id = u.user_id 
            WHERE b.booking_id = @booking_id
        `;
        const bookingResult = await db.request()
            .input('booking_id', booking_id)
            .query(bookingQuery);

        if (bookingResult.recordset.length === 0) {
            return "Booking not found";
        }

        const booking = bookingResult.recordset[0];

        // Check if booking belongs to user
        if (booking.user_id !== user_id) {
            return "Unauthorized to pay for this booking";
        }

        // Check if booking is in a payable state
        if (!['Pending', 'Confirmed'].includes(booking.booking_status)) {
            return "Booking cannot be paid for in its current status";
        }

        // Check if payment already exists and is completed
        const existingPaymentQuery = `
            SELECT * FROM Payments 
            WHERE booking_id = @booking_id AND payment_status = 'Completed'
        `;
        const existingPaymentResult = await db.request()
            .input('booking_id', booking_id)
            .query(existingPaymentQuery);

        if (existingPaymentResult.recordset.length > 0) {
            return "Payment already completed for this booking";
        }

        // For demo purposes, we'll simulate payment intent creation
        // In real implementation, integrate with Stripe/M-Pesa here
        const paymentIntent = {
            id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            client_secret: `cs_${Math.random().toString(36).substr(2, 16)}`,
            amount: amount,
            currency: 'kes',
            status: 'requires_payment_method'
        };

        return paymentIntent;
    } catch (error: any) {
        console.error('Error in createPaymentIntentService:', error);
        return "Failed to create payment intent";
    }
}

// Confirm payment
export const confirmPaymentService = async (
    payment_intent_id: string,
    booking_id: number,
    user_id: number
): Promise<PaymentResponse | string> => {
    const db = getDbPool();
    
    try {
        // Check if booking exists and belongs to user
        const bookingQuery = `
            SELECT b.*, u.user_id 
            FROM Bookings b 
            JOIN Users u ON b.user_id = u.user_id 
            WHERE b.booking_id = @booking_id
        `;
        const bookingResult = await db.request()
            .input('booking_id', booking_id)
            .query(bookingQuery);

        if (bookingResult.recordset.length === 0) {
            return "Booking not found";
        }

        const booking = bookingResult.recordset[0];

        // Check if booking belongs to user
        if (booking.user_id !== user_id) {
            return "Unauthorized to confirm payment for this booking";
        }

        // In real implementation, verify with Stripe/M-Pesa that payment was successful
        // For demo, we'll simulate successful payment

        // Create payment record
        const paymentQuery = `
            INSERT INTO Payments (booking_id, amount, payment_status, payment_date, payment_method, transaction_id)
            OUTPUT INSERTED.*
            VALUES (@booking_id, @amount, @payment_status, @payment_date, @payment_method, @transaction_id)
        `;
        
        const paymentResult = await db.request()
            .input('booking_id', booking_id)
            .input('amount', booking.total_amount)
            .input('payment_status', 'Completed')
            .input('payment_date', new Date().toISOString())
            .input('payment_method', 'stripe') // or 'mpesa'
            .input('transaction_id', payment_intent_id)
            .query(paymentQuery);

        // Update booking status to Confirmed
        const updateBookingQuery = `
            UPDATE Bookings 
            SET booking_status = 'Confirmed', updated_at = GETDATE()
            WHERE booking_id = @booking_id
        `;
        
        await db.request()
            .input('booking_id', booking_id)
            .query(updateBookingQuery);

        return paymentResult.recordset[0];
    } catch (error: any) {
        console.error('Error in confirmPaymentService:', error);
        return "Failed to confirm payment";
    }
}

// Get payment by booking ID
export const getPaymentByBookingIdService = async (booking_id: number): Promise<PaymentWithDetails | null> => {
    const db = getDbPool();
    const query = `
        SELECT 
            p.*,
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email,
            b.booking_status,
            vs.model as vehicle_model
        FROM Payments p
        JOIN Bookings b ON p.booking_id = b.booking_id
        JOIN Users u ON b.user_id = u.user_id
        JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE p.booking_id = @booking_id
    `;
    const result = await db.request()
        .input('booking_id', booking_id)
        .query(query);
    return result.recordset[0] || null;
}

// Get all payments (admin only)
export const getAllPaymentsService = async (): Promise<PaymentWithDetails[]> => {
    const db = getDbPool();
    const query = `
        SELECT 
            p.*,
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email,
            b.booking_status,
            vs.model as vehicle_model
        FROM Payments p
        JOIN Bookings b ON p.booking_id = b.booking_id
        JOIN Users u ON b.user_id = u.user_id
        JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        ORDER BY p.created_at DESC
    `;
    const result = await db.request().query(query);
    return result.recordset;
}

// Process payment webhook
export const processPaymentWebhookService = async (webhookData: any): Promise<any | string> => {
    // This would handle webhooks from Stripe/M-Pesa
    // For demo purposes, we'll simulate webhook processing
    
    try {
        const { type, data } = webhookData;
        
        if (type === 'payment_intent.succeeded') {
            const paymentIntent = data.object;
            
            // Update payment status in database
            const db = getDbPool();
            const updateQuery = `
                UPDATE Payments 
                SET payment_status = 'Completed', payment_date = GETDATE()
                WHERE transaction_id = @transaction_id
            `;
            
            await db.request()
                .input('transaction_id', paymentIntent.id)
                .query(updateQuery);

            return { processed: true, type: 'payment_success' };
        }
        
        return { processed: true, type: 'webhook_received' };
    } catch (error: any) {
        console.error('Error in processPaymentWebhookService:', error);
        return "Failed to process webhook";
    }
}

// Helper function to get booking by ID
export const getBookingByIdService = async (booking_id: number): Promise<any> => {
    const db = getDbPool();
    const query = 'SELECT * FROM Bookings WHERE booking_id = @booking_id';
    const result = await db.request()
        .input('booking_id', booking_id)
        .query(query);
    return result.recordset[0] || null;
}