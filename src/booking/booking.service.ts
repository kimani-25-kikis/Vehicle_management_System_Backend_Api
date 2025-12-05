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
    payment_status?: 'Pending' | 'Completed' | 'Failed' | 'Refunded';
    payment_method?: string;
    transaction_id?: string;
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

interface BookingFilters {
    status?: string;
    payment_status?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    user_id?: number;
    vehicle_id?: number;
}

interface BookingStats {
    total_bookings: number;
    active_rentals: number;
    pending_approvals: number;
    total_revenue: number;
    today_revenue: number;
    completed_bookings: number;
    cancelled_bookings: number;
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
            AND booking_status IN ('Pending', 'Confirmed', 'Active')
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
        SELECT DISTINCT
            b.booking_id,
            b.user_id,
            b.vehicle_id,
            b.pickup_location,
            b.return_location,
            b.pickup_date,
            b.return_date,
            b.booking_date,
            b.total_amount,
            b.driver_license_number,
            b.driver_license_expiry,
            b.driver_license_front_url,
            b.driver_license_back_url,
            b.insurance_type,
            b.additional_protection,
            b.roadside_assistance,
            b.booking_status,
            b.verified_by_admin,
            b.verified_at,
            b.admin_notes,
            b.created_at,
            b.updated_at,
            
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email,
            vs.manufacturer as vehicle_manufacturer,
            vs.model as vehicle_model,
            v.rental_rate,
            
            p_latest.payment_status,
            p_latest.payment_method,
            p_latest.transaction_id
            
        FROM Bookings b
        INNER JOIN Users u ON b.user_id = u.user_id
        INNER JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        INNER JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        LEFT JOIN (
            SELECT 
                p1.booking_id,
                p1.payment_status,
                p1.payment_method,
                p1.transaction_id,
                ROW_NUMBER() OVER (PARTITION BY p1.booking_id ORDER BY p1.created_at DESC) as rn
            FROM PaymentsTable p1
        ) p_latest ON b.booking_id = p_latest.booking_id AND p_latest.rn = 1
        
        WHERE b.user_id = @user_id
        ORDER BY b.created_at DESC
    `;
    
    console.log(`📋 Executing getUserBookingsService for user ${user_id}`);
    
    const result = await db.request()
        .input('user_id', user_id)
        .query(query);
    
    const bookings = result.recordset;
    
    // Debug: Check for duplicates
    const bookingIds = bookings.map(b => b.booking_id);
    const uniqueIds = [...new Set(bookingIds)];
    
    console.log(`📊 getUserBookingsService Results for user ${user_id}:`);
    console.log(`📊 Total records: ${bookings.length}`);
    console.log(`📊 Unique booking IDs: ${uniqueIds.length}`);
    
    if (bookings.length !== uniqueIds.length) {
        console.warn(`⚠️ Found duplicates for user ${user_id}!`);
    }
    
    return bookings;
}

// Get all bookings with filters (admin only)
export const getAllBookingsService = async (filters?: BookingFilters): Promise<BookingWithDetails[]> => {
    const db = getDbPool();
    
    // Start building the query with DISTINCT and explicit column selection
    let query = `
        SELECT DISTINCT
            -- Booking columns (explicitly list all to avoid ambiguity)
            b.booking_id,
            b.user_id,
            b.vehicle_id,
            b.pickup_location,
            b.return_location,
            b.pickup_date,
            b.return_date,
            b.booking_date,
            b.total_amount,
            b.driver_license_number,
            b.driver_license_expiry,
            b.driver_license_front_url,
            b.driver_license_back_url,
            b.insurance_type,
            b.additional_protection,
            b.roadside_assistance,
            b.booking_status,
            b.verified_by_admin,
            b.verified_at,
            b.admin_notes,
            b.created_at,
            b.updated_at,
            
            -- User information
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email,
            
            -- Vehicle information
            vs.manufacturer as vehicle_manufacturer,
            vs.model as vehicle_model,
            v.rental_rate,
            
            -- Latest payment information (using subquery to avoid duplicates)
            p_latest.payment_status,
            p_latest.payment_method,
            p_latest.transaction_id,
            p_latest.created_at as payment_created_at
            
        FROM Bookings b
        
        -- User info (1:1 relationship, but use LEFT JOIN for safety)
        INNER JOIN Users u ON b.user_id = u.user_id
        
