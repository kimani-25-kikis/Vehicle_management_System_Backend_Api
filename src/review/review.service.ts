import { getDbPool } from "../db/db.config.ts";

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
    manufacturer?: string;
    model?: string;
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
export const getUserReviewsService = async (user_id: number): Promise<Review[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            r.*,
            v.manufacturer,
            v.model
        FROM Reviews r
        INNER JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
        WHERE r.user_id = @user_id
        ORDER BY r.created_at DESC
    `;
    
    const result = await db.request()
        .input('user_id', user_id)
        .query(query);
    
    return result.recordset;
}

// Get approved reviews for homepage
export const getApprovedReviewsService = async (): Promise<Review[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            r.*,
            u.first_name,
            u.last_name,
            v.manufacturer,
            v.model
        FROM Reviews r
        INNER JOIN Users u ON r.user_id = u.user_id
        INNER JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
        WHERE r.is_approved = 1
        ORDER BY r.created_at DESC
    `;
    
    const result = await db.request().query(query);
    return result.recordset;
}

// Get all reviews for admin moderation
export const getAllReviewsService = async (): Promise<Review[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            r.*,
            u.first_name,
            u.last_name,
            u.email,
            v.manufacturer,
            v.model
        FROM Reviews r
        INNER JOIN Users u ON r.user_id = u.user_id
        INNER JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
        ORDER BY 
            r.is_approved ASC,
            r.created_at DESC
    `;
    
    const result = await db.request().query(query);
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
export const getHomepageReviewsService = async (): Promise<Review[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            r.*,
            u.first_name,
            u.last_name,
            v.manufacturer,
            v.model
        FROM Reviews r
        INNER JOIN Users u ON r.user_id = u.user_id
        INNER JOIN Vehicles v ON r.vehicle_id = v.vehicle_id
        WHERE r.is_approved = 1 
          AND r.show_on_homepage = 1
        ORDER BY r.updated_at DESC
        LIMIT 10  -- Limit to 10 reviews for homepage
    `;
    
    const result = await db.request().query(query);
    return result.recordset;
}