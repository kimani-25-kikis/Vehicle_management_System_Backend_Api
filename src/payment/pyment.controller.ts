import { type Context } from "hono"
import * as paymentServices from "./payment.service.ts";
import Stripe from "stripe";
import dotenv from "dotenv"


dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});
// Create Stripe payment intent
// export const createPaymentIntent = async (c: Context) => {
//   try {
//     console.log('🔍 createPaymentIntent called')
//     const customer = c.customer; // ✅ CHANGED: c.customer instead of c.get('customer')
//     const body = await c.req.json()

//     console.log('🔍 Request body:', body)
//     console.log('🔍 Customer:', customer)

//     // ✅ ADD VALIDATION: Check if customer exists
//     if (!customer) {
//       console.log('❌ Customer is undefined in payment controller')
//       return c.json({ error: 'Authentication required' }, 401);
//     }

//     // Validate required fields
//     if (!body.booking_id || !body.amount) {
//       return c.json({ error: 'Booking ID and amount are required' }, 400);
//     }

//     // Validate amount (minimum $0.50)
//     if (body.amount < 50) {
//       return c.json({ error: 'Amount must be at least $0.50' }, 400);
//     }

//     const result = await paymentServices.createPaymentIntentService(
//       body.booking_id,
//       body.amount, // Amount in cents
//       customer.user_id,
//       body.currency || 'usd'
//     );

//     console.log('🔍 Payment service result:', result)

//     if (typeof result === "string") {
//       return c.json({ error: result }, 400);
//     }

//     return c.json({ 
//       success: true,
//       message: 'Payment intent created successfully', 
//       data: result 
//     }, 201);
//   } catch (error: any) {
//     console.error('Error creating payment intent:', error.message);
//     console.error('❌ Error in createPaymentIntent:', error)
//     console.error('❌ Error stack:', error.stack)
//     return c.json({ error: error.message }, 500);
//   }
// }

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

// Get payment by booking ID
export const getPaymentByBookingId = async (c: Context) => {
  const booking_id = parseInt(c.req.param('booking_id'))
  try {
    const customer = c.customer; // ✅ CHANGED: c.customer instead of c.get('customer')
    
    // ✅ ADD VALIDATION: Check if customer exists
    if (!customer) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const result = await paymentServices.getPaymentByBookingIdService(booking_id);
    if (result === null) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    // Users can only see their own payments, admins can see all
    const booking = await paymentServices.getBookingByIdService(booking_id);
    if (customer.user_type !== 'admin' && booking.user_id !== customer.user_id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching payment:', error);
    return c.json({ error: 'Failed to fetch payment' }, 500);
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
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            success_url: `http://localhost:5173/`,
            // success_url: `${FRONTEND_URL}/success`,
            // cancel_url: `${FRONTEND_URL}/failed`,
            cancel_url: `http://localhost:5173/`,
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

export const handleStripeWebhook = async (c: Context) => {
    const sig = c.req.header('stripe-signature');
    const rawBody = await c.req.text();
    if (!sig) {
        console.error('Webhook Error: No stripe-signature header value was provided.');
        return c.text('Webhook Error: No stripe-signature header value was provided.', 400);
    }
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET as string);
    } catch (err: any) {
        return c.text(`Webhook Error: ${err.message}`, 400);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            // const session = event.data.object as Stripe.Checkout.Session;
            // // Update payment status in the database
            // try {
            //     const session_id = session.id;
            //     const updateStatus = await updatePaymentBySessionIdService(session_id);
            //     return c.json({ payment: updateStatus }, 200);
            // } catch (err: any) {
            //     return c.text(`Database Error: ${err.message}`, 500);
            // }

        // Handle other event types as needed
        default:
            return c.text(`Unhandled event type ${event.type}`, 400);
    }
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

    if (!body.payment_status) {
      return c.json({ error: 'Payment status is required' }, 400);
    }

    // You'll need to implement this service function
    const result = await paymentServices.updatePaymentStatusService(
      payment_id,
      body.payment_status
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