        -- Vehicle info (1:1 relationship, but use LEFT JOIN for safety)
        INNER JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        
        -- Vehicle specifications (1:1 relationship, but use LEFT JOIN for safety)
        INNER JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        
        -- Get only the latest payment per booking to avoid duplicates
        LEFT JOIN (
            SELECT 
                p1.booking_id,
                p1.payment_status,
                p1.payment_method,
                p1.transaction_id,
                p1.created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY p1.booking_id 
                    ORDER BY p1.created_at DESC
                ) as payment_rank
            FROM PaymentsTable p1
        ) p_latest ON b.booking_id = p_latest.booking_id AND p_latest.payment_rank = 1
        
        WHERE 1=1
    `;
    
    const request = db.request();
    
    // Apply filters if provided
    if (filters) {
        if (filters.status) {
            query += ' AND b.booking_status = @status';
            request.input('status', filters.status);
        }
        
        if (filters.payment_status) {
            // Handle NULL payment_status for bookings without payments
            if (filters.payment_status === 'No Payment') {
                query += ' AND (p_latest.payment_status IS NULL OR p_latest.payment_status = \'\')';
            } else {
                query += ' AND p_latest.payment_status = @payment_status';
                request.input('payment_status', filters.payment_status);
            }
        }
        
        if (filters.date_from) {
            query += ' AND b.created_at >= @date_from';
            request.input('date_from', new Date(filters.date_from));
        }
        
        if (filters.date_to) {
            query += ' AND b.created_at <= @date_to';
            request.input('date_to', new Date(filters.date_to));
        }
        
        if (filters.search) {
            query += ` AND (
                -- Search user name
                CONCAT(u.first_name, ' ', u.last_name) LIKE @search OR
                -- Search email
                u.email LIKE @search OR
                -- Search vehicle make and model
                CONCAT(vs.manufacturer, ' ', vs.model) LIKE @search OR
                -- Search booking ID
                CAST(b.booking_id AS NVARCHAR(20)) LIKE @search OR
                -- Search license number
                b.driver_license_number LIKE @search OR
                -- Search location
                b.pickup_location LIKE @search OR
                b.return_location LIKE @search
            )`;
            request.input('search', `%${filters.search}%`);
        }
        
        if (filters.user_id) {
            query += ' AND b.user_id = @user_id';
            request.input('user_id', filters.user_id);
        }
        
        if (filters.vehicle_id) {
            query += ' AND b.vehicle_id = @vehicle_id';
            request.input('vehicle_id', filters.vehicle_id);
        }
    }

    query += ' ORDER BY b.created_at DESC';
    
    console.log('📋 Executing getAllBookingsService query with filters:', filters);
    
    try {
        const result = await request.query(query);
        const bookings = result.recordset;
        
        // Debug: Check for duplicates
        const bookingIds = bookings.map(b => b.booking_id);
        const uniqueIds = [...new Set(bookingIds)];
        
        console.log(`📊 getAllBookingsService Results:`);
        console.log(`📊 Total records returned: ${bookings.length}`);
        console.log(`📊 Unique booking IDs: ${uniqueIds.length}`);
        
        if (bookings.length !== uniqueIds.length) {
            const duplicateCount = bookings.length - uniqueIds.length;
            console.warn(`⚠️ DUPLICATES FOUND! ${duplicateCount} duplicate records`);
            
            // Find which IDs are duplicated
            const duplicates = bookingIds.filter((id, index) => bookingIds.indexOf(id) !== index);
            const uniqueDuplicates = [...new Set(duplicates)];
            
            console.warn(`⚠️ Duplicate booking IDs:`, uniqueDuplicates);
            
            // Log sample duplicate details for debugging
            if (uniqueDuplicates.length > 0) {
                const sampleId = uniqueDuplicates[0];
                const duplicateRecords = bookings.filter(b => b.booking_id === sampleId);
                console.warn(`⚠️ Sample duplicate for booking ID ${sampleId}:`);
                console.warn(`⚠️ Number of duplicate rows: ${duplicateRecords.length}`);
                
                // Compare first two duplicates to see what's different
                if (duplicateRecords.length >= 2) {
                    const record1 = duplicateRecords[0];
                    const record2 = duplicateRecords[1];
                    
                    console.warn('⚠️ First record:', {
                        payment_status: record1.payment_status,
                        transaction_id: record1.transaction_id,
                        payment_created_at: record1.payment_created_at
                    });
                    
                    console.warn('⚠️ Second record:', {
                        payment_status: record2.payment_status,
                        transaction_id: record2.transaction_id,
                        payment_created_at: record2.payment_created_at
                    });
                    
                    // Find differences between records
                    const differences = [];
                    for (const key in record1) {
                        if (record1[key] !== record2[key]) {
                            differences.push({
                                field: key,
                                value1: record1[key],
                                value2: record2[key]
                            });
                        }
                    }
                    
                    if (differences.length > 0) {
                        console.warn('⚠️ Differences between duplicate records:', differences);
                    }
                }
            }
        }
        
        // If there are still duplicates, remove them (safety net)
        if (bookings.length !== uniqueIds.length) {
            console.log('🛡️ Removing duplicates as safety measure...');
            const uniqueBookings: BookingWithDetails[] = [];
            const seenIds = new Set();
            
            for (const booking of bookings) {
                if (!seenIds.has(booking.booking_id)) {
                    seenIds.add(booking.booking_id);
                    uniqueBookings.push(booking);
                }
            }
            
            console.log(`🛡️ Reduced from ${bookings.length} to ${uniqueBookings.length} unique bookings`);
            return uniqueBookings;
        }
        
        console.log('✅ getAllBookingsService completed successfully');
        return bookings;
        
    } catch (error: any) {
        console.error('❌ Error in getAllBookingsService:', error.message);
        console.error('❌ SQL Query:', query);
        throw error;
    }
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
            v.rental_rate,
            p_latest.payment_status,
            p_latest.payment_method,
            p_latest.transaction_id
        FROM Bookings b
        JOIN Users u ON b.user_id = u.user_id
        JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        LEFT JOIN (
            SELECT 
                p1.*,
                ROW_NUMBER() OVER (PARTITION BY p1.booking_id ORDER BY p1.created_at DESC) as rn
            FROM PaymentsTable p1
        ) p_latest ON b.booking_id = p_latest.booking_id AND p_latest.rn = 1
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
            LEFT JOIN PaymentsTable p ON b.booking_id = p.booking_id AND p.payment_status = 'Completed'
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
            UPDATE PaymentsTable 
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

// GET BOOKING STATISTICS
export const getBookingStatsService = async (): Promise<BookingStats> => {
    const db = getDbPool();
    
    try {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        const statsQuery = `
            SELECT 
                -- Total bookings
                (SELECT COUNT(*) FROM Bookings) as total_bookings,
                
                -- Active rentals (Confirmed or Active status with current date within rental period)
                (SELECT COUNT(*) FROM Bookings 
                 WHERE booking_status IN ('Confirmed', 'Active')
                 AND @current_date BETWEEN pickup_date AND return_date) as active_rentals,
                
                -- Pending approvals (Pending status)
                (SELECT COUNT(*) FROM Bookings 
                 WHERE booking_status = 'Pending') as pending_approvals,
                
                -- Total revenue from completed bookings
                (SELECT ISNULL(SUM(b.total_amount), 0) 
                 FROM Bookings b
                 LEFT JOIN PaymentsTable p ON b.booking_id = p.booking_id
                 WHERE b.booking_status = 'Completed'
                 AND p.payment_status = 'Completed') as total_revenue,
                
                -- Today's revenue
                (SELECT ISNULL(SUM(b.total_amount), 0) 
                 FROM Bookings b
                 LEFT JOIN PaymentsTable p ON b.booking_id = p.booking_id
                 WHERE b.booking_status = 'Completed'
                 AND p.payment_status = 'Completed'
                 AND b.created_at BETWEEN @today_start AND @today_end) as today_revenue,
                
                -- Completed bookings
                (SELECT COUNT(*) FROM Bookings 
                 WHERE booking_status = 'Completed') as completed_bookings,
                
                -- Cancelled bookings
                (SELECT COUNT(*) FROM Bookings 
                 WHERE booking_status = 'Cancelled') as cancelled_bookings
        `;
        
        const result = await db.request()
            .input('current_date', today)
            .input('today_start', todayStart)
            .input('today_end', todayEnd)
            .query(statsQuery);

        return {
            total_bookings: result.recordset[0].total_bookings || 0,
            active_rentals: result.recordset[0].active_rentals || 0,
            pending_approvals: result.recordset[0].pending_approvals || 0,
            total_revenue: result.recordset[0].total_revenue || 0,
            today_revenue: result.recordset[0].today_revenue || 0,
            completed_bookings: result.recordset[0].completed_bookings || 0,
            cancelled_bookings: result.recordset[0].cancelled_bookings || 0
        };
        
    } catch (error: any) {
        console.error('Error in getBookingStatsService:', error);
        throw error;
    }
}



// EXPORT BOOKINGS
export const exportBookingsService = async (filters: BookingFilters & { format?: string }): Promise<string> => {
    const db = getDbPool();
    
    try {
        // Get filtered bookings
        const bookings = await getAllBookingsService(filters);
        
        if (bookings.length === 0) {
            return "No bookings found to export";
        }
        
        const format = filters.format || 'csv';
        
        // Convert to CSV format
        if (format === 'csv') {
            const headers = [
                'Booking ID',
                'User Name',
                'User Email',
                'Vehicle',
                'Pickup Location',
                'Return Location',
                'Pickup Date',
                'Return Date',
                'Total Amount',
                'Booking Status',
                'Payment Status',
                'Driver License Verified',
                'Created At'
            ].join(',');
            
            const rows = bookings.map(booking => [
                booking.booking_id,
                `"${booking.user_name || ''}"`,
                `"${booking.user_email || ''}"`,
                `"${booking.vehicle_manufacturer || ''} ${booking.vehicle_model || ''}"`,
                `"${booking.pickup_location || ''}"`,
                `"${booking.return_location || ''}"`,
                new Date(booking.pickup_date).toISOString(),
                new Date(booking.return_date).toISOString(),
                booking.total_amount || 0,
                booking.booking_status || '',
                booking.payment_status || 'N/A',
                booking.verified_by_admin ? 'Yes' : 'No',
                new Date(booking.created_at).toISOString()
            ].join(','));
            
            return [headers, ...rows].join('\n');
        }
        
        // For Excel format, return CSV as fallback
        return "Excel export not implemented yet, using CSV format:\n\n" + 
               await exportBookingsService({ ...filters, format: 'csv' });
        
    } catch (error: any) {
        console.error('Error in exportBookingsService:', error);
        throw error;
    }
}

export const downloadDriverLicenseService = async (
    booking_id: number,
    side: 'front' | 'back'
): Promise<{ url: string; filename: string } | string> => {
    const db = getDbPool();
    
    try {
        // Get booking with license URLs
        const query = `
            SELECT 
                driver_license_front_url,
                driver_license_back_url,
                driver_license_number,
                user_id,
                (SELECT first_name + ' ' + last_name FROM Users WHERE user_id = b.user_id) as user_name
            FROM Bookings b
            WHERE booking_id = @booking_id
        `;
        
        const result = await db.request()
            .input('booking_id', booking_id)
            .query(query);
        
        if (result.recordset.length === 0) {
            return "Booking not found";
        }
        
        const booking = result.recordset[0];
        const licenseUrl = side === 'front' 
            ? booking.driver_license_front_url 
            : booking.driver_license_back_url;
        
        if (!licenseUrl) {
            return `Driver license ${side} image not available`;
        }
        
        // Generate filename
        const sanitizedUserName = (booking.user_name || 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `driver-license-${side}-${sanitizedUserName}-${booking.driver_license_number || booking_id}.jpg`;
        
        return {
            url: licenseUrl,
            filename: filename
        };
        
    } catch (error: any) {
        console.error('Error in downloadDriverLicenseService:', error);
        return "Failed to get driver license: " + error.message;
    }
}

// ... (keep all your existing functions, but update verifyDriverLicenseService) ...

// UPDATED verifyDriverLicenseService to optionally download
export const verifyDriverLicenseService = async (
    booking_id: number,
    verified: boolean,
    admin_notes: string,
    downloadLicense?: boolean // Add optional parameter
): Promise<BookingWithDetails | null> => {
    const db = getDbPool();
    
    try {
        const query = `
            UPDATE Bookings 
            SET verified_by_admin = @verified,
                verified_at = ${verified ? 'GETDATE()' : 'NULL'},
                admin_notes = @admin_notes,
                updated_at = GETDATE()
            OUTPUT INSERTED.*
            WHERE booking_id = @booking_id
        `;
        
        const result = await db.request()
            .input('booking_id', booking_id)
            .input('verified', verified)
            .input('admin_notes', admin_notes)
            .query(query);
        
        if (!result.recordset[0]) {
            return null;
        }
        
        // If downloadLicense is true, get the license URLs
        let licenseInfo = null;
        if (downloadLicense) {
            licenseInfo = {
                front: await downloadDriverLicenseService(booking_id, 'front'),
                back: await downloadDriverLicenseService(booking_id, 'back')
            };
        }
        
        // Get full booking details
        const fullBooking = await getBookingByIdService(booking_id);
        
        // Add license info to response if available
        if (licenseInfo && fullBooking) {
            (fullBooking as any).license_download_info = licenseInfo;
        }
        
        return fullBooking;
        
    } catch (error: any) {
        console.error('Error in verifyDriverLicenseService:', error);
        return null;
    }
}
