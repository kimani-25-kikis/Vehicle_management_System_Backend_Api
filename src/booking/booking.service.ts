import { getDbPool } from "../db/db.config.ts"

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

        // Check if vehicle is available for the requested dates
        const availabilityQuery = `
            SELECT COUNT(*) as overlapping_bookings
            FROM Bookings 
            WHERE vehicle_id = @vehicle_id 
            AND booking_status IN ('Pending', 'Approved', 'Active')
            AND (
                (pickup_date BETWEEN @pickup_date AND @return_date) OR
                (return_date BETWEEN @pickup_date AND @return_date) OR
                (pickup_date <= @pickup_date AND return_date >= @return_date)
            )
        `;
        
        const availabilityResult = await db.request()
            .input('vehicle_id', bookingData.vehicle_id)
            .input('pickup_date', new Date(bookingData.pickup_date)) // Convert to Date object
            .input('return_date', new Date(bookingData.return_date)) // Convert to Date object
            .query(availabilityQuery);

        if (availabilityResult.recordset[0].overlapping_bookings > 0) {
            return "Vehicle is already booked for the selected dates";
        }

        // Create booking with all new fields - CONVERT DATES PROPERLY
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
            .input('pickup_date', new Date(bookingData.pickup_date)) // Convert to Date object
            .input('return_date', new Date(bookingData.return_date)) // Convert to Date object
            .input('booking_date', new Date(bookingData.booking_date)) // Convert to Date object
            .input('total_amount', bookingData.total_amount)
            .input('driver_license_number', bookingData.driver_license_number)
            .input('driver_license_expiry', new Date(bookingData.driver_license_expiry)) // Convert to Date object
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
        console.error('❌ Error details:', {
            message: error.message,
            number: error.number,
            state: error.state,
            procedure: error.procedure,
            lineNumber: error.lineNumber
        });
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
    
    // If status is Approved, set verified_by_admin and verified_at
    if (booking_status === 'Approved') {
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
    
    // Check if booking can be cancelled (only Pending or Approved bookings can be cancelled)
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
    if (!['Pending', 'Approved'].includes(currentStatus)) {
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