import { getDbPool } from "../db/db.config.ts"

interface OverviewStats {
    total_bookings: number;
    total_revenue: number;
    total_users: number;
    total_vehicles: number;
    active_bookings: number;
    pending_bookings: number;
    available_vehicles: number;
    revenue_today: number;
    bookings_today: number;
}

interface RevenueData {
    period: string;
    revenue: number;
    bookings: number;
}

interface TopVehicle {
    vehicle_id: number;
    manufacturer: string;
    model: string;
    rental_count: number;
    total_revenue: number;
    avg_rating?: number;
}

interface BookingTrend {
    period: string;
    bookings: number;
    completed: number;
    cancelled: number;
}

interface UserStats {
    total_users: number;
    active_users: number;
    new_users_today: number;
    new_users_this_week: number;
    user_growth: number;
}

interface LocationInsight {
    location: string;
    booking_count: number;
    revenue: number;
    popular_vehicle_type: string;
}

// Get overview statistics
export const getOverviewStatsService = async (): Promise<OverviewStats> => {
    const db = getDbPool();
    
    try {
        const query = `
            SELECT 
                -- Total bookings
                (SELECT COUNT(*) FROM Bookings) as total_bookings,
                
                -- Total revenue (from completed payments)
                (SELECT ISNULL(SUM(amount), 0) FROM Payments WHERE payment_status = 'Completed') as total_revenue,
                
                -- Total users
                (SELECT COUNT(*) FROM Users) as total_users,
                
                -- Total vehicles
                (SELECT COUNT(*) FROM Vehicles) as total_vehicles,
                
                -- Active bookings
                (SELECT COUNT(*) FROM Bookings WHERE booking_status IN ('Confirmed', 'Active')) as active_bookings,
                
                -- Pending bookings
                (SELECT COUNT(*) FROM Bookings WHERE booking_status = 'Pending') as pending_bookings,
                
                -- Available vehicles
                (SELECT COUNT(*) FROM Vehicles WHERE availability = 1) as available_vehicles,
                
                -- Revenue today
                (SELECT ISNULL(SUM(amount), 0) FROM Payments 
                 WHERE payment_status = 'Completed' 
                 AND CAST(payment_date AS DATE) = CAST(GETDATE() AS DATE)) as revenue_today,
                
                -- Bookings today
                (SELECT COUNT(*) FROM Bookings 
                 WHERE CAST(booking_date AS DATE) = CAST(GETDATE() AS DATE)) as bookings_today
        `;
        
        const result = await db.request().query(query);
        return result.recordset[0];
    } catch (error: any) {
        console.error('Error in getOverviewStatsService:', error);
        throw new Error("Failed to fetch overview statistics");
    }
}

// Get revenue chart data
export const getRevenueChartDataService = async (period: string = 'monthly'): Promise<RevenueData[]> => {
    const db = getDbPool();
    
    try {
        let dateFormat, groupBy;
        
        switch (period) {
            case 'daily':
                dateFormat = 'YYYY-MM-DD';
                groupBy = 'DAY';
                break;
            case 'weekly':
                dateFormat = 'YYYY-WW';
                groupBy = 'WEEK';
                break;
            case 'yearly':
                dateFormat = 'YYYY';
                groupBy = 'YEAR';
                break;
            default: // monthly
                dateFormat = 'YYYY-MM';
                groupBy = 'MONTH';
        }

        const query = `
            SELECT 
                FORMAT(p.payment_date, '${dateFormat}') as period,
                SUM(p.amount) as revenue,
                COUNT(DISTINCT p.booking_id) as bookings
            FROM Payments p
            WHERE p.payment_status = 'Completed'
            AND p.payment_date >= DATEADD(MONTH, -6, GETDATE())
            GROUP BY FORMAT(p.payment_date, '${dateFormat}')
            ORDER BY period
        `;
        
        const result = await db.request().query(query);
        return result.recordset;
    } catch (error: any) {
        console.error('Error in getRevenueChartDataService:', error);
        throw new Error("Failed to fetch revenue chart data");
    }
}

