import { getDbPool } from "../db/db.config.ts";

// review.service.ts - Update the Review interface
export interface Review {
    review_id: number;
    user_id: number;
    vehicle_id: number;
    booking_id: number;
    rating: number;
    comment: string;
    is_approved: boolean;
    admin_notes?: string;
    created_at: Date;
    updated_at: Date;
    first_name?: string;
    last_name?: string;
    email?: string;
    manufacturer?: string;
    model?: string;
    year?: number;
    vehicle_type?: string;
    show_on_homepage?: boolean;
    vehicle_name?: string;
    user_name?: string;
}
export interface CreateReviewData {
    user_id: number;
    vehicle_id: number;
    booking_id: number;
    rating: number;
    comment: string;
}

// Create a new review
export const createReviewService = async (data: CreateReviewData): Promise<Review | null> => {
    const db = getDbPool();
    
    const query = `
        INSERT INTO Reviews (user_id, vehicle_id, booking_id, rating, comment, is_approved)
        OUTPUT INSERTED.*
        VALUES (@user_id, @vehicle_id, @booking_id, @rating, @comment, 0)
    `;
    
    const result = await db.request()
        .input('user_id', data.user_id)
        .input('vehicle_id', data.vehicle_id)
        .input('booking_id', data.booking_id)
        .input('rating', data.rating)
        .input('comment', data.comment)
        .query(query);
    
    return result.recordset[0] || null;
}

// Get user's own reviews
// review.service.ts - Update this function too
export const getUserReviewsService = async (user_id: number): Promise<Review[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT DISTINCT
            r.review_id,
            r.user_id,
            r.vehicle_id,
            r.booking_id,
            r.rating,
            r.comment,
            r.is_approved,
            r.admin_notes,
            r.created_at,
            r.updated_at,
            r.show_on_homepage,
            COALESCE(vs.manufacturer, 'Unknown') as manufacturer,
            COALESCE(vs.model, 'Unknown') as model,
            COALESCE(CONCAT(vs.manufacturer, ' ', vs.model), 'Vehicle') as vehicle_name
        FROM Reviews r
        LEFT JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
        LEFT JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE r.user_id = @user_id
        GROUP BY 
            r.review_id,
            r.user_id,
            r.vehicle_id,
            r.booking_id,
            r.rating,
            r.comment,
            r.is_approved,
            r.admin_notes,
            r.created_at,
            r.updated_at,
            r.show_on_homepage,
            vs.manufacturer,
            vs.model
        ORDER BY r.created_at DESC
    `;
    
    const result = await db.request()
        .input('user_id', user_id)
        .query(query);
    
    console.log(`✅ getUserReviewsService: Found ${result.recordset.length} unique reviews for user ${user_id}`);
    return result.recordset;
}
// Get approved reviews for homepage
// review.service.ts - Update this function too
export const getApprovedReviewsService = async (): Promise<Review[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT DISTINCT
            r.review_id,
            r.user_id,
            r.vehicle_id,
            r.booking_id,
            r.rating,
            r.comment,
            r.is_approved,
            r.admin_notes,
            r.created_at,
            r.updated_at,
            r.show_on_homepage,
            COALESCE(u.first_name, 'User') as first_name,
            COALESCE(u.last_name, '') as last_name,
            CONCAT(COALESCE(u.first_name, 'User'), ' ', COALESCE(u.last_name, '')) as user_name,
            COALESCE(vs.manufacturer, 'Unknown') as manufacturer,
            COALESCE(vs.model, 'Unknown') as model,
            COALESCE(CONCAT(vs.manufacturer, ' ', vs.model), 'Vehicle') as vehicle_name
        FROM Reviews r
        LEFT JOIN Users u ON r.user_id = u.user_id
        LEFT JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
        LEFT JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE r.is_approved = 1
        GROUP BY 
            r.review_id,
            r.user_id,
            r.vehicle_id,
            r.booking_id,
            r.rating,
            r.comment,
            r.is_approved,
            r.admin_notes,
            r.created_at,
            r.updated_at,
            r.show_on_homepage,
            u.first_name,
            u.last_name,
            vs.manufacturer,
            vs.model
        ORDER BY r.created_at DESC
    `;
    
    const result = await db.request().query(query);
    console.log(`✅ getApprovedReviewsService: Found ${result.recordset.length} approved reviews`);
    return result.recordset;
}

