import { getDbPool } from "../db/db.config.ts"
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-11-17.clover',
  typescript: true,
})

interface BookingResponse {
    booking_id: number;
    user_id: number;
    vehicle_id: number;
    pickup_location: string;
    return_location: string;
    pickup_date: string;
    return_date: string;
    booking_date: string;
    total_amount: number;
    driver_license_number: string;
    driver_license_expiry: string;
    driver_license_front_url: string;
    driver_license_back_url: string;
    insurance_type: string;
    additional_protection: boolean;
    roadside_assistance: boolean;
    booking_status: string;
    verified_by_admin: boolean;
    verified_at: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
}

interface BookingWithDetails extends BookingResponse {
    user_name: string;
    user_email: string;
    vehicle_manufacturer: string;
    vehicle_model: string;
    rental_rate: number;
}

interface CreateBookingData {
    user_id: number;
    vehicle_id: number;
    pickup_location: string;
    return_location: string;
    pickup_date: string;
    return_date: string;
    booking_date: string;
    total_amount: number;
    driver_license_number: string;
    driver_license_expiry: string;
    driver_license_front_url: string;
    driver_license_back_url: string;
    insurance_type: string;
    additional_protection: boolean;
    roadside_assistance: boolean;
    booking_status: string;
}

// Create new booking
export const createBookingService = async (
    bookingData: CreateBookingData
): Promise<BookingResponse | string> => {
    const db = getDbPool();
    
    try {
        // Check if vehicle exists and is available
        const vehicleQuery = 'SELECT * FROM Vehicles WHERE vehicle_id = @vehicle_id AND availability = 1';
        const vehicleResult = await db.request()
            .input('vehicle_id', bookingData.vehicle_id)
            .query(vehicleQuery);

        if (vehicleResult.recordset.length === 0) {
            return "Vehicle not found or not available";
        }

        const vehicle = vehicleResult.recordset[0];

        // Check if vehicle is available for the requested dates (updated status check)
        const availabilityQuery = `
            SELECT COUNT(*) as overlapping_bookings
            FROM Bookings 
            WHERE vehicle_id = @vehicle_id 
            AND booking_status IN ('Pending Payment', 'Confirmed', 'Active')
            AND (
                (pickup_date BETWEEN @pickup_date AND @return_date) OR
                (return_date BETWEEN @pickup_date AND @return_date) OR
                (pickup_date <= @pickup_date AND return_date >= @return_date)
            )
        `;
        
        const availabilityResult = await db.request()
            .input('vehicle_id', bookingData.vehicle_id)
            .input('pickup_date', new Date(bookingData.pickup_date))
            .input('return_date', new Date(bookingData.return_date))
            .query(availabilityQuery);

        if (availabilityResult.recordset[0].overlapping_bookings > 0) {
            return "Vehicle is already booked for the selected dates";
        }

        // Create booking with all fields
        const bookingQuery = `
            INSERT INTO Bookings (
                user_id, vehicle_id, pickup_location, return_location, 
                pickup_date, return_date, booking_date, total_amount,
                driver_license_number, driver_license_expiry,
                driver_license_front_url, driver_license_back_url,
                insurance_type, additional_protection, roadside_assistance, booking_status
            )
            OUTPUT INSERTED.*
            VALUES (
                @user_id, @vehicle_id, @pickup_location, @return_location, 
                @pickup_date, @return_date, @booking_date, @total_amount,
                @driver_license_number, @driver_license_expiry,
                @driver_license_front_url, @driver_license_back_url,
                @insurance_type, @additional_protection, @roadside_assistance, @booking_status
            )
        `;
        
        console.log('📋 Executing booking query with data:', bookingData);
        
        const bookingResult = await db.request()
            .input('user_id', bookingData.user_id)
            .input('vehicle_id', bookingData.vehicle_id)
            .input('pickup_location', bookingData.pickup_location)
            .input('return_location', bookingData.return_location)
            .input('pickup_date', new Date(bookingData.pickup_date))
            .input('return_date', new Date(bookingData.return_date))
            .input('booking_date', new Date(bookingData.booking_date))
            .input('total_amount', bookingData.total_amount)
            .input('driver_license_number', bookingData.driver_license_number)
            .input('driver_license_expiry', new Date(bookingData.driver_license_expiry))
            .input('driver_license_front_url', bookingData.driver_license_front_url)
            .input('driver_license_back_url', bookingData.driver_license_back_url)
            .input('insurance_type', bookingData.insurance_type)
            .input('additional_protection', bookingData.additional_protection)
            .input('roadside_assistance', bookingData.roadside_assistance)
            .input('booking_status', bookingData.booking_status)
            .query(bookingQuery);

        console.log('✅ Booking created successfully:', bookingResult.recordset[0]);
        return bookingResult.recordset[0];
    } catch (error: any) {
        console.error('❌ Database error in createBookingService:', error);
        return `Database error: ${error.message}`;
    }
}

