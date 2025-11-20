import { getDbPool } from "../db/db.config.ts"

interface BookingResponse {
    booking_id: number;
    user_id: number;
    vehicle_id: number;
    pickup_location: string;
    return_location: string;
    booking_date: string;
    return_date: string;
    total_amount: number;
    booking_status: string;
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

// Create new booking
export const createBookingService = async (
    user_id: number,
    vehicle_id: number,
    pickup_location: string,
    return_location: string,
    booking_date: string,
    return_date: string
): Promise<BookingResponse | string> => {
    const db = getDbPool();
    
    try {
        // Check if vehicle exists and is available
        const vehicleQuery = 'SELECT * FROM Vehicles WHERE vehicle_id = @vehicle_id AND availability = 1';
        const vehicleResult = await db.request()
            .input('vehicle_id', vehicle_id)
            .query(vehicleQuery);

        if (vehicleResult.recordset.length === 0) {
            return "Vehicle not found or not available";
        }

        const vehicle = vehicleResult.recordset[0];

        // Check if vehicle is available for the requested dates
        const availabilityQuery = `
            SELECT COUNT(*) as overlapping_bookings
            FROM Bookings 
            WHERE vehicle_id = @vehicle_id 
            AND booking_status IN ('Pending', 'Confirmed', 'Active')
            AND (
                (booking_date BETWEEN @booking_date AND @return_date) OR
                (return_date BETWEEN @booking_date AND @return_date) OR
                (booking_date <= @booking_date AND return_date >= @return_date)
            )
        `;
        
        const availabilityResult = await db.request()
            .input('vehicle_id', vehicle_id)
            .input('booking_date', booking_date)
            .input('return_date', return_date)
            .query(availabilityQuery);

        if (availabilityResult.recordset[0].overlapping_bookings > 0) {
            return "Vehicle is already booked for the selected dates";
        }

        // Calculate total amount
        const bookingDate = new Date(booking_date);
        const returnDate = new Date(return_date);
        const days = Math.ceil((returnDate.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));
        const total_amount = days * vehicle.rental_rate;

        // Create booking
        const bookingQuery = `
            INSERT INTO Bookings (user_id, vehicle_id, pickup_location, return_location, booking_date, return_date, total_amount)
            OUTPUT INSERTED.*
            VALUES (@user_id, @vehicle_id, @pickup_location, @return_location, @booking_date, @return_date, @total_amount)
        `;
        
        const bookingResult = await db.request()
            .input('user_id', user_id)
            .input('vehicle_id', vehicle_id)
            .input('pickup_location', pickup_location)
            .input('return_location', return_location)
            .input('booking_date', booking_date)
            .input('return_date', return_date)
            .input('total_amount', total_amount)
            .query(bookingQuery);

        return bookingResult.recordset[0];
    } catch (error: any) {
        console.error('Error in createBookingService:', error);
        return "Failed to create booking";
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

// Update booking status
export const updateBookingStatusService = async (
    booking_id: number,
    booking_status: string
): Promise<BookingResponse | null> => {
    const db = getDbPool();
    const query = `
        UPDATE Bookings 
        SET booking_status = @booking_status, updated_at = GETDATE() 
        OUTPUT INSERTED.* 
        WHERE booking_id = @booking_id
    `;
    const result = await db.request()
        .input('booking_id', booking_id)
        .input('booking_status', booking_status)
        .query(query);
    return result.recordset[0] || null;
}

// Cancel booking
export const cancelBookingService = async (booking_id: number): Promise<string> => {
    const db = getDbPool();
    
    // Check if booking can be cancelled (only Pending or Confirmed bookings can be cancelled)
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
    if (!['Pending', 'Confirmed'].includes(currentStatus)) {
        return "Booking cannot be cancelled or already cancelled";
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