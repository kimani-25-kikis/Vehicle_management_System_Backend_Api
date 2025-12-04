import { getDbPool } from "../db/db.config.ts";

// Add this helper function at the TOP
const formatTicketWithAttachments = (ticket: any): SupportTicket => {
    let attachments: string[] = [];
    
    if (ticket.attachments) {
        try {
            attachments = JSON.parse(ticket.attachments);
        } catch (e) {
            console.error('Error parsing attachments JSON:', e);
        }
    }
    
    return {
        ...ticket,
        attachments,
        user_name: ticket.user_name || `${ticket.first_name} ${ticket.last_name}`,
        vehicle_name: ticket.vehicle_name || undefined,
        // Ensure all required fields are present
        priority: ticket.priority || 'medium',
        response_count: ticket.response_count || 0,
        last_response: ticket.last_response || undefined,
        last_response_at: ticket.last_response_at || undefined,
        last_response_by: ticket.last_response_by || undefined,
        assigned_to: ticket.assigned_to || undefined,
        assigned_at: ticket.assigned_at || undefined,
        admin_notes: ticket.admin_notes || undefined,
        resolved_at: ticket.resolved_at || undefined,
        closed_at: ticket.closed_at || undefined
    };
};

export interface SupportTicket {
    ticket_id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    user_phone?: string;
    subject: string;
    description: string;
    type: 'damage_report' | 'general_inquiry' | 'technical_issue' | 'billing' | 'complaint' | 'feedback';
    priority: 'urgent' | 'high' | 'medium' | 'low';
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed' | 'On Hold';
    assigned_to?: string;
    assigned_at?: Date;
    booking_id?: number;
    vehicle_name?: string;
    admin_notes?: string;
    last_response?: string;
    last_response_at?: Date;
    last_response_by?: number;
    response_count: number;
    attachments?: string[];
    created_at: Date;
    updated_at: Date;
    resolved_at?: Date;
    closed_at?: Date;
    first_name?: string;
    last_name?: string;
    email?: string;
}

export interface CreateTicketData {
    user_id: number;
    subject: string;
    description: string;
    type: 'damage_report' | 'general_inquiry' | 'technical_issue' | 'billing' | 'complaint' | 'feedback';
    booking_id?: number | null;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
}

// Create a new support ticket
export const createTicketService = async (data: CreateTicketData): Promise<SupportTicket | null> => {
    const db = getDbPool();

    console.log("🟠 SERVICE - Creating ticket with data:", data);

    const query = `
        INSERT INTO SupportTickets (user_id, subject, description, type, booking_id, priority, status)
        OUTPUT INSERTED.*
        VALUES (@user_id, @subject, @description, @type, @booking_id, @priority, 'Open')
    `;
    
    const request = db.request()
        .input('user_id', data.user_id)
        .input('subject', data.subject)
        .input('description', data.description)
        .input('type', data.type)
        .input('priority', data.priority || 'medium');
    
    if (data.booking_id) {
        request.input('booking_id', data.booking_id);
    } else {
        request.input('booking_id', null);
    }
    
    const result = await request.query(query);
    return result.recordset[0] ? formatTicketWithAttachments(result.recordset[0]) : null;
}

// Get user's own tickets
export const getUserTicketsService = async (user_id: number): Promise<SupportTicket[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            st.*,
            u.first_name,
            u.last_name,
            u.email,
            u.phone_number as user_phone,
            CONCAT(u.first_name, ' ', u.last_name) as user_name
        FROM SupportTickets st
        INNER JOIN Users u ON st.user_id = u.user_id
        WHERE st.user_id = @user_id 
        ORDER BY 
            CASE st.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END,
            st.created_at DESC
    `;
    
    const result = await db.request()
        .input('user_id', user_id)
        .query(query);
    
    return result.recordset.map(formatTicketWithAttachments);
}

// Get ticket by ID
export const getTicketByIdService = async (ticket_id: number): Promise<SupportTicket | null> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            st.*,
            u.first_name,
            u.last_name,
            u.email,
            u.phone_number as user_phone,
            CONCAT(u.first_name, ' ', u.last_name) as user_name,
            b.vehicle_id,
            vs.manufacturer + ' ' + vs.model as vehicle_name
        FROM SupportTickets st
        INNER JOIN Users u ON st.user_id = u.user_id
        LEFT JOIN Bookings b ON st.booking_id = b.booking_id
        LEFT JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        LEFT JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE st.ticket_id = @ticket_id
    `;
    
    const result = await db.request()
        .input('ticket_id', ticket_id)
        .query(query);
    
    return result.recordset[0] ? formatTicketWithAttachments(result.recordset[0]) : null;
}