// Get all reviews for admin moderation
// review.service.ts - Updated with correct JOIN
export const getAllReviewsService = async (): Promise<Review[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT DISTINCT
            r.review_id,
            r.user_id,
            r.vehicle_id,
            r.booking_id,
            r.rating,
            r.comment,
            r.is_approved,
            r.admin_notes,
            r.created_at,
            r.updated_at,
            r.show_on_homepage,
            COALESCE(u.first_name, 'User') as first_name,
            COALESCE(u.last_name, '') as last_name,
            COALESCE(u.email, '') as email,
            CONCAT(COALESCE(u.first_name, 'User'), ' ', COALESCE(u.last_name, '')) as user_name,
            COALESCE(vs.manufacturer, 'Unknown') as manufacturer,
            COALESCE(vs.model, 'Unknown') as model,
            COALESCE(vs.year, 0) as year,
            COALESCE(vs.vehicle_type, 'Unknown') as vehicle_type,
            COALESCE(CONCAT(vs.manufacturer, ' ', vs.model), 'Vehicle') as vehicle_name
        FROM Reviews r
        LEFT JOIN Users u ON r.user_id = u.user_id
        LEFT JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
        LEFT JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        GROUP BY 
            r.review_id,
            r.user_id,
            r.vehicle_id,
            r.booking_id,
            r.rating,
            r.comment,
            r.is_approved,
            r.admin_notes,
            r.created_at,
            r.updated_at,
            r.show_on_homepage,
            u.first_name,
            u.last_name,
            u.email,
            vs.manufacturer,
            vs.model,
            vs.year,
            vs.vehicle_type
        ORDER BY 
            r.is_approved ASC,
            r.created_at DESC
    `;
    
    const result = await db.request().query(query);
    console.log(`✅ getAllReviewsService: Found ${result.recordset.length} total reviews`);
    return result.recordset;
}

// Get review by booking ID
export const getReviewByBookingIdService = async (booking_id: number): Promise<Review | null> => {
    const db = getDbPool();
    
    const query = `
        SELECT * FROM Reviews 
        WHERE booking_id = @booking_id
    `;
    
    const result = await db.request()
        .input('booking_id', booking_id)
        .query(query);
    
    return result.recordset[0] || null;
}

// Validate if booking belongs to user and is completed
export const validateUserBookingService = async (user_id: number, booking_id: number): Promise<boolean> => {
    const db = getDbPool();
    
    const query = `
        SELECT booking_id FROM Bookings 
        WHERE booking_id = @booking_id 
        AND user_id = @user_id 
        AND booking_status = 'completed'
    `;
    
    const result = await db.request()
        .input('booking_id', booking_id)
        .input('user_id', user_id)
        .query(query);
    
    return result.recordset.length > 0;
}

// Admin: Approve a review
export const approveReviewService = async (review_id: number): Promise<Review | null> => {
    const db = getDbPool();
    
    const query = `
        UPDATE Reviews 
        SET is_approved = 1, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE review_id = @review_id
    `;
    
    const result = await db.request()
        .input('review_id', review_id)
        .query(query);
    
    return result.recordset[0] || null;
}

// Admin: Reject a review
export const rejectReviewService = async (review_id: number, admin_notes?: string): Promise<Review | null> => {
    const db = getDbPool();
    
    const query = `
        UPDATE Reviews 
        SET is_approved = 0, admin_notes = @admin_notes, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE review_id = @review_id
    `;
    
    const result = await db.request()
        .input('review_id', review_id)
        .input('admin_notes', admin_notes || null)
        .query(query);
    
    return result.recordset[0] || null;
}

// Get review by ID
export const getReviewByIdService = async (review_id: number): Promise<Review | null> => {
    const db = getDbPool();
    
    const query = `
        SELECT * FROM Reviews 
        WHERE review_id = @review_id
    `;
    
    const result = await db.request()
        .input('review_id', review_id)
        .query(query);
    
    return result.recordset[0] || null;
}
export const markForHomepageService = async (review_id: number): Promise<Review | null> => {
    const db = getDbPool();
    
    const query = `
        UPDATE Reviews 
        SET show_on_homepage = 1, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE review_id = @review_id AND is_approved = 1
    `;
    
    const result = await db.request()
        .input('review_id', review_id)
        .query(query);
    
    return result.recordset[0] || null;
}

// Unmark review from homepage
export const unmarkFromHomepageService = async (review_id: number): Promise<Review | null> => {
    const db = getDbPool();
    
    const query = `
        UPDATE Reviews 
        SET show_on_homepage = 0, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE review_id = @review_id
    `;
    
    const result = await db.request()
        .input('review_id', review_id)
        .query(query);
    
    return result.recordset[0] || null;
}

// Get reviews for homepage (only approved and marked for homepage)
// review.service.ts - Update this function too (if you created it)
export const getHomepageReviewsService = async (): Promise<Review[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT DISTINCT
            r.review_id,
            r.user_id,
            r.vehicle_id,
            r.booking_id,
            r.rating,
            r.comment,
            r.is_approved,
            r.admin_notes,
            r.created_at,
            r.updated_at,
            r.show_on_homepage,
            COALESCE(u.first_name, 'User') as first_name,
            COALESCE(u.last_name, '') as last_name,
            CONCAT(COALESCE(u.first_name, 'User'), ' ', COALESCE(u.last_name, '')) as user_name,
            COALESCE(vs.manufacturer, 'Unknown') as manufacturer,
            COALESCE(vs.model, 'Unknown') as model,
            COALESCE(CONCAT(vs.manufacturer, ' ', vs.model), 'Vehicle') as vehicle_name
        FROM Reviews r
        LEFT JOIN Users u ON r.user_id = u.user_id
        LEFT JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
        LEFT JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE r.is_approved = 1 
          AND r.show_on_homepage = 1
        GROUP BY 
            r.review_id,
            r.user_id,
            r.vehicle_id,
            r.booking_id,
            r.rating,
            r.comment,
            r.is_approved,
            r.admin_notes,
            r.created_at,
            r.updated_at,
            r.show_on_homepage,
            u.first_name,
            u.last_name,
            vs.manufacturer,
            vs.model
        ORDER BY r.updated_at DESC
        OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
    `;
    
    const result = await db.request().query(query);
    console.log(`✅ getHomepageReviewsService: Found ${result.recordset.length} homepage reviews`);
    return result.recordset;
}