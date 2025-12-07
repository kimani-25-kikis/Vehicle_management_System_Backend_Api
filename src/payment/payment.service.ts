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

// Get payment by booking ID with detailed info
export const getPaymentByBookingIdService = async (booking_id: number): Promise<any> => {
  const db = getDbPool();
  
  try {
    const query = `
      SELECT 
        p.*,
        b.booking_status,
        b.verified_by_admin,
        b.driver_license_front_url,
        b.driver_license_back_url,
        b.driver_license_number,
        b.total_amount as booking_total,
        u.first_name + ' ' + u.last_name as user_name,
        u.email as user_email,
        vs.model as vehicle_model,
        vs.manufacturer as vehicle_manufacturer
      FROM PaymentsTable p
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
  } catch (error: any) {
    console.error('Error in getPaymentByBookingIdService:', error);
    throw new Error("Failed to fetch payment details: " + error.message);
  }
}

// Get booking payment details for workflow
export const getBookingPaymentDetailsService = async (booking_id: number): Promise<any> => {
  const db = getDbPool();
  
  try {
    const paymentQuery = `
      SELECT 
        p.payment_id,
        p.booking_id,
        p.amount,
        p.payment_status,
        p.payment_method,
        p.transaction_id,
        p.created_at as payment_created,
        p.updated_at as payment_updated
      FROM PaymentsTable p
      WHERE p.booking_id = @booking_id
    `;
    
    const bookingQuery = `
      SELECT 
        b.booking_id,
        b.booking_status,
        b.verified_by_admin,
        b.driver_license_front_url,
        b.driver_license_back_url,
        b.driver_license_number,
        b.driver_license_expiry,
        b.total_amount,
        b.pickup_date,
        b.return_date,
        b.pickup_location,
        b.return_location,
        b.admin_notes,
        u.user_id,
        u.first_name + ' ' + u.last_name as user_name,
        u.email as user_email
      FROM Bookings b
      JOIN Users u ON b.user_id = u.user_id
      WHERE b.booking_id = @booking_id
    `;
    
    const [paymentResult, bookingResult] = await Promise.all([
      db.request().input('booking_id', booking_id).query(paymentQuery),
      db.request().input('booking_id', booking_id).query(bookingQuery)
    ]);

    return {
      payment: paymentResult.recordset[0] || null,
      booking: bookingResult.recordset[0] || null
    };
  } catch (error: any) {
    console.error('Error in getBookingPaymentDetailsService:', error);
    throw new Error("Failed to fetch booking payment details: " + error.message);
  }
}

// Verify payment service
export const verifyPaymentService = async (
  payment_id: number,
  verified: boolean,
  admin_notes: string,
  admin_id: number
): Promise<PaymentResponse | string> => {
  const db = getDbPool();
  
  try {
    const updateQuery = `
      UPDATE PaymentsTable 
      SET payment_status = @payment_status,
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE payment_id = @payment_id
    `;
    
    const result = await db.request()
      .input('payment_id', payment_id)
      .input('payment_status', verified ? 'Completed' : 'Pending')
      .query(updateQuery);

    if (result.recordset.length === 0) {
      return "Payment not found";
    }

    // Update booking admin notes if provided
    if (admin_notes) {
      const bookingQuery = `
        SELECT booking_id FROM PaymentsTable WHERE payment_id = @payment_id
      `;
      const bookingResult = await db.request()
        .input('payment_id', payment_id)
        .query(bookingQuery);

      if (bookingResult.recordset.length > 0) {
        const booking_id = bookingResult.recordset[0].booking_id;
        
        const updateBookingQuery = `
          UPDATE Bookings 
          SET admin_notes = CONCAT(COALESCE(admin_notes + ' | ', ''), @admin_notes),
              updated_at = GETDATE()
          WHERE booking_id = @booking_id
        `;
        
        await db.request()
          .input('booking_id', booking_id)
          .input('admin_notes', `${new Date().toISOString()} - Admin #${admin_id}: ${admin_notes}`)
          .query(updateBookingQuery);
      }
    }

    return result.recordset[0];
  } catch (error: any) {
    console.error('Error in verifyPaymentService:', error);
    return "Failed to verify payment: " + error.message;
  }
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
// export const getPaymentByBookingIdService = async (booking_id: number): Promise<PaymentWithDetails | null> => {
//   const db = getDbPool();
//   const query = `
//     SELECT 
//       p.*,
//       u.first_name + ' ' + u.last_name as user_name,
//       u.email as user_email,
//       b.booking_status,
//       vs.model as vehicle_model
//     FROM Payments p
//     JOIN Bookings b ON p.booking_id = b.booking_id
//     JOIN Users u ON b.user_id = u.user_id
//     JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
//     JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
//     WHERE p.booking_id = @booking_id
//   `;
//   const result = await db.request()
//     .input('booking_id', booking_id)
//     .query(query);
//   return result.recordset[0] || null;
// }