// Get user's bookings
export const getUserBookingsService = async (user_id: number): Promise<BookingWithDetails[]> => {
    const db = getDbPool();
    const query = `
        SELECT 
            b.*,
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email,
            vs.manufacturer as vehicle_manufacturer,
            vs.model as vehicle_model,
            v.rental_rate
        FROM Bookings b
        JOIN Users u ON b.user_id = u.user_id
        JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE b.user_id = @user_id
        ORDER BY b.created_at DESC
    `;
    const result = await db.request()
        .input('user_id', user_id)
        .query(query);
    return result.recordset;
}

// Get all bookings (admin only)
export const getAllBookingsService = async (): Promise<BookingWithDetails[]> => {
    const db = getDbPool();
    const query = `
        SELECT 
            b.*,
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email,
            vs.manufacturer as vehicle_manufacturer,
            vs.model as vehicle_model,
            v.rental_rate
        FROM Bookings b
        JOIN Users u ON b.user_id = u.user_id
        JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        ORDER BY b.created_at DESC
    `;
    const result = await db.request().query(query);
    return result.recordset;
}

// Get booking by ID
export const getBookingByIdService = async (booking_id: number): Promise<BookingWithDetails | null> => {
    const db = getDbPool();
    const query = `
        SELECT 
            b.*,
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email,
            vs.manufacturer as vehicle_manufacturer,
            vs.model as vehicle_model,
            v.rental_rate
        FROM Bookings b
        JOIN Users u ON b.user_id = u.user_id
        JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE b.booking_id = @booking_id
    `;
    const result = await db.request()
        .input('booking_id', booking_id)
        .query(query);
    return result.recordset[0] || null;
}

// Update booking status with admin verification
export const updateBookingStatusService = async (
    booking_id: number,
    booking_status: string,
    admin_notes: string 
): Promise<BookingResponse | null> => {
    const db = getDbPool();
    
    let query = `
        UPDATE Bookings 
        SET booking_status = @booking_status, 
            updated_at = GETDATE()
    `;
    
    // If status is Active, set verified_by_admin and verified_at
    if (booking_status === 'Active') {
        query += `, verified_by_admin = 1, verified_at = GETDATE()`;
    }
    
    // If status is Rejected, set admin notes
    if (booking_status === 'Rejected' && admin_notes) {
        query += `, admin_notes = @admin_notes`;
    }
    
    query += ` OUTPUT INSERTED.* WHERE booking_id = @booking_id`;
    
    const request = db.request()
        .input('booking_id', booking_id)
        .input('booking_status', booking_status);
    
    if (admin_notes) {
        request.input('admin_notes', admin_notes);
    }
    
    const result = await request.query(query);
    return result.recordset[0] || null;
}

// Cancel booking
export const cancelBookingService = async (booking_id: number): Promise<string> => {
    const db = getDbPool();
    
    // Check if booking can be cancelled (only Pending or Pending Payment bookings can be cancelled without refund)
    const checkQuery = `
        SELECT booking_status 
        FROM Bookings 
        WHERE booking_id = @booking_id
    `;
    
    const checkResult = await db.request()
        .input('booking_id', booking_id)
        .query(checkQuery);

    if (checkResult.recordset.length === 0) {
        return "Booking not found";
    }

    const currentStatus = checkResult.recordset[0].booking_status;
    const cancellableStatuses = ['Pending', 'Pending Payment'];
    
    if (!cancellableStatuses.includes(currentStatus)) {
        return "Booking cannot be cancelled or requires refund processing";
    }

    const cancelQuery = `
        UPDATE Bookings 
        SET booking_status = 'Cancelled', updated_at = GETDATE() 
        WHERE booking_id = @booking_id
    `;
    
    const result = await db.request()
        .input('booking_id', booking_id)
        .query(cancelQuery);
    
    return result.rowsAffected[0] === 1 ? "Booking cancelled successfully 🎊" : "Failed to cancel booking";
}

// NEW: Confirm booking payment
export const confirmBookingPaymentService = async (
    booking_id: number,
    payment_intent_id: string,
    user_id: number
): Promise<BookingResponse | string> => {
    const db = getDbPool();
    
    try {
        // Verify the booking exists and belongs to the user
        const bookingQuery = `
            SELECT b.* 
            FROM Bookings b
            WHERE b.booking_id = @booking_id AND b.user_id = @user_id
        `;
        const bookingResult = await db.request()
            .input('booking_id', booking_id)
            .input('user_id', user_id)
            .query(bookingQuery);

        if (bookingResult.recordset.length === 0) {
            return "Booking not found or unauthorized";
        }

        const booking = bookingResult.recordset[0];

        // Check if booking is in a state that can be confirmed
        if (!['Pending', 'Pending Payment'].includes(booking.booking_status)) {
            return "Booking cannot be confirmed in its current status";
        }

        // Verify payment with Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

        if (paymentIntent.status !== 'succeeded') {
            return `Payment not successful. Status: ${paymentIntent.status}`;
        }

        // Update booking status to Confirmed
        const updateBookingQuery = `
            UPDATE Bookings 
            SET booking_status = 'Confirmed', 
                updated_at = GETDATE()
            OUTPUT INSERTED.*
            WHERE booking_id = @booking_id
        `;
        
        const updateResult = await db.request()
            .input('booking_id', booking_id)
            .query(updateBookingQuery);

        console.log('✅ Booking payment confirmed:', updateResult.recordset[0]);
        return updateResult.recordset[0];
    } catch (error: any) {
        console.error('Error in confirmBookingPaymentService:', error);
        return "Failed to confirm booking payment: " + error.message;
    }
}

