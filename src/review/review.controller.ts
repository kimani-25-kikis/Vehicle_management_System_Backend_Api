import { type Context } from "hono";
import * as reviewServices from "./review.service.ts";

// Create a new review
export const createReview = async (c: Context) => {
    try {
        const body = await c.req.json();
        const user_id = c.customer.user_id; // From authentication middleware

        // Validation
        if (!body.booking_id || !body.vehicle_id || !body.rating || !body.comment) {
            return c.json({ error: 'Missing required fields: booking_id, vehicle_id, rating, comment' }, 400);
        }

        if (body.rating < 1 || body.rating > 5) {
            return c.json({ error: 'Rating must be between 1 and 5' }, 400);
        }

        // Check if user already reviewed this booking
        const existingReview = await reviewServices.getReviewByBookingIdService(body.booking_id);
        if (existingReview) {
            return c.json({ error: 'You have already reviewed this booking' }, 400);
        }

        // Check if booking belongs to user and is completed
        const isValidBooking = await reviewServices.validateUserBookingService(user_id, body.booking_id);
        if (!isValidBooking) {
            return c.json({ error: 'Invalid booking or booking not completed' }, 400);
        }

        const result = await reviewServices.createReviewService({
            user_id,
            vehicle_id: body.vehicle_id,
            booking_id: body.booking_id,
            rating: body.rating,
            comment: body.comment
        });

        return c.json({ 
            message: 'Review submitted successfully! It will appear after admin approval.',
            review: result 
        }, 201);

    } catch (error: any) {
        console.error('Error creating review:', error.message);
        return c.json({ error: 'Failed to create review' }, 500);
    }
}

// Get user's own reviews
export const getMyReviews = async (c: Context) => {
    try {
        const user_id = c.customer.user_id; // From authentication middleware
        const result = await reviewServices.getUserReviewsService(user_id);
        
        return c.json({ reviews: result });

    } catch (error: any) {
        console.error('Error fetching user reviews:', error.message);
        return c.json({ error: 'Failed to fetch reviews' }, 500);
    }
}

// Get approved reviews for homepage (public endpoint)
export const getApprovedReviews = async (c: Context) => {
    try {
        const result = await reviewServices.getApprovedReviewsService();
        
        return c.json({ reviews: result });

    } catch (error: any) {
        console.error('Error fetching approved reviews:', error.message);
        return c.json({ error: 'Failed to fetch reviews' }, 500);
    }
}

// Admin: Get all reviews for moderation
export const getAllReviews = async (c: Context) => {
    try {
        const result = await reviewServices.getAllReviewsService();
        
        return c.json({ reviews: result });

    } catch (error: any) {
        console.error('Error fetching all reviews:', error.message);
        return c.json({ error: 'Failed to fetch reviews' }, 500);
    }
}

// Admin: Approve a review
export const approveReview = async (c: Context) => {
    try {
        const review_id = parseInt(c.req.param('review_id'));
        
        const result = await reviewServices.approveReviewService(review_id);
        
        if (!result) {
            return c.json({ error: 'Review not found' }, 404);
        }

        return c.json({ 
            message: 'Review approved successfully',
            review: result 
        });

    } catch (error: any) {
        console.error('Error approving review:', error.message);
        return c.json({ error: 'Failed to approve review' }, 500);
    }
}

// Admin: Reject a review
export const rejectReview = async (c: Context) => {
    try {
        const review_id = parseInt(c.req.param('review_id'));
        const body = await c.req.json();
        
        const result = await reviewServices.rejectReviewService(review_id, body.admin_notes);
        
        if (!result) {
            return c.json({ error: 'Review not found' }, 404);
        }

        return c.json({ 
            message: 'Review rejected successfully',
            review: result 
        });

    } catch (error: any) {
        console.error('Error rejecting review:', error.message);
        return c.json({ error: 'Failed to reject review' }, 500);
    }
}

// Get review by ID (optional - for admin or specific review lookup)
export const getReviewById = async (c: Context) => {
    try {
        const review_id = parseInt(c.req.param('review_id'));
        
        const result = await reviewServices.getReviewByIdService(review_id);
        
        if (!result) {
            return c.json({ error: 'Review not found' }, 404);
        }

        return c.json({ review: result });

    } catch (error: any) {
        console.error('Error fetching review:', error.message);
        return c.json({ error: 'Failed to fetch review' }, 500);
    }
}