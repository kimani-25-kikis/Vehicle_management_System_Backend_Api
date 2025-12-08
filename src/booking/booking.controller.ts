import { type Context } from "hono"
import * as bookingServices from "./booking.service.ts"
import path from 'path'
import fs from 'fs/promises'

// Helper function to compare dates without time (timezone-safe)
const isDateInPast = (dateString: string): boolean => {
    const inputDate = new Date(dateString);
    const today = new Date();
    
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
        const customer = c.customer;
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
            booking_date: new Date().toISOString(),
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
            success: true,
            message: 'Booking created successfully 🎊', 
            data: result,
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
        const customer = c.customer;
        const result = await bookingServices.getUserBookingsService(customer.user_id);
        
        if (result.length === 0) {
            return c.json({ succes:true,booking:[] }, 404);
        }
        return c.json({ success: true, booking: result });
    } catch (error: any) {
        console.error('Error fetching user bookings:', error.message);
        return c.json({ error: 'Failed to fetch bookings' }, 500);
    }
}

// Get all bookings with filters (admin only)
export const getAllBookings = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        // Get query parameters for filtering
        const filters = {
            status: c.req.query('status'),
            payment_status: c.req.query('payment_status'),
            date_from: c.req.query('date_from'),
            date_to: c.req.query('date_to'),
            search: c.req.query('search'),
            user_id: c.req.query('user_id') ? parseInt(c.req.query('user_id')!) : undefined,
            vehicle_id: c.req.query('vehicle_id') ? parseInt(c.req.query('vehicle_id')!) : undefined
        };

        const result = await bookingServices.getAllBookingsService(filters);
        
        if (result.length === 0) {
            return c.json({ message: 'No bookings found' }, 404);
        }
        return c.json({ success: true, data: result });
    } catch (error: any) {
        console.error('Error fetching all bookings:', error.message);
        return c.json({ error: 'Failed to fetch bookings' }, 500);
    }
}

// Get booking by ID
export const getBookingById = async (c: Context) => {
    const booking_id = parseInt(c.req.param('booking_id'))
    try {
        const customer = c.customer;
        
        const result = await bookingServices.getBookingByIdService(booking_id);
        if (result === null) {
            return c.json({ error: 'Booking not found' }, 404);
        }

        // Users can only see their own bookings, admins can see all
        if (customer.user_type !== 'admin' && result.user_id !== customer.user_id) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        return c.json({ success: true, booking: result });
    } catch (error) {
        console.error('Error fetching booking:', error);
        return c.json({ error: 'Failed to fetch booking' }, 500);
    }
}

