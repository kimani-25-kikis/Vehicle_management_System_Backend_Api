import { type Context } from "hono"
import * as bookingServices from "./booking.service.ts";

// Helper function to compare dates without time (timezone-safe)
const isDateInPast = (dateString: string): boolean => {
    const inputDate = new Date(dateString);
    const today = new Date();
    
    // Compare only year, month, and date (ignore time)
    const inputDateOnly = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return inputDateOnly < todayOnly;
};

// Helper function to check if return date is after pickup date
const isReturnAfterPickup = (pickupDateStr: string, returnDateStr: string): boolean => {
    const pickupDate = new Date(pickupDateStr);
    const returnDate = new Date(returnDateStr);
    return returnDate > pickupDate;
};

// Create new booking
export const createBooking = async (c: Context) => {
    try {
        const customer = c.customer; // From auth middleware
        const body = await c.req.json()

        // Validate required fields for new table structure
        const requiredFields = [
            'vehicle_id', 'pickup_location', 'return_location', 
            'pickup_date', 'return_date', 'total_amount',
            'driver_license_number', 'driver_license_expiry',
            'driver_license_front_url', 'driver_license_back_url',
            'insurance_type'
        ];

        for (const field of requiredFields) {
            if (!body[field]) {
                return c.json({ error: `Missing required field: ${field}` }, 400);
            }
        }

        // Validate dates with timezone-safe comparison
        if (isDateInPast(body.pickup_date)) {
            return c.json({ error: 'Pickup date cannot be in the past' }, 400);
        }

        if (!isReturnAfterPickup(body.pickup_date, body.return_date)) {
            return c.json({ error: 'Return date must be after pickup date' }, 400);
        }

        // Validate license expiry date
        if (isDateInPast(body.driver_license_expiry)) {
            return c.json({ error: 'Driver license must not be expired' }, 400);
        }

        const result = await bookingServices.createBookingService({
            user_id: customer.user_id,
            vehicle_id: body.vehicle_id,
            pickup_location: body.pickup_location,
            return_location: body.return_location,
            pickup_date: body.pickup_date,
            return_date: body.return_date,
            booking_date: new Date().toISOString(), // Current timestamp
            total_amount: body.total_amount,
            driver_license_number: body.driver_license_number,
            driver_license_expiry: body.driver_license_expiry,
            driver_license_front_url: body.driver_license_front_url,
            driver_license_back_url: body.driver_license_back_url,
            insurance_type: body.insurance_type,
            additional_protection: body.additional_protection || false,
            roadside_assistance: body.roadside_assistance !== undefined ? body.roadside_assistance : true,
            booking_status: 'Pending'
        });

        if (typeof result === "string") {
            return c.json({ error: result }, 400);
        }

        return c.json({ 
            message: 'Booking created successfully 🎊', 
            booking: result,
            booking_id: result.booking_id 
        }, 201);
    } catch (error: any) {
        console.error('Error creating booking:', error.message);
        return c.json({ error: error.message }, 500);
    }
}

// Get user's bookings
export const getUserBookings = async (c: Context) => {
    try {
        const customer = c.customer; // From auth middleware
        const result = await bookingServices.getUserBookingsService(customer.user_id);
        
        if (result.length === 0) {
            return c.json({ message: 'No bookings found' }, 404);
        }
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching user bookings:', error.message);
        return c.json({ error: 'Failed to fetch bookings' }, 500);
    }
}

// Get all bookings (admin only)
export const getAllBookings = async (c: Context) => {
    try {
        const customer = c.customer; // From auth middleware
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await bookingServices.getAllBookingsService();
        
        if (result.length === 0) {
            return c.json({ message: 'No bookings found' }, 404);
        }
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching all bookings:', error.message);
        return c.json({ error: 'Failed to fetch bookings' }, 500);
    }
}

// Get booking by ID
export const getBookingById = async (c: Context) => {
    const booking_id = parseInt(c.req.param('booking_id'))
    try {
        const customer = c.customer; // From auth middleware
        
        const result = await bookingServices.getBookingByIdService(booking_id);
        if (result === null) {
            return c.json({ error: 'Booking not found' }, 404);
        }

        // Users can only see their own bookings, admins can see all
        if (customer.user_type !== 'admin' && result.user_id !== customer.user_id) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        return c.json(result);
    } catch (error) {
        console.error('Error fetching booking:', error);
        return c.json({ error: 'Failed to fetch booking' }, 500);
    }
}

// Update booking status (admin only) - Updated for new status flow
export const updateBookingStatus = async (c: Context) => {
    try {
        const booking_id = parseInt(c.req.param('booking_id'))
        const customer = c.customer; // From auth middleware
        const body = await c.req.json()

        // Only admins can update booking status
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const validStatuses = ['Pending', 'Approved', 'Active', 'Completed', 'Cancelled', 'Rejected'];
        if (!body.booking_status || !validStatuses.includes(body.booking_status)) {
            return c.json({ error: 'Valid booking status is required' }, 400);
        }

        const result = await bookingServices.updateBookingStatusService(
            booking_id, 
            body.booking_status,
            body.admin_notes
        );
        
        if (result === null) {
            return c.json({ error: 'Booking not found or status update failed' }, 404);
        }

        return c.json({ 
            message: 'Booking status updated successfully', 
            updated_booking: result 
        }, 200);

    } catch (error) {
        console.error('Error updating booking status:', error);
        return c.json({ error: 'Failed to update booking status' }, 500);
    }
}

// Cancel booking
export const cancelBooking = async (c: Context) => {
    const booking_id = parseInt(c.req.param('booking_id'))
    try {
        const customer = c.customer; // From auth middleware
        
        const booking = await bookingServices.getBookingByIdService(booking_id);
        if (booking === null) {
            return c.json({ error: 'Booking not found' }, 404);
        }

        // Users can only cancel their own bookings, admins can cancel any
        if (customer.user_type !== 'admin' && booking.user_id !== customer.user_id) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await bookingServices.cancelBookingService(booking_id);
        
        if (result === "Booking cannot be cancelled or already cancelled") {
            return c.json({ error: result }, 400);
        }

        return c.json({ message: result, cancelled_booking: booking }, 200);
    } catch (error) {
        console.error('Error cancelling booking:', error);
        return c.json({ error: 'Failed to cancel booking' }, 500);
    }
}