import { type Context } from "hono"
import * as paymentServices from "./payment.service.ts";
import Stripe from "stripe";
import dotenv from "dotenv"
import { getDbPool } from "../db/db.config.ts";
import axios from "axios";


dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});

// Paystack configuration - using your credentials
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY!;
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";


// Confirm Stripe payment
export const confirmPayment = async (c: Context) => {
  try {
    const customer = c.customer; // ✅ CHANGED: c.customer instead of c.get('customer')
    const body = await c.req.json()

    // ✅ ADD VALIDATION: Check if customer exists
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

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
      success: true,
      message: 'Payment confirmed successfully 🎊', 
      data: result 
    }, 200);
  } catch (error: any) {
    console.error('Error confirming payment:', error.message);
    return c.json({ error: error.message }, 500);
  }
}

// Get payment by booking ID (with booking details)
export const getPaymentByBookingId = async (c: Context) => {
  try {
    const customer = c.customer;
    const booking_id = parseInt(c.req.param('booking_id'));
    
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!booking_id) {
      return c.json({ error: 'Booking ID is required' }, 400);
    }

    const result = await paymentServices.getPaymentByBookingIdService(booking_id);
    if (!result) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    // Users can only see their own payments, admins can see all
    const booking = await paymentServices.getBookingByIdService(booking_id);
    if (customer.user_type !== 'admin' && booking.user_id !== customer.user_id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({ 
      success: true, 
      data: result 
    });
  } catch (error: any) {
    console.error('Error fetching payment:', error);
    return c.json({ error: 'Failed to fetch payment' }, 500);
  }
}