// Update booking status (admin only)
export const updateBookingStatus = async (c: Context) => {
    try {
        const booking_id = parseInt(c.req.param('booking_id'))
        const customer = c.customer;
        const body = await c.req.json()

        // Only admins can update booking status
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const validStatuses = ['Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled', 'Rejected'];
        if (!body.booking_status || !validStatuses.includes(body.booking_status)) {
            return c.json({ error: 'Valid booking status is required' }, 400);
        }

        const result = await bookingServices.updateBookingStatusService(
            booking_id, 
            body.booking_status,
            body.admin_notes || ''
        );
        
        if (result === null) {
            return c.json({ error: 'Booking not found or status update failed' }, 404);
        }

        return c.json({ 
            success: true,
            message: 'Booking status updated successfully', 
            data: result 
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
        const customer = c.customer;
        
        const booking = await bookingServices.getBookingByIdService(booking_id);
        if (booking === null) {
            return c.json({ error: 'Booking not found' }, 404);
        }

        // Users can only cancel their own bookings, admins can cancel any
        if (customer.user_type !== 'admin' && booking.user_id !== customer.user_id) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await bookingServices.cancelBookingService(booking_id);
        
        if (result === "Booking cannot be cancelled or requires refund processing") {
            return c.json({ error: result }, 400);
        }

        return c.json({ 
            success: true,
            message: result, 
            data: booking 
        }, 200);
    } catch (error) {
        console.error('Error cancelling booking:', error);
        return c.json({ error: 'Failed to cancel booking' }, 500);
    }
}

// Confirm booking payment
export const confirmBookingPayment = async (c: Context) => {
    try {
        const customer = c.customer;
        const booking_id = parseInt(c.req.param('booking_id'));
        const { payment_intent_id } = await c.req.json();

        if (!payment_intent_id) {
            return c.json({ error: 'Payment intent ID is required' }, 400);
        }

        const result = await bookingServices.confirmBookingPaymentService(
            booking_id,
            payment_intent_id,
            customer.user_id
        );

        if (typeof result === "string") {
            return c.json({ error: result }, 400);
        }

        return c.json({
            success: true,
            message: 'Booking payment confirmed successfully 🎊',
            data: result
        }, 200);
    } catch (error: any) {
        console.error('Error confirming booking payment:', error.message);
        return c.json({ error: error.message }, 500);
    }
}

// Extend booking
export const extendBooking = async (c: Context) => {
    try {
        const customer = c.customer;
        const booking_id = parseInt(c.req.param('booking_id'));
        const { new_return_date, additional_amount } = await c.req.json();

        if (!new_return_date) {
            return c.json({ error: 'New return date is required' }, 400);
        }

        // Validate new return date
        const booking = await bookingServices.getBookingByIdService(booking_id);
        if (booking && isDateInPast(new_return_date)) {
            return c.json({ error: 'New return date cannot be in the past' }, 400);
        }

        const result = await bookingServices.extendBookingService(
            booking_id,
            new_return_date,
            additional_amount || 0,
            customer.user_id
        );

        if (typeof result === "string") {
            return c.json({ error: result }, 400);
        }

        return c.json({
            success: true,
            message: 'Booking extended successfully',
            data: result
        }, 200);
    } catch (error: any) {
        console.error('Error extending booking:', error.message);
        return c.json({ error: error.message }, 500);
    }
}

// Refund booking payment (admin only)
export const refundBookingPayment = async (c: Context) => {
    try {
        const customer = c.customer;
        const booking_id = parseInt(c.req.param('booking_id'));
        const { refund_reason } = await c.req.json();

        // Only admins can process refunds
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        if (!refund_reason) {
            return c.json({ error: 'Refund reason is required' }, 400);
        }

        const result = await bookingServices.refundBookingPaymentService(
            booking_id,
            refund_reason
        );

        if (typeof result === "string") {
            return c.json({ error: result }, 400);
        }

        return c.json({
            success: true,
            message: 'Booking payment refunded successfully',
            data: result
        }, 200);
    } catch (error: any) {
        console.error('Error refunding booking payment:', error.message);
        return c.json({ error: error.message }, 500);
    }
}

// GET BOOKING STATISTICS (Admin only)
export const getBookingStats = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const stats = await bookingServices.getBookingStatsService();
        
        return c.json({ 
            success: true, 
            stats 
        }, 200);
    } catch (error: any) {
        console.error('Error fetching booking stats:', error.message);
        return c.json({ error: 'Failed to fetch booking statistics' }, 500);
    }
}

// // VERIFY DRIVER LICENSE (Admin only)
// export const verifyDriverLicense = async (c: Context) => {
//     try {
//         const booking_id = parseInt(c.req.param('booking_id'))
//         const customer = c.customer;
//         const body = await c.req.json()

//         // Only admins can verify licenses
//         if (customer.user_type !== 'admin') {
//             return c.json({ error: 'Unauthorized' }, 403);
//         }

//         if (typeof body.verified !== 'boolean') {
//             return c.json({ error: 'Verified field must be a boolean' }, 400);
//         }

//         const result = await bookingServices.verifyDriverLicenseService(
//             booking_id, 
//             body.verified,
//             body.admin_notes || ''
//         );
        
//         if (result === null) {
//             return c.json({ error: 'Booking not found or verification failed' }, 404);
//         }

//         return c.json({ 
//             success: true,
//             message: `Driver license ${body.verified ? 'verified' : 'unverified'} successfully`, 
//             data: result 
//         }, 200);

//     } catch (error) {
//         console.error('Error verifying driver license:', error);
//         return c.json({ error: 'Failed to verify driver license' }, 500);
//     }
// }

// EXPORT BOOKINGS (Admin only)
export const exportBookings = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        // Get query parameters for filtering
        const filters = {
            status: c.req.query('status'),
            payment_status: c.req.query('payment_status'),
            date_from: c.req.query('date_from'),
            date_to: c.req.query('date_to'),
            search: c.req.query('search'),
            format: c.req.query('format') || 'csv'
        };

        const result = await bookingServices.exportBookingsService(filters);
        
        if (typeof result === "string" && result.startsWith("No bookings found")) {
            return c.json({ error: result }, 404);
        }

        if (typeof result === "string" && result.startsWith("Excel export not implemented")) {
            return c.json({ error: result }, 400);
        }

        // Set appropriate headers for file download
        const contentType = filters.format === 'excel' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            : 'text/csv';
        
        const extension = filters.format === 'excel' ? '.xlsx' : '.csv';
        const filename = `bookings-${new Date().toISOString().split('T')[0]}${extension}`;

        c.header('Content-Type', contentType);
        c.header('Content-Disposition', `attachment; filename="${filename}"`);
        
        return c.body(result);

    } catch (error: any) {
        console.error('Error exporting bookings:', error.message);
        return c.json({ error: 'Failed to export bookings' }, 500);
    }
}

