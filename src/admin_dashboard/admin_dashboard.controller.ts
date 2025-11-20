import { type Context } from "hono"
import * as analyticsServices from "./admin_dashboard.service.ts";

// Get overview statistics
export const getOverviewStats = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await analyticsServices.getOverviewStatsService();
        
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching overview stats:', error.message);
        return c.json({ error: 'Failed to fetch overview statistics' }, 500);
    }
}

// Get revenue chart data
export const getRevenueChartData = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const period = c.req.query('period') || 'monthly'; // daily, weekly, monthly, yearly
        
        const result = await analyticsServices.getRevenueChartDataService(period);
        
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching revenue chart data:', error.message);
        return c.json({ error: 'Failed to fetch revenue chart data' }, 500);
    }
}

// Get top rented vehicles
export const getTopRentedVehicles = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        // Fix: Provide default value for limit parameter
        const limitParam = c.req.query('limit');
        const limit = limitParam ? parseInt(limitParam) : 10;
        
        const result = await analyticsServices.getTopRentedVehiclesService(limit);
        
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching top rented vehicles:', error.message);
        return c.json({ error: 'Failed to fetch top rented vehicles' }, 500);
    }
}

// Get booking trends
export const getBookingTrends = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const period = c.req.query('period') || 'monthly'; // daily, weekly, monthly, yearly
        
        const result = await analyticsServices.getBookingTrendsService(period);
        
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching booking trends:', error.message);
        return c.json({ error: 'Failed to fetch booking trends' }, 500);
    }
}

// Get user statistics
export const getUserStats = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await analyticsServices.getUserStatsService();
        
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching user statistics:', error.message);
        return c.json({ error: 'Failed to fetch user statistics' }, 500);
    }
}

// Get location insights
export const getLocationInsights = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await analyticsServices.getLocationInsightsService();
        
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching location insights:', error.message);
        return c.json({ error: 'Failed to fetch location insights' }, 500);
    }
}