// Get detailed payment info with booking status (for workflow)
export const getBookingPaymentDetails = async (c: Context) => {
  try {
    const customer = c.customer;
    const booking_id = parseInt(c.req.param('booking_id'));
    
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (customer.user_type !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (!booking_id) {
      return c.json({ error: 'Booking ID is required' }, 400);
    }

    const result = await paymentServices.getBookingPaymentDetailsService(booking_id);
    if (!result) {
      return c.json({ error: 'Booking payment details not found' }, 404);
    }

    return c.json({ 
      success: true, 
      data: result 
    });
  } catch (error: any) {
    console.error('Error fetching booking payment details:', error);
    return c.json({ error: 'Failed to fetch booking payment details' }, 500);
  }
}

// Verify payment manually (admin only)
export const verifyPayment = async (c: Context) => {
  try {
    const customer = c.customer;
    const payment_id = parseInt(c.req.param('payment_id'));
    const body = await c.req.json();
    
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (customer.user_type !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (!payment_id) {
      return c.json({ error: 'Payment ID is required' }, 400);
    }

    if (typeof body.verified !== 'boolean') {
      return c.json({ error: 'Verification status is required' }, 400);
    }

    const result = await paymentServices.verifyPaymentService(
      payment_id,
      body.verified,
      body.admin_notes || '',
      customer.user_id
    );

    if (typeof result === "string") {
      return c.json({ error: result }, 400);
    }

    return c.json({ 
      success: true,
      message: body.verified ? 'Payment verified successfully' : 'Payment unverified',
      data: result 
    }, 200);
  } catch (error: any) {
    console.error('Error verifying payment:', error.message);
    return c.json({ error: error.message }, 500);
  }
}



// Get all payments (admin only)
export const getAllPayments = async (c: Context) => {
  try {
    const customer = c.customer; // ✅ CHANGED: c.customer instead of c.get('customer')
    
    // ✅ ADD VALIDATION: Check if customer exists
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (customer.user_type !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const result = await paymentServices.getAllPaymentsService();
    
    if (result.length === 0) {
      return c.json({ message: 'No payments found' }, 404);
    }
    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching all payments:', error.message);
    return c.json({ error: 'Failed to fetch payments' }, 500);
  }
}

export const getMyPayments = async (c: Context) => {
  try {
    const customer = c.customer;
    
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = getDbPool();
    const query = `
      SELECT 
        p.*,
        b.booking_status,
        b.pickup_date,
        b.return_date,
        b.total_amount as booking_total,
        vs.manufacturer,
        vs.model,
        vs.year
      FROM PaymentsTable p
      JOIN Bookings b ON p.booking_id = b.booking_id
      JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
      JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
      WHERE p.user_id = @user_id
      ORDER BY p.created_at DESC
    `;
    
    const result = await db.request()
      .input('user_id', customer.user_id)
      .query(query);

    return c.json({ 
      success: true,
      data: result.recordset 
    });
  } catch (error: any) {
    console.error('Error fetching user payments:', error);
    return c.json({ error: 'Failed to fetch payments' }, 500);
  }
}

export const getMySpendingStats = async (c: Context) => {
  try {
    const customer = c.customer;
    
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = getDbPool();
    
    // ✅ FIXED QUERY: Get total from COMPLETED bookings, not all payments
    const query = `
      SELECT 
        -- Total spent from COMPLETED bookings only
        SUM(CASE WHEN b.booking_status = 'Completed' THEN b.total_amount ELSE 0 END) as total_spent,
        
        -- Monthly spending from COMPLETED bookings
        SUM(CASE WHEN b.booking_status = 'Completed' AND FORMAT(b.return_date, 'yyyy-MM') = FORMAT(GETDATE(), 'yyyy-MM') THEN b.total_amount ELSE 0 END) as this_month_spent,
        
        -- Payment methods count
        COUNT(DISTINCT CASE WHEN p.payment_method = 'stripe' THEN p.payment_id END) as stripe_payments,
        COUNT(DISTINCT CASE WHEN p.payment_method = 'mpesa' THEN p.payment_id END) as mpesa_payments,
        
        -- Payment status breakdown (from PaymentsTable)
        COUNT(CASE WHEN p.payment_status = 'Completed' THEN 1 END) as completed_payments,
        COUNT(CASE WHEN p.payment_status = 'Pending' THEN 1 END) as pending_payments,
        COUNT(CASE WHEN p.payment_status = 'Failed' THEN 1 END) as failed_payments,
        
        -- Total bookings count (for reference)
        COUNT(DISTINCT b.booking_id) as total_bookings,
        COUNT(DISTINCT CASE WHEN b.booking_status = 'Completed' THEN b.booking_id END) as completed_bookings,
        COUNT(DISTINCT CASE WHEN b.booking_status = 'Pending' THEN b.booking_id END) as pending_bookings
        
      FROM Bookings b
      LEFT JOIN PaymentsTable p ON b.booking_id = p.booking_id
      WHERE b.user_id = @user_id
    `;
    
    const result = await db.request()
      .input('user_id', customer.user_id)
      .query(query);

    const stats = result.recordset[0] || {
      total_spent: 0,
      this_month_spent: 0,
      stripe_payments: 0,
      mpesa_payments: 0,
      completed_payments: 0,
      pending_payments: 0,
      failed_payments: 0,
      total_bookings: 0,
      completed_bookings: 0,
      pending_bookings: 0
    };

    return c.json({ 
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error fetching spending stats:', error);
    return c.json({ error: 'Failed to fetch spending stats' }, 500);
  }
}

//checkout booking
export const checkoutBooking = async (c: Context) => {
    let booking;
    try {
        booking = await c.req.json();
    } catch (error) {
        return c.text("Invalid request body", 400);
    }
    try {
        if (!booking.booking_id || !booking.total_amount) {
            return c.text("Missing Booking ID or total amount", 400);
        }

        
        const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `Booking ID: ${booking.booking_id}`,
                },
                unit_amount: booking.total_amount
            },
            quantity: 1,
        }];
        // In checkoutBooking function, update the success_url:
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    line_items,
    mode: 'payment',
    // Update this URL:
    success_url: `http://localhost:5173/my-bookings?payment_success=true&booking_id=${booking.booking_id}&amount=${booking.total_amount}`,
    cancel_url: `http://localhost:5173/my-bookings?payment_cancelled=true`,
};
        const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create(sessionParams);
        
        // Save payment details to the database        
        const createPayment = await paymentServices.createPaymentService( booking.booking_id, booking.user_id,
   booking.total_amount,session.id);

   if(createPayment ==="failed"){
    return c.json({ payment: createPayment }, 404);
   }

    console.log("🚀 ~ checkoutBooking ~ session:", session)
    return c.json({ session: session, payment: createPayment }, 200);

    } catch (error: any) {
        return c.text(error?.message, 400);
    }
};