// Download driver license FRONT (admin only) - Node.js version
// In booking.controller.ts - Direct download implementation
export const downloadDriverLicense = async (c: Context) => {
    try {
        const booking_id = parseInt(c.req.param('booking_id'))
        const side = c.req.param('side') as 'front' | 'back'
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }
        
        console.log(`🔍 Direct download for booking ${booking_id} - ${side} license`);
        
        const booking = await bookingServices.getBookingByIdService(booking_id);
        
        if (!booking) {
            return c.json({ error: 'Booking not found' }, 404);
        }
        
        const licenseUrl = side === 'front' 
            ? booking.driver_license_front_url 
            : booking.driver_license_back_url;
        
        if (!licenseUrl) {
            return c.json({ 
                error: `${side} license not found for this booking` 
            }, 404);
        }
        
        console.log(`✅ License URL from DB: ${licenseUrl}`);
        
        // Extract filename from URL - handle both absolute and relative URLs
        let filename = '';
        if (licenseUrl.includes('/')) {
            filename = licenseUrl.split('/').pop() || `license-${side}-${booking_id}.jpg`;
        } else {
            filename = licenseUrl;
        }
        
        // Clean up filename (remove query parameters if any)
        filename = filename.split('?')[0];
        
        console.log(`📄 Extracted filename: ${filename}`);
        
        // Build file path - adjust this based on where your files are stored
        const uploadsDir = path.join(process.cwd(), 'uploads', 'driver-licenses');
        const filePath = path.join(uploadsDir, filename);
        
        console.log(`📁 Looking for file at: ${filePath}`);
        
        // Check if file exists
        try {
            await fs.access(filePath);
            console.log(`✅ File exists on disk`);
        } catch (error) {
            console.error(`❌ File not found: ${filePath}`);
            console.error(`❌ Error details:`, error);
            
            // Alternative: Try different path patterns
            const alternativePaths = [
                path.join(process.cwd(), 'uploads', filename),
                path.join(process.cwd(), 'public', 'uploads', 'driver-licenses', filename),
                path.join(process.cwd(), 'public', 'uploads', filename),
                path.join(__dirname, '..', 'uploads', 'driver-licenses', filename),
            ];
            
            let foundPath = null;
            for (const altPath of alternativePaths) {
                try {
                    await fs.access(altPath);
                    foundPath = altPath;
                    console.log(`✅ Found file at alternative path: ${altPath}`);
                    break;
                } catch {
                    // Continue to next path
                }
            }
            
            if (!foundPath) {
                return c.json({ 
                    success: false,
                    error: 'License file not found on server',
                    details: {
                        expectedPath: filePath,
                        filename: filename,
                        licenseUrl: licenseUrl
                    }
                }, 404);
            }
            
            // Use found path
            const fileBuffer = await fs.readFile(foundPath);
            return serveFile(c, filename, fileBuffer, side);
        }
        
        // Read and serve the file
        const fileBuffer = await fs.readFile(filePath);
        console.log(`✅ Serving file: ${filename} (${fileBuffer.length} bytes)`);
        
        return serveFile(c, filename, fileBuffer, side);
        
    } catch (error: any) {
        console.error(`❌ Error downloading driver license:`, error.message);
        console.error(`❌ Stack trace:`, error.stack);
        return c.json({ 
            success: false,
            error: 'Failed to download driver license: ' + error.message 
        }, 500);
    }
}

// Helper function to serve the file
const serveFile = async (c: Context, filename: string, fileBuffer: Buffer, side: 'front' | 'back') => {
    try {
        // Determine content type from file extension
        const ext = path.extname(filename).toLowerCase();
        let contentType = 'image/jpeg'; // Default
        
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.webp') contentType = 'image/webp';
        
        console.log(`📦 Content-Type: ${contentType}`);
        
        // Set headers for download
        c.header('Content-Type', contentType);
        c.header('Content-Disposition', `attachment; filename="driver-license-${side}-${Date.now()}${ext}"`);
        c.header('Cache-Control', 'no-cache');
        c.header('Content-Length', fileBuffer.length.toString());
        
        return c.body(fileBuffer.toString('binary'), 200);
        
    } catch (error: any) {
        console.error(`❌ Error serving file:`, error.message);
        throw error;
    }
}