// Get all payments (admin only)
// In payment.service.ts - Update getAllPaymentsService
export const getAllPaymentsService = async (): Promise<PaymentWithDetails[]> => {
  const db = getDbPool();
  
  try {
    const query = `
      SELECT 
        p.*,
        u.first_name + ' ' + u.last_name as user_name,
        u.email as user_email,
        b.booking_status,
        vs.model as vehicle_model,
        vs.manufacturer as vehicle_manufacturer
      FROM PaymentsTable p
      JOIN Bookings b ON p.booking_id = b.booking_id
      JOIN Users u ON b.user_id = u.user_id
      JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
      JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
      WHERE p.transaction_id IS NOT NULL -- Only show payments with transaction_id
      ORDER BY p.created_at DESC
    `;
    
    const result = await db.request().query(query);
    return result.recordset;
  } catch (error: any) {
    console.error('Error in getAllPaymentsService:', error);
    throw new Error("Failed to fetch payments: " + error.message);
  }
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

// Get payment statistics
// In payment.service.ts - Update getPaymentStatsService
export const getPaymentStatsService = async (): Promise<any> => {
  const db = getDbPool();
  
  try {
    const query = `
      SELECT 
        -- Total revenue from COMPLETED payments only
        SUM(CASE WHEN payment_status = 'Completed' THEN amount ELSE 0 END) as total_revenue,
        
        -- Monthly revenue from COMPLETED payments in current month
        SUM(CASE 
          WHEN payment_status = 'Completed' 
          AND MONTH(created_at) = MONTH(GETDATE()) 
          AND YEAR(created_at) = YEAR(GETDATE()) 
          THEN amount 
          ELSE 0 
        END) as monthly_revenue,
        
        -- Today's revenue from COMPLETED payments
        SUM(CASE 
          WHEN payment_status = 'Completed' 
          AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE) 
          THEN amount 
          ELSE 0 
        END) as today_revenue,
        
        -- Payment status breakdown
        COUNT(CASE WHEN payment_status = 'Completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN payment_status = 'Pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN payment_status = 'Failed' THEN 1 END) as failed_payments,
        COUNT(CASE WHEN payment_status = 'Refunded' THEN 1 END) as refunded_payments,
        
        -- Refunded amount
        SUM(CASE WHEN payment_status = 'Refunded' THEN amount ELSE 0 END) as refunded_amount,
        
        -- Total payments count
        COUNT(*) as total_payments
        
      FROM PaymentsTable
      WHERE transaction_id IS NOT NULL -- Only payments with transaction_id
    `;
    
    const result = await db.request().query(query);
    
    // Default values if no payments
    const stats = result.recordset[0] || {
      total_revenue: 0,
      monthly_revenue: 0,
      today_revenue: 0,
      completed_payments: 0,
      pending_payments: 0,
      failed_payments: 0,
      refunded_payments: 0,
      refunded_amount: 0,
      total_payments: 0
    };
    
    return stats;
  } catch (error: any) {
    console.error('Error in getPaymentStatsService:', error);
    throw new Error("Failed to fetch payment statistics: " + error.message);
  }
}

// Update payment status
// Add to payment.service.ts
export const updatePaymentStatusService = async (
  payment_id: number,
  payment_status: string,
  admin_notes?: string
): Promise<PaymentResponse | string> => {
  const db = getDbPool();
  
  try {
    // 1. Check if payment exists
    const checkQuery = `
      SELECT payment_id, booking_id, payment_status 
      FROM PaymentsTable 
      WHERE payment_id = @payment_id
    `;
    
    const checkResult = await db.request()
      .input('payment_id', payment_id)
      .query(checkQuery);

    if (checkResult.recordset.length === 0) {
      return "Payment not found";
    }

    const currentPayment = checkResult.recordset[0];
    const booking_id = currentPayment.booking_id;

    // 2. Update payment status
    const updateQuery = `
      UPDATE PaymentsTable 
      SET payment_status = @payment_status, 
          updated_at = GETDATE()
      OUTPUT INSERTED.*
      WHERE payment_id = @payment_id
    `;
    
    const result = await db.request()
      .input('payment_id', payment_id)
      .input('payment_status', payment_status)
      .query(updateQuery);

    if (result.recordset.length === 0) {
      return "Failed to update payment status";
    }

    // 3. Add admin notes if provided
    if (admin_notes) {
      const notesQuery = `
        UPDATE PaymentsTable 
        SET admin_notes = CONCAT(COALESCE(admin_notes + ' | ', ''), @admin_notes)
        WHERE payment_id = @payment_id
      `;
      
      await db.request()
        .input('payment_id', payment_id)
        .input('admin_notes', `${new Date().toISOString()}: ${admin_notes}`)
        .query(notesQuery);
    }

    // 4. If marking as Completed, also update booking status to Confirmed
    if (payment_status === 'Completed' && booking_id) {
      const updateBookingQuery = `
        UPDATE Bookings 
        SET booking_status = 'Confirmed', 
            updated_at = GETDATE()
        WHERE booking_id = @booking_id
      `;
      
      await db.request()
        .input('booking_id', booking_id)
        .query(updateBookingQuery);
    }

    // 5. If marking as Refunded, also update booking status to Cancelled
    if (payment_status === 'Refunded' && booking_id) {
      const updateBookingQuery = `
        UPDATE Bookings 
        SET booking_status = 'Cancelled', 
            updated_at = GETDATE()
        WHERE booking_id = @booking_id
      `;
      
      await db.request()
        .input('booking_id', booking_id)
        .query(updateBookingQuery);
    }

    // 6. Get updated payment with details
    const finalQuery = `
      SELECT 
        p.*,
        u.first_name + ' ' + u.last_name as user_name,
        u.email as user_email,
        b.booking_status,
        vs.model as vehicle_model
      FROM PaymentsTable p
      JOIN Bookings b ON p.booking_id = b.booking_id
      JOIN Users u ON b.user_id = u.user_id
      JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
      JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
      WHERE p.payment_id = @payment_id
    `;
    
    const finalResult = await db.request()
      .input('payment_id', payment_id)
      .query(finalQuery);

    return finalResult.recordset[0];
  } catch (error: any) {
    console.error('Error in updatePaymentStatusService:', error);
    return "Failed to update payment status: " + error.message;
  }
}

// Export payments to CSV
export const exportPaymentsService = async (filters: any): Promise<string> => {
  const db = getDbPool();
  
  try {
    let query = `
      SELECT 
        p.payment_id,
        p.booking_id,
        u.first_name + ' ' + u.last_name as user_name,
        u.email as user_email,
        p.amount,
        p.payment_status,
        p.payment_method,
        p.transaction_id,
        FORMAT(p.created_at, 'yyyy-MM-dd HH:mm:ss') as created_at,
        FORMAT(p.updated_at, 'yyyy-MM-dd HH:mm:ss') as updated_at,
        b.booking_status,
        vs.model as vehicle_model
      FROM PaymentsTable p
      JOIN Bookings b ON p.booking_id = b.booking_id
      JOIN Users u ON b.user_id = u.user_id
      JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
      JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
      WHERE 1=1
    `;
    
    const request = db.request();
    
    // Apply filters
    if (filters.payment_status) {
      query += ' AND p.payment_status = @payment_status';
      request.input('payment_status', filters.payment_status);
    }
    
    if (filters.payment_method) {
      query += ' AND p.payment_method = @payment_method';
      request.input('payment_method', filters.payment_method);
    }
    
    if (filters.date_from) {
      query += ' AND CAST(p.created_at AS DATE) >= @date_from';
      request.input('date_from', filters.date_from);
    }
    
    if (filters.date_to) {
      query += ' AND CAST(p.created_at AS DATE) <= @date_to';
      request.input('date_to', filters.date_to);
    }
    
    if (filters.search) {
      query += ' AND (u.first_name + \' \' + u.last_name LIKE @search OR u.email LIKE @search OR p.transaction_id LIKE @search)';
      request.input('search', `%${filters.search}%`);
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const result = await request.query(query);
    
    // Convert to CSV
    if (result.recordset.length === 0) {
      return 'No data to export';
    }
    
    const headers = Object.keys(result.recordset[0]).join(',');
    const rows = result.recordset.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      ).join(',')
    );
    
    return [headers, ...rows].join('\n');
  } catch (error: any) {
    console.error('Error in exportPaymentsService:', error);
    throw new Error("Failed to export payments: " + error.message);
  }
}