// Get top rented vehicles
export const getTopRentedVehiclesService = async (limit: number = 10): Promise<TopVehicle[]> => {
    const db = getDbPool();
    
    try {
        const query = `
            SELECT TOP ${limit}
                v.vehicle_id,
                vs.manufacturer,
                vs.model,
                COUNT(b.booking_id) as rental_count,
                SUM(COALESCE(p.amount, 0)) as total_revenue
            FROM Vehicles v
            JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
            LEFT JOIN Bookings b ON v.vehicle_id = b.vehicle_id
            LEFT JOIN Payments p ON b.booking_id = p.booking_id AND p.payment_status = 'Completed'
            GROUP BY v.vehicle_id, vs.manufacturer, vs.model
            ORDER BY rental_count DESC, total_revenue DESC
        `;
        
        const result = await db.request().query(query);
        return result.recordset;
    } catch (error: any) {
        console.error('Error in getTopRentedVehiclesService:', error);
        throw new Error("Failed to fetch top rented vehicles");
    }
}

// Get booking trends
export const getBookingTrendsService = async (period: string = 'monthly'): Promise<BookingTrend[]> => {
    const db = getDbPool();
    
    try {
        let dateFormat;
        
        switch (period) {
            case 'daily':
                dateFormat = 'YYYY-MM-DD';
                break;
            case 'weekly':
                dateFormat = 'YYYY-WW';
                break;
            case 'yearly':
                dateFormat = 'YYYY';
                break;
            default: // monthly
                dateFormat = 'YYYY-MM';
        }

        const query = `
            SELECT 
                FORMAT(booking_date, '${dateFormat}') as period,
                COUNT(*) as bookings,
                SUM(CASE WHEN booking_status = 'Completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN booking_status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled
            FROM Bookings
            WHERE booking_date >= DATEADD(MONTH, -6, GETDATE())
            GROUP BY FORMAT(booking_date, '${dateFormat}')
            ORDER BY period
        `;
        
        const result = await db.request().query(query);
        return result.recordset;
    } catch (error: any) {
        console.error('Error in getBookingTrendsService:', error);
        throw new Error("Failed to fetch booking trends");
    }
}

// Get user statistics
export const getUserStatsService = async (): Promise<UserStats> => {
    const db = getDbPool();
    
    try {
        const query = `
            SELECT 
                -- Total users
                (SELECT COUNT(*) FROM Users) as total_users,
                
                -- Active users (users with bookings in last 30 days)
                (SELECT COUNT(DISTINCT user_id) FROM Bookings 
                 WHERE booking_date >= DATEADD(DAY, -30, GETDATE())) as active_users,
                
                -- New users today
                (SELECT COUNT(*) FROM Users 
                 WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)) as new_users_today,
                
                -- New users this week
                (SELECT COUNT(*) FROM Users 
                 WHERE created_at >= DATEADD(DAY, -7, GETDATE())) as new_users_this_week,
                
                -- User growth (new users in last 30 days)
                (SELECT COUNT(*) FROM Users 
                 WHERE created_at >= DATEADD(DAY, -30, GETDATE())) as user_growth
        `;
        
        const result = await db.request().query(query);
        return result.recordset[0];
    } catch (error: any) {
        console.error('Error in getUserStatsService:', error);
        throw new Error("Failed to fetch user statistics");
    }
}

// Get location insights
export const getLocationInsightsService = async (): Promise<LocationInsight[]> => {
    const db = getDbPool();
    
    try {
        const query = `
            SELECT 
                v.current_location as location,
                COUNT(b.booking_id) as booking_count,
                SUM(COALESCE(p.amount, 0)) as revenue,
                (
                    SELECT TOP 1 vs.vehicle_type 
                    FROM Bookings b2 
                    JOIN Vehicles v2 ON b2.vehicle_id = v2.vehicle_id
                    JOIN VehicleSpecifications vs ON v2.vehicle_spec_id = vs.vehicle_spec_id
                    WHERE v2.current_location = v.current_location
                    GROUP BY vs.vehicle_type
                    ORDER BY COUNT(*) DESC
                ) as popular_vehicle_type
            FROM Vehicles v
            LEFT JOIN Bookings b ON v.vehicle_id = b.vehicle_id
            LEFT JOIN Payments p ON b.booking_id = p.booking_id AND p.payment_status = 'Completed'
            WHERE v.current_location IS NOT NULL
            GROUP BY v.current_location
            ORDER BY booking_count DESC, revenue DESC
        `;
        
        const result = await db.request().query(query);
        return result.recordset;
    } catch (error: any) {
        console.error('Error in getLocationInsightsService:', error);
        throw new Error("Failed to fetch location insights");
    }
}