// Alternative: Keep separate endpoints for front/back if needed
export const downloadDriverLicenseFront = async (c: Context) => {
    try {
        const booking_id = parseInt(c.req.param('booking_id'));
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }
        
        console.log(`🔍 Download front license for booking ${booking_id}`);
        
        const booking = await bookingServices.getBookingByIdService(booking_id);
        
        if (!booking) {
            return c.json({ error: 'Booking not found' }, 404);
        }
        
        if (!booking.driver_license_front_url) {
            return c.json({ error: 'Front license not found for this booking' }, 404);
        }
        
        // Extract filename
        const licenseUrl = booking.driver_license_front_url;
        let filename = licenseUrl.includes('/') 
            ? licenseUrl.split('/').pop() 
            : licenseUrl;
        
        filename = filename?.split('?')[0] || `front-license-${booking_id}.jpg`;
        
        // Find file
        const uploadsDir = path.join(process.cwd(), 'uploads', 'driver-licenses');
        const filePath = path.join(uploadsDir, filename);
        
        try {
            await fs.access(filePath);
        } catch {
            return c.json({ 
                error: 'Front license file not found on server',
                path: filePath 
            }, 404);
        }
        
        const fileBuffer = await fs.readFile(filePath);
        
        // Set headers
        c.header('Content-Type', 'image/jpeg');
        c.header('Content-Disposition', `attachment; filename="driver-license-front-${booking_id}.jpg"`);
        c.header('Cache-Control', 'no-cache');
        
        return c.body(fileBuffer);
        
    } catch (error: any) {
        console.error('Error downloading front license:', error.message);
        return c.json({ error: 'Failed to download front license' }, 500);
    }
}

export const downloadDriverLicenseBack = async (c: Context) => {
    try {
        const booking_id = parseInt(c.req.param('booking_id'));
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }
        
        console.log(`🔍 Download back license for booking ${booking_id}`);
        
        const booking = await bookingServices.getBookingByIdService(booking_id);
        
        if (!booking) {
            return c.json({ error: 'Booking not found' }, 404);
        }
        
        if (!booking.driver_license_back_url) {
            return c.json({ error: 'Back license not found for this booking' }, 404);
        }
        
        // Extract filename
        const licenseUrl = booking.driver_license_back_url;
        let filename = licenseUrl.includes('/') 
            ? licenseUrl.split('/').pop() 
            : licenseUrl;
        
        filename = filename?.split('?')[0] || `back-license-${booking_id}.jpg`;
        
        // Find file
        const uploadsDir = path.join(process.cwd(), 'uploads', 'driver-licenses');
        const filePath = path.join(uploadsDir, filename);
        
        try {
            await fs.access(filePath);
        } catch {
            return c.json({ 
                error: 'Back license file not found on server',
                path: filePath 
            }, 404);
        }
        
        const fileBuffer = await fs.readFile(filePath);
        
        // Set headers
        c.header('Content-Type', 'image/jpeg');
        c.header('Content-Disposition', `attachment; filename="driver-license-back-${booking_id}.jpg"`);
        c.header('Cache-Control', 'no-cache');
        
        return c.body(fileBuffer);
        
    } catch (error: any) {
        console.error('Error downloading back license:', error.message);
        return c.json({ error: 'Failed to download back license' }, 500);
    }
}
// UPDATED verifyDriverLicense controller to support download
export const verifyDriverLicense = async (c: Context) => {
    try {
        const booking_id = parseInt(c.req.param('booking_id'))
        const customer = c.customer;
        const body = await c.req.json()

        // Only admins can verify licenses
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        if (typeof body.verified !== 'boolean') {
            return c.json({ error: 'Verified field must be a boolean' }, 400);
        }

        // Check if download is requested
        const downloadLicense = body.download_license || false;

        const result = await bookingServices.verifyDriverLicenseService(
            booking_id, 
            body.verified,
            body.admin_notes || '',
            downloadLicense
        );
        
        if (result === null) {
            return c.json({ error: 'Booking not found or verification failed' }, 404);
        }

        const response: any = {
            success: true,
            message: `Driver license ${body.verified ? 'verified' : 'unverified'} successfully`, 
            data: result
        };

        // Add download info if requested
        if (downloadLicense && (result as any).license_download_info) {
            response.license_download_info = (result as any).license_download_info;
        }

        return c.json(response, 200);

    } catch (error) {
        console.error('Error verifying driver license:', error);
        return c.json({ error: 'Failed to verify driver license' }, 500);
    }
}
