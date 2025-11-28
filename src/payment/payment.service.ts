import { getDbPool } from "../db/db.config.ts";
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});

interface PaymentResponse {
  payment_id: number;
  booking_id: number;
  amount: number;
  payment_status: string;
  payment_date: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentWithDetails extends PaymentResponse {
  user_name: string;
  user_email: string;
  booking_status: string;
  vehicle_model: string;
}

// Create Stripe payment intent
export const createPaymentService = async (   booking_id: number,   user_id: number,
  total_amount: number,  id:string //   payment_method:string,
): Promise<string> => {
  const db = getDbPool();  
  try {  
    // Create pending payment record in database
    const paymentQuery = `
      INSERT INTO PaymentsTable (booking_id,user_id, amount, payment_method, transaction_id)
      OUTPUT INSERTED.*
      VALUES (@booking_id, @user_id, @amount, @payment_method, @transaction_id)
    `;    
    const paymentResult = await db.request()
      .input('booking_id', booking_id)
      .input('user_id', user_id)
      .input('amount', total_amount ) 
      .input('payment_method', 'stripe')
      .input('transaction_id', id)
      .query(paymentQuery);
      return paymentResult.recordset.length > 0 ? "done" :"failed"

  } catch (error: any) {
    // console.error('❌ Error in createPaymentIntentService:', error);
    // console.error('❌ Error stack:', error.stack);
    return "Failed to create payment intent: " + error.message;
  }
}

// Confirm and verify Stripe payment
export const confirmPaymentService = async (
  payment_intent_id: string,
  booking_id: number,
  user_id: number
): Promise<PaymentResponse | string> => {
  const db = getDbPool();
  
  try {
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return `Payment not successful. Status: ${paymentIntent.status}`;
    }

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

    // Update payment record to completed
    const updatePaymentQuery = `
      UPDATE Payments 
      SET payment_status = 'Completed', 
          payment_date = GETDATE(),
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE transaction_id = @transaction_id AND booking_id = @booking_id
    `;
    
    const paymentResult = await db.request()
      .input('transaction_id', payment_intent_id)
      .input('booking_id', booking_id)
      .query(updatePaymentQuery);

    if (paymentResult.recordset.length === 0) {
      return "Payment record not found";
    }

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
    return "Failed to confirm payment: " + error.message;
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

// Process Stripe webhook
export const processPaymentWebhookService = async (webhookData: any, stripeSignature: string): Promise<any | string> => {
  try {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(
        JSON.stringify(webhookData),
        stripeSignature,
        endpointSecret!
      );
    } catch (err: any) {
      console.error(`Webhook signature verification failed.`, err.message);
      return `Webhook Error: ${err.message}`;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await handleSuccessfulPayment(paymentIntent);
        break;
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        await handleFailedPayment(failedPayment);
        break;
      case 'payment_intent.canceled':
        const canceledPayment = event.data.object;
        await handleCanceledPayment(canceledPayment);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { received: true, event: event.type };
  } catch (error: any) {
    console.error('Error in processPaymentWebhookService:', error);
    return "Failed to process webhook: " + error.message;
  }
}

// Handle successful payment from webhook
const handleSuccessfulPayment = async (paymentIntent: any) => {
  const db = getDbPool();
  
  try {
    const booking_id = paymentIntent.metadata.booking_id;
    
    // Update payment status
    const updatePaymentQuery = `
      UPDATE Payments 
      SET payment_status = 'Completed', 
          payment_date = GETDATE(),
          updated_at = GETDATE()
      WHERE transaction_id = @transaction_id
    `;
    
    await db.request()
      .input('transaction_id', paymentIntent.id)
      .query(updatePaymentQuery);

    // Update booking status
    if (booking_id) {
      const updateBookingQuery = `
        UPDATE Bookings 
        SET booking_status = 'Confirmed', updated_at = GETDATE()
        WHERE booking_id = @booking_id
      `;
      
      await db.request()
        .input('booking_id', parseInt(booking_id))
        .query(updateBookingQuery);
    }

    console.log(`✅ Payment ${paymentIntent.id} processed successfully for booking ${booking_id}`);
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// Handle failed payment from webhook
const handleFailedPayment = async (paymentIntent: any) => {
  const db = getDbPool();
  
  try {
    const updatePaymentQuery = `
      UPDATE Payments 
      SET payment_status = 'Failed', 
          updated_at = GETDATE()
      WHERE transaction_id = @transaction_id
    `;
    
    await db.request()
      .input('transaction_id', paymentIntent.id)
      .query(updatePaymentQuery);

    console.log(`❌ Payment ${paymentIntent.id} failed`);
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

// Handle canceled payment from webhook
const handleCanceledPayment = async (paymentIntent: any) => {
  const db = getDbPool();
  
  try {
    const updatePaymentQuery = `
      UPDATE Payments 
      SET payment_status = 'Failed', 
          updated_at = GETDATE()
      WHERE transaction_id = @transaction_id
    `;
    
    await db.request()
      .input('transaction_id', paymentIntent.id)
      .query(updatePaymentQuery);

    console.log(`❌ Payment ${paymentIntent.id} was canceled`);
  } catch (error) {
    console.error('Error handling canceled payment:', error);
  }
}

// Refund payment
export const refundPaymentService = async (
  payment_id: number,
  user_id: number,
  user_type: string
): Promise<PaymentResponse | string> => {
  const db = getDbPool();
  
  try {
    // Get payment details
    const paymentQuery = `
      SELECT p.*, b.user_id as booking_user_id
      FROM Payments p
      JOIN Bookings b ON p.booking_id = b.booking_id
      WHERE p.payment_id = @payment_id
    `;
    const paymentResult = await db.request()
      .input('payment_id', payment_id)
      .query(paymentQuery);

    if (paymentResult.recordset.length === 0) {
      return "Payment not found";
    }

    const payment = paymentResult.recordset[0];

    // Check authorization (admin or payment owner)
    if (user_type !== 'admin' && payment.booking_user_id !== user_id) {
      return "Unauthorized to refund this payment";
    }

    // Check if payment can be refunded
    if (payment.payment_status !== 'Completed') {
      return "Only completed payments can be refunded";
    }

    if (!payment.transaction_id) {
      return "Transaction ID not found for refund";
    }

    // Process refund with Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.transaction_id,
    });

    // Update payment status to Refunded
    const updatePaymentQuery = `
      UPDATE Payments 
      SET payment_status = 'Refunded', 
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE payment_id = @payment_id
    `;
    
    const updateResult = await db.request()
      .input('payment_id', payment_id)
      .query(updatePaymentQuery);

    // Update booking status to Cancelled
    const updateBookingQuery = `
      UPDATE Bookings 
      SET booking_status = 'Cancelled', updated_at = GETDATE()
      WHERE booking_id = @booking_id
    `;
    
    await db.request()
      .input('booking_id', payment.booking_id)
      .query(updateBookingQuery);

    return updateResult.recordset[0];
  } catch (error: any) {
    console.error('Error in refundPaymentService:', error);
    return "Failed to process refund: " + error.message;
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