// In payment.controller.ts - Update the handleStripeWebhook function
export const handleStripeWebhook = async (c: Context) => {
    const sig = c.req.header('stripe-signature');
    const rawBody = await c.req.text();
    
    if (!sig) {
        console.error('Webhook Error: No stripe-signature header value was provided.');
        return c.text('Webhook Error: No stripe-signature header value was provided.', 400);
    }
    
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            rawBody, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return c.text(`Webhook Error: ${err.message}`, 400);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object as Stripe.Checkout.Session;
            console.log('✅ Checkout session completed:', session.id);
            
            try {
                // Update payment status in database
                const db = getDbPool();
                
                // Find payment by session ID
                const findQuery = `
                    SELECT payment_id FROM PaymentsTable 
                    WHERE transaction_id = @session_id
                `;
                
                const result = await db.request()
                    .input('session_id', session.id)
                    .query(findQuery);

                if (result.recordset.length > 0) {
                    const payment_id = result.recordset[0].payment_id;
                    
                    // Update payment status to Completed
                    const updateQuery = `
                        UPDATE PaymentsTable 
                        SET payment_status = 'Completed',
                            payment_date = GETDATE(),
                            updated_at = GETDATE()
                        WHERE payment_id = @payment_id
                    `;
                    
                    await db.request()
                        .input('payment_id', payment_id)
                        .query(updateQuery);
                    
                    console.log(`✅ Payment ${payment_id} marked as Completed`);
                    
                    // Get booking ID for this payment
                    const bookingQuery = `
                        SELECT booking_id FROM PaymentsTable 
                        WHERE payment_id = @payment_id
                    `;
                    
                    const bookingResult = await db.request()
                        .input('payment_id', payment_id)
                        .query(bookingQuery);
                    
                    if (bookingResult.recordset.length > 0) {
                        const booking_id = bookingResult.recordset[0].booking_id;
                        
                        // Update booking status to Pending (waiting for admin approval)
                        const updateBookingQuery = `
                            UPDATE Bookings 
                            SET booking_status = 'pending',
                                updated_at = GETDATE()
                            WHERE booking_id = @booking_id
                        `;
                        
                        await db.request()
                            .input('booking_id', booking_id)
                            .query(updateBookingQuery);
                        
                        console.log(`✅ Booking ${booking_id} set to pending (waiting admin approval)`);
                    }
                    
                    // Here you could also:
                    // 1. Send email confirmation to user
                    // 2. Send notification to admin
                    // 3. Trigger any other post-payment actions
                    
                    return c.json({ 
                        success: true, 
                        message: 'Payment processed successfully',
                        payment_id: payment_id 
                    }, 200);
                } else {
                    console.error('Payment not found for session:', session.id);
                    return c.text('Payment not found', 404);
                }
            } catch (err: any) {
                console.error('Database Error:', err.message);
                return c.text(`Database Error: ${err.message}`, 500);
            }

        // Handle other event types
        case 'payment_intent.succeeded':
            console.log('PaymentIntent was successful!');
            break;
            
        case 'payment_intent.payment_failed':
            console.log('PaymentIntent failed!');
            break;
            
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }
    
    return c.json({ received: true }, 200);
};

// Process Stripe webhook
export const processPaymentWebhook = async (c: Context) => {
  try {
    const stripeSignature = c.req.header('stripe-signature');
    
    if (!stripeSignature) {
      return c.json({ error: 'Stripe signature required' }, 400);
    }

    const body = await c.req.text(); // Get raw body for webhook verification
    
    const result = await paymentServices.processPaymentWebhookService(
      JSON.parse(body),
      stripeSignature
    );

    if (typeof result === "string") {
      return c.json({ error: result }, 400);
    }

    return c.json({ 
      success: true,
      message: 'Webhook processed successfully', 
      data: result 
    }, 200);
  } catch (error: any) {
    console.error('Error processing webhook:', error.message);
    return c.json({ error: 'Failed to process webhook' }, 500);
  }
}

