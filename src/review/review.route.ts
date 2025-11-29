import { Hono } from 'hono';
import * as reviewControllers from './review.controller.ts';
import { customerRoleAuth, adminRoleAuth } from '../middleware/bearAuth.ts';

const reviewRoutes = new Hono();

// User routes - require customer authentication
reviewRoutes.post('/reviews', customerRoleAuth, reviewControllers.createReview);
reviewRoutes.get('/reviews/my-reviews', customerRoleAuth, reviewControllers.getMyReviews);

// Public route for homepage - no authentication required
reviewRoutes.get('/reviews/approved', reviewControllers.getApprovedReviews);

// Admin routes - require admin authentication
reviewRoutes.get('/reviews/admin/all', adminRoleAuth, reviewControllers.getAllReviews);
reviewRoutes.patch('/reviews/admin/approve/:review_id', adminRoleAuth, reviewControllers.approveReview);
reviewRoutes.patch('/reviews/admin/reject/:review_id', adminRoleAuth, reviewControllers.rejectReview);
reviewRoutes.get('/reviews/admin/:review_id', adminRoleAuth, reviewControllers.getReviewById);

export default reviewRoutes;