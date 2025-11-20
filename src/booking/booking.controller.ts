import { type Context } from "hono"
import * as bookingServices from "./booking.service.ts";

// Create new booking
export const createBooking = async (c: Context) => {
    try {
        const customer = c.customer; // From auth middleware
        const body = await c.req.json()

        // Validate required fields
        if (!body.vehicle_id || !body.pickup_location || !body.return_location || 
            !body.booking_date || !body.return_date) {
            return c.json({ error: 'All fields are required' }, 400);
        }

        // Validate dates
        const bookingDate = new Date(body.booking_date);
        const returnDate = new Date(body.return_date);
        const today = new Date();
        
        if (bookingDate >= returnDate) {
            return c.json({ error: 'Return date must be after booking date' }, 400);
        }

        if (bookingDate < today) {
            return c.json({ error: 'Booking date cannot be in the past' }, 400);
        }

        const result = await bookingServices.createBookingService(
            customer.user_id,
            body.vehicle_id,
            body.pickup_location,
            body.return_location,
            body.booking_date,
            body.return_date
        );

        if (typeof result === "string") {
            return c.json({ error: result }, 400);
        }

        return c.json({ message: 'Booking created successfully 🎊', booking: result }, 201);
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

// Update booking status (admin only)
export const updateBookingStatus = async (c: Context) => {
    try {
        const booking_id = parseInt(c.req.param('booking_id'))
        const customer = c.customer; // From auth middleware
        const body = await c.req.json()

        // Only admins can update booking status
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const validStatuses = ['Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled'];
        if (!body.booking_status || !validStatuses.includes(body.booking_status)) {
            return c.json({ error: 'Valid booking status is required' }, 400);
        }

        const result = await bookingServices.updateBookingStatusService(booking_id, body.booking_status);
        
        if (result === null) {
            return c.json({ error: 'Booking not found or status update failed' }, 404);
        }

        return c.json({ message: 'Booking status updated successfully', updated_booking: result }, 200);

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