// Refund payment
export const refundPayment = async (c: Context) => {
  try {
    const customer = c.customer; // ✅ CHANGED: c.customer instead of c.get('customer')
    const { payment_id } = await c.req.json();

    // ✅ ADD VALIDATION: Check if customer exists
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!payment_id) {
      return c.json({ error: 'Payment ID is required' }, 400);
    }

    const result = await paymentServices.refundPaymentService(
      payment_id,
      customer.user_id,
      customer.user_type
    );

    if (typeof result === "string") {
      return c.json({ error: result }, 400);
    }

    return c.json({ 
      success: true,
      message: 'Payment refunded successfully', 
      data: result 
    }, 200);
  } catch (error: any) {
    console.error('Error refunding payment:', error.message);
    return c.json({ error: error.message }, 500);
  }
}
// Get payment statistics (admin only)
export const getPaymentStats = async (c: Context) => {
  try {
    const customer = c.customer;
    
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (customer.user_type !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // You'll need to implement this service function
    const stats = await paymentServices.getPaymentStatsService();
    
    return c.json({ 
      success: true, 
      stats 
    });
  } catch (error: any) {
    console.error('Error fetching payment stats:', error.message);
    return c.json({ error: 'Failed to fetch payment statistics' }, 500);
  }
}

// Update payment status (admin only)
export const updatePaymentStatus = async (c: Context) => {
  try {
    const customer = c.customer;
    const payment_id = parseInt(c.req.param('payment_id'));
    const body = await c.req.json();

    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (customer.user_type !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (!payment_id) {
      return c.json({ error: 'Payment ID is required' }, 400);
    }

    if (!body.payment_status) {
      return c.json({ error: 'Payment status is required' }, 400);
    }

    // Validate payment status
    const validStatuses = ['Pending', 'Completed', 'Failed', 'Refunded'];
    if (!validStatuses.includes(body.payment_status)) {
      return c.json({ 
        error: 'Invalid payment status', 
        valid_statuses: validStatuses 
      }, 400);
    }

    const result = await paymentServices.updatePaymentStatusService(
      payment_id,
      body.payment_status,
      body.admin_notes || ''
    );

    if (typeof result === "string") {
      return c.json({ error: result }, 400);
    }

    return c.json({ 
      success: true,
      message: 'Payment status updated successfully', 
      data: result 
    }, 200);
  } catch (error: any) {
    console.error('Error updating payment status:', error.message);
    return c.json({ error: error.message }, 500);
  }
}


// Export payments (admin only)
export const exportPayments = async (c: Context) => {
  try {
    const customer = c.customer;
    
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (customer.user_type !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Get filters from query params
    const filters = c.req.query();
    
    // You'll need to implement this service function
    const csvData = await paymentServices.exportPaymentsService(filters);
    
    // Return CSV file
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename=payments-${new Date().toISOString().split('T')[0]}.csv`);
    return c.text(csvData);
  } catch (error: any) {
    console.error('Error exporting payments:', error.message);
    return c.json({ error: 'Failed to export payments' }, 500);
  }
}

// ==================== M-PESA PAYMENT (PAYSTACK) ====================

/**
 * Initialize M-Pesa payment via Paystack (Hosted Checkout)
 */
export const initializeMpesaPayment = async (c: Context) => {
  try {
    const customer = c.customer;
    const body = await c.req.json();

    console.log('🔍 M-Pesa payment request:', { 
      customerId: customer?.user_id, 
      bookingId: body.booking_id,
      amount: body.amount,
      phoneNumber: body.phone_number
    });

    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Validate required fields
    if (!body.booking_id || !body.amount || !body.phone_number) {
      return c.json({ 
        error: 'Booking ID, amount, and phone number are required' 
      }, 400);
    }

    // Validate amount (minimum KES 10 for Paystack)
    if (body.amount < 10) {
      return c.json({ error: 'Amount must be at least KES 10' }, 400);
    }

    const db = getDbPool();

    // Check if booking exists and belongs to user
    const bookingQuery = `
      SELECT * FROM Bookings 
      WHERE booking_id = @booking_id AND user_id = @user_id
    `;
    
    const bookingResult = await db.request()
      .input('booking_id', body.booking_id)
      .input('user_id', customer.user_id)
      .query(bookingQuery);

    if (bookingResult.recordset.length === 0) {
      return c.json({ error: 'Booking not found or unauthorized' }, 404);
    }

    const booking = bookingResult.recordset[0];

    // Create payment record in database
    const createPaymentQuery = `
      INSERT INTO PaymentsTable (
        booking_id, 
        user_id, 
        amount, 
        payment_method, 
        payment_status
      )
      OUTPUT INSERTED.*
      VALUES (
        @booking_id, 
        @user_id, 
        @amount, 
        @payment_method, 
        @payment_status
      )
    `;
    
    const paymentResult = await db.request()
      .input('booking_id', body.booking_id)
      .input('user_id', customer.user_id)
      .input('amount', body.amount)
      .input('payment_method', 'mpesa')
      .input('payment_status', 'Pending')
      .query(createPaymentQuery);

    if (paymentResult.recordset.length === 0) {
      return c.json({ error: 'Failed to create payment record' }, 500);
    }

    const payment = paymentResult.recordset[0];
    console.log('💰 Created M-Pesa payment record:', {
      payment_id: payment.payment_id,
      amount: payment.amount,
      status: payment.payment_status
    });

    // Generate unique reference for Paystack
    const reference = `MPESA_${Date.now()}_${payment.payment_id}`;

    // Update payment with Paystack reference
    await db.request()
      .input('payment_id', payment.payment_id)
      .input('transaction_id', reference)
      .query(`
        UPDATE PaymentsTable 
        SET transaction_id = @transaction_id,
            updated_at = GETDATE()
        WHERE payment_id = @payment_id
      `);

    // Format phone number for M-Pesa (254...)
    let formattedPhone = body.phone_number.trim().replace(/\s+/g, '');
    
    // Convert to Kenyan format if needed
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('254')) {
      // Already in correct format
    } else {
      return c.json({ 
        error: 'Invalid phone number format. Use: 07XXXXXXXX or 2547XXXXXXXX' 
      }, 400);
    }

    // Validate phone number length and format
    if (formattedPhone.length !== 12) {
      return c.json({ 
        error: 'Invalid phone number. Must be 12 digits (2547XXXXXXXX)' 
      }, 400);
    }

    // Validate it's a Safaricom number (starts with 2547)
    if (!formattedPhone.startsWith('2547')) {
      return c.json({ 
        error: 'Invalid M-Pesa number. Must be a Safaricom number (2547XXXXXXXX)' 
      }, 400);
    }

    // Initialize Paystack mobile money charge
    const paystackPayload = {
      email: customer.email || `${customer.user_id}@carrental.com`,
      amount: Math.round(body.amount * 100), // Convert to kobo/pesa
      currency: "KES",
      mobile_money: {
        phone: formattedPhone,
        provider: "mpesa"
      },
      reference: reference,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-callback?reference=${reference}&booking_id=${body.booking_id}`,
      metadata: {
        booking_id: body.booking_id,
        payment_id: payment.payment_id,
        user_id: customer.user_id,
        user_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
        phone_number: formattedPhone
      }
    };

    console.log('📤 Paystack payload:', JSON.stringify(paystackPayload, null, 2));

    const paystackResponse = await axios.post(
      `${PAYSTACK_BASE_URL}/charge`,
      paystackPayload,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    console.log('📥 Paystack response:', paystackResponse.data);

    if (!paystackResponse.data.status) {
      // Update payment status to Failed
      await db.request()
        .input('payment_id', payment.payment_id)
        .input('payment_status', 'Failed')
        .input('failure_reason', paystackResponse.data.message || 'Paystack API error')
        .query(`
          UPDATE PaymentsTable 
          SET payment_status = @payment_status, 
              failure_reason = @failure_reason,
              updated_at = GETDATE()
          WHERE payment_id = @payment_id
        `);
      
      return c.json({ 
        error: 'Failed to initialize M-Pesa payment',
        details: paystackResponse.data.message 
      }, 400);
    }

    const paystackData = paystackResponse.data.data;

    // Check if payment requires OTP (for M-Pesa)
    if (paystackData.requires_otp) {
      return c.json({
        success: true,
        message: 'M-Pesa payment requires OTP verification',
        data: {
          payment_id: payment.payment_id,
          reference: reference,
          requires_otp: true,
          display_text: paystackData.display_text || 'Please check your phone for OTP',
          payment_status: 'Pending'
        }
      }, 200);
    }

    return c.json({
      success: true,
      message: 'M-Pesa payment initialized. Check your phone for STK Push.',
      data: {
        payment_id: payment.payment_id,
        reference: reference,
        amount: body.amount,
        payment_status: 'Pending',
        display_text: paystackData.display_text || 'Check your phone to complete payment'
      }
    }, 200);

  } catch (error: any) {
    console.error('❌ Error initializing M-Pesa payment:', error);
    
    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data;
      console.error('Paystack API error details:', errorData);
      
      return c.json({ 
        error: 'M-Pesa payment failed',
        details: errorData?.message || error.message,
        code: errorData?.status || 'PAYSTACK_ERROR'
      }, 500);
    }
    
    return c.json({ 
      error: 'Failed to initialize M-Pesa payment',
      details: error.message 
    }, 500);
  }
};

// Paystack webhook handler
export const handlePaystackWebhook = async (c: Context) => {
  try {
    const body = await c.req.json();
    
    // Verify webhook signature (optional but recommended)
    const signature = c.req.header('x-paystack-signature');
    
    if (!signature) {
      console.error('No Paystack signature provided');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('🔔 Paystack webhook received:', body.event);

    const db = getDbPool();

    switch (body.event) {
      case 'charge.success':
        const reference = body.data.reference;
        
        // Find payment by reference
        const findQuery = `
          SELECT payment_id, booking_id FROM PaymentsTable 
          WHERE transaction_id = @reference
        `;
        
        const result = await db.request()
          .input('reference', reference)
          .query(findQuery);

        if (result.recordset.length > 0) {
          const payment = result.recordset[0];
          
          // Update payment status
          await db.request()
            .input('payment_id', payment.payment_id)
            .input('payment_status', 'Completed')
            .input('payment_date', new Date().toISOString())
            .query(`
              UPDATE PaymentsTable 
              SET payment_status = @payment_status,
                  payment_date = @payment_date,
                  updated_at = GETDATE()
              WHERE payment_id = @payment_id
            `);

          // Update booking status to pending
          if (payment.booking_id) {
            await db.request()
              .input('booking_id', payment.booking_id)
              .query(`
                UPDATE Bookings 
                SET booking_status = 'pending',
                    updated_at = GETDATE()
                WHERE booking_id = @booking_id
              `);
          }

          console.log(`✅ Payment ${payment.payment_id} marked as completed`);
        }
        break;

      case 'charge.failed':
        // Handle failed payments
        const failedRef = body.data.reference;
        
        await db.request()
          .input('reference', failedRef)
          .input('payment_status', 'Failed')
          .input('failure_reason', body.data.message || 'Payment failed')
          .query(`
            UPDATE PaymentsTable 
            SET payment_status = @payment_status,
                failure_reason = @failure_reason,
                updated_at = GETDATE()
            WHERE transaction_id = @reference
          `);
        break;
    }

    return c.json({ received: true });
  } catch (error: any) {
    console.error('Paystack webhook error:', error);
    return c.json({ error: 'Failed to process webhook' }, 500);
  }
};