// NEW: Extend booking
export const extendBookingService = async (
    booking_id: number,
    new_return_date: string,
    additional_amount: number,
    user_id: number
): Promise<BookingResponse | string> => {
    const db = getDbPool();
    
    try {
        // Verify the booking exists and belongs to the user
        const bookingQuery = `
            SELECT * FROM Bookings 
            WHERE booking_id = @booking_id AND user_id = @user_id
        `;
        const bookingResult = await db.request()
            .input('booking_id', booking_id)
            .input('user_id', user_id)
            .query(bookingQuery);

        if (bookingResult.recordset.length === 0) {
            return "Booking not found or unauthorized";
        }

        const booking = bookingResult.recordset[0];

        // Check if booking can be extended
        if (!['Confirmed', 'Active'].includes(booking.booking_status)) {
            return "Booking cannot be extended in its current status";
        }

        // Check if new return date is valid
        const currentReturnDate = new Date(booking.return_date);
        const newReturnDate = new Date(new_return_date);
        
        if (newReturnDate <= currentReturnDate) {
            return "New return date must be after current return date";
        }

        // Update booking with new return date and additional amount
        const updateBookingQuery = `
            UPDATE Bookings 
            SET return_date = @new_return_date,
                total_amount = total_amount + @additional_amount,
                updated_at = GETDATE()
            OUTPUT INSERTED.*
            WHERE booking_id = @booking_id
        `;
        
        const updateResult = await db.request()
            .input('booking_id', booking_id)
            .input('new_return_date', new_return_date)
            .input('additional_amount', additional_amount)
            .query(updateBookingQuery);

        console.log('✅ Booking extended:', updateResult.recordset[0]);
        return updateResult.recordset[0];
    } catch (error: any) {
        console.error('Error in extendBookingService:', error);
        return "Failed to extend booking: " + error.message;
    }
}

// NEW: Refund booking payment (admin only)
export const refundBookingPaymentService = async (
    booking_id: number,
    refund_reason: string
): Promise<any | string> => {
    const db = getDbPool();
    
    try {
        // Get booking and payment details
        const bookingQuery = `
            SELECT b.*, p.transaction_id, p.payment_id
            FROM Bookings b
            LEFT JOIN Payments p ON b.booking_id = p.booking_id AND p.payment_status = 'Completed'
            WHERE b.booking_id = @booking_id
        `;
        const bookingResult = await db.request()
            .input('booking_id', booking_id)
            .query(bookingQuery);

        if (bookingResult.recordset.length === 0) {
            return "Booking not found";
        }

        const booking = bookingResult.recordset[0];

        // Check if booking can be refunded
        if (!['Confirmed', 'Active'].includes(booking.booking_status)) {
            return "Booking cannot be refunded in its current status";
        }

        if (!booking.transaction_id) {
            return "No completed payment found for this booking";
        }

        // Process refund with Stripe
        const refund = await stripe.refunds.create({
            payment_intent: booking.transaction_id,
        });

        // Update payment status to Refunded
        const updatePaymentQuery = `
            UPDATE Payments 
            SET payment_status = 'Refunded', 
                updated_at = GETDATE()
            WHERE payment_id = @payment_id
        `;
        
        await db.request()
            .input('payment_id', booking.payment_id)
            .query(updatePaymentQuery);

        // Update booking status to Cancelled
        const updateBookingQuery = `
            UPDATE Bookings 
            SET booking_status = 'Cancelled', 
                admin_notes = @refund_reason,
                updated_at = GETDATE()
            OUTPUT INSERTED.*
            WHERE booking_id = @booking_id
        `;
        
        const updateResult = await db.request()
            .input('booking_id', booking_id)
            .input('refund_reason', refund_reason)
            .query(updateBookingQuery);

        console.log('✅ Booking refund processed:', updateResult.recordset[0]);
        return {
            booking: updateResult.recordset[0],
            refund_id: refund.id,
            refund_amount: refund.amount
        };
    } catch (error: any) {
        console.error('Error in refundBookingPaymentService:', error);
        return "Failed to process refund: " + error.message;
    }
}