// Get all tickets (for admin) with filters - SINGLE VERSION (remove duplicate)
export const getAllTicketsService = async (
    status?: string | null, 
    type?: string | null,
    priority?: string | null,
    search?: string | null
): Promise<SupportTicket[]> => {
    const db = getDbPool();
    
    let query = `
        SELECT 
            st.*,
            u.first_name,
            u.last_name,
            u.email,
            u.phone_number as user_phone,
            CONCAT(u.first_name, ' ', u.last_name) as user_name,
            b.vehicle_id,
            vs.manufacturer + ' ' + vs.model as vehicle_name
        FROM SupportTickets st
        INNER JOIN Users u ON st.user_id = u.user_id
        LEFT JOIN Bookings b ON st.booking_id = b.booking_id
        LEFT JOIN Vehicles v ON b.vehicle_id = v.vehicle_id
        LEFT JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE 1=1
    `;
    
    const conditions: string[] = [];
    const request = db.request();
    
    if (status && status !== 'all') {
        conditions.push('st.status = @status');
        request.input('status', status);
    }
    
    if (type && type !== 'all') {
        conditions.push('st.type = @type');
        request.input('type', type);
    }
    
    if (priority && priority !== 'all') {
        conditions.push('st.priority = @priority');
        request.input('priority', priority);
    }
    
    if (search && search.trim() !== '') {
        conditions.push(`(
            st.subject LIKE @search OR 
            st.description LIKE @search OR
            u.first_name + ' ' + u.last_name LIKE @search OR
            u.email LIKE @search OR
            st.ticket_id LIKE @search
        )`);
        request.input('search', `%${search}%`);
    }
    
    if (conditions.length > 0) {
        query += ` AND ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY 
        CASE st.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
        END,
        st.created_at DESC`;
    
    console.log('Executing query:', query);
    console.log('Parameters:', { status, type, priority, search });
    
    const result = await request.query(query);
    console.log('Query result count:', result.recordset.length);
    
    return result.recordset.map(formatTicketWithAttachments);
}

// Update ticket status
export const updateTicketStatusService = async (ticket_id: number, status: string): Promise<SupportTicket | null> => {
    const db = getDbPool();
    
    const query = `
        UPDATE SupportTickets 
        SET status = @status, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE ticket_id = @ticket_id
    `;
    
    const result = await db.request()
        .input('ticket_id', ticket_id)
        .input('status', status)
        .query(query);
    
    return result.recordset[0] ? formatTicketWithAttachments(result.recordset[0]) : null;
}

// Add admin notes to ticket
export const addAdminNotesService = async (ticket_id: number, admin_notes: string): Promise<SupportTicket | null> => {
    const db = getDbPool();
    
    const query = `
        UPDATE SupportTickets 
        SET admin_notes = @admin_notes, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE ticket_id = @ticket_id
    `;
    
    const result = await db.request()
        .input('ticket_id', ticket_id)
        .input('admin_notes', admin_notes)
        .query(query);
    
    return result.recordset[0] ? formatTicketWithAttachments(result.recordset[0]) : null;
}

// Assign ticket to admin
export const assignTicketService = async (ticket_id: number, assigned_to: string): Promise<SupportTicket | null> => {
    const db = getDbPool();
    
    const query = `
        UPDATE SupportTickets 
        SET assigned_to = @assigned_to, 
            assigned_at = GETDATE(),
            status = 'In Progress',
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE ticket_id = @ticket_id
    `;
    
    const result = await db.request()
        .input('ticket_id', ticket_id)
        .input('assigned_to', assigned_to)
        .query(query);
    
    return result.recordset[0] ? formatTicketWithAttachments(result.recordset[0]) : null;
}

// Add reply to ticket
export const addTicketReplyService = async (
    ticket_id: number, 
    user_id: number, 
    message: string, 
    is_admin_reply: boolean
): Promise<SupportTicket | null> => {
    const db = getDbPool();
    
    // First update the ticket with last response
    const updateQuery = `
        UPDATE SupportTickets 
        SET last_response = @message,
            last_response_at = GETDATE(),
            last_response_by = @user_id,
            response_count = ISNULL(response_count, 0) + 1,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE ticket_id = @ticket_id
    `;
    
    const result = await db.request()
        .input('ticket_id', ticket_id)
        .input('message', message)
        .input('user_id', user_id)
        .query(updateQuery);
    
    // Also insert into TicketReplies table if it exists
    try {
        const replyQuery = `
            INSERT INTO TicketReplies (ticket_id, user_id, message, is_admin_reply)
            VALUES (@ticket_id, @user_id, @message, @is_admin_reply)
        `;
        
        await db.request()
            .input('ticket_id', ticket_id)
            .input('user_id', user_id)
            .input('message', message)
            .input('is_admin_reply', is_admin_reply ? 1 : 0)
            .query(replyQuery);
    } catch (error) {
        console.log('TicketReplies table not found, skipping reply insertion');
    }
    
    return result.recordset[0] ? formatTicketWithAttachments(result.recordset[0]) : null;
}

// Upload attachment
export const uploadAttachmentService = async (
    ticket_id: number,
    filename: string,
    file_url: string,
    file_type: string,
    file_size: number,
    uploaded_by: number
): Promise<boolean> => {
    const db = getDbPool();
    
    try {
        // Get current attachments
        const getQuery = `SELECT attachments FROM SupportTickets WHERE ticket_id = @ticket_id`;
        const getResult = await db.request()
            .input('ticket_id', ticket_id)
            .query(getQuery);
        
        let attachments: any[] = [];
        if (getResult.recordset[0]?.attachments) {
            try {
                attachments = JSON.parse(getResult.recordset[0].attachments);
            } catch (e) {
                attachments = [];
            }
        }
        
        // Add new attachment
        attachments.push({
            filename,
            url: file_url,
            type: file_type,
            size: file_size,
            uploaded_by,
            uploaded_at: new Date().toISOString()
        });
        
        // Update ticket
        const updateQuery = `
            UPDATE SupportTickets 
            SET attachments = @attachments,
                updated_at = GETDATE()
            WHERE ticket_id = @ticket_id
        `;
        
        await db.request()
            .input('ticket_id', ticket_id)
            .input('attachments', JSON.stringify(attachments))
            .query(updateQuery);
        
        return true;
    } catch (error) {
        console.error('Error uploading attachment:', error);
        return false;
    }
}

// Get ticket statistics
export const getTicketStatsService = async (): Promise<any> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            -- Total counts
            (SELECT COUNT(*) FROM SupportTickets) as total_tickets,
            (SELECT COUNT(*) FROM SupportTickets WHERE status = 'Open') as open_tickets,
            (SELECT COUNT(*) FROM SupportTickets WHERE status = 'In Progress') as in_progress_tickets,
            (SELECT COUNT(*) FROM SupportTickets WHERE status = 'Resolved') as resolved_tickets,
            (SELECT COUNT(*) FROM SupportTickets WHERE priority = 'urgent') as urgent_tickets,
            
            -- Average response time (in hours)
            (SELECT AVG(DATEDIFF(HOUR, created_at, ISNULL(last_response_at, GETDATE()))) 
             FROM SupportTickets 
             WHERE last_response_at IS NOT NULL) as avg_response_time
    `;
    
    const result = await db.request().query(query);
    const stats = result.recordset[0];
    
    // Get counts by type
    const typeQuery = `
        SELECT type, COUNT(*) as count
        FROM SupportTickets
        GROUP BY type
    `;
    
    const typeResult = await db.request().query(typeQuery);
    const by_type: Record<string, number> = {};
    typeResult.recordset.forEach((row: any) => {
        by_type[row.type] = row.count;
    });
    
    // Get counts by priority
    const priorityQuery = `
        SELECT priority, COUNT(*) as count
        FROM SupportTickets
        GROUP BY priority
    `;
    
    const priorityResult = await db.request().query(priorityQuery);
    const by_priority: Record<string, number> = {};
    priorityResult.recordset.forEach((row: any) => {
        by_priority[row.priority] = row.count;
    });
    
    return {
        total_tickets: stats.total_tickets || 0,
        open_tickets: stats.open_tickets || 0,
        in_progress_tickets: stats.in_progress_tickets || 0,
        resolved_tickets: stats.resolved_tickets || 0,
        urgent_tickets: stats.urgent_tickets || 0,
        avg_response_time: stats.avg_response_time || 0,
        by_type,
        by_priority
    };
}

// Validate if booking belongs to user
export const validateUserBookingService = async (user_id: number, booking_id: number): Promise<boolean> => {
    const db = getDbPool();
    
    const query = `
        SELECT booking_id FROM Bookings 
        WHERE booking_id = @booking_id 
        AND user_id = @user_id
    `;
    
    const result = await db.request()
        .input('booking_id', booking_id)
        .input('user_id', user_id)
        .query(query);
    
    return result.recordset.length > 0;
}

// Get tickets by booking ID
export const getTicketsByBookingIdService = async (booking_id: number): Promise<SupportTicket[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            st.*,
            u.first_name,
            u.last_name,
            u.email,
            CONCAT(u.first_name, ' ', u.last_name) as user_name
        FROM SupportTickets st
        INNER JOIN Users u ON st.user_id = u.user_id
        WHERE st.booking_id = @booking_id 
        ORDER BY st.created_at DESC
    `;
    
    const result = await db.request()
        .input('booking_id', booking_id)
        .query(query);
    
    return result.recordset.map(formatTicketWithAttachments);
}