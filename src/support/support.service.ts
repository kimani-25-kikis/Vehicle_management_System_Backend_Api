import { getDbPool } from "../db/db.config.ts";

export interface SupportTicket {
    ticket_id: number;
    user_id: number;
    subject: string;
    description: string;
    type: 'damage_report' | 'general_inquiry' | 'technical_issue';
    status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
    booking_id?: number;
    admin_notes?: string;
    created_at: Date;
    updated_at: Date;
    first_name?: string;
    last_name?: string;
    email?: string;
}

export interface CreateTicketData {
    user_id: number;
    subject: string;
    description: string;
    type: 'damage_report' | 'general_inquiry' | 'technical_issue';
    booking_id?: number | null;
}

// Create a new support ticket
export const createTicketService = async (data: CreateTicketData): Promise<SupportTicket | null> => {
    const db = getDbPool();
    
    const query = `
        INSERT INTO SupportTickets (user_id, subject, description, type, booking_id, status)
        OUTPUT INSERTED.*
        VALUES (@user_id, @subject, @description, @type, @booking_id, 'Open')
    `;
    
    const request = db.request()
        .input('user_id', data.user_id)
        .input('subject', data.subject)
        .input('description', data.description)
        .input('type', data.type);
    
    if (data.booking_id) {
        request.input('booking_id', data.booking_id);
    } else {
        request.input('booking_id', null);
    }
    
    const result = await request.query(query);
    return result.recordset[0] || null;
}

// Get user's own tickets
export const getUserTicketsService = async (user_id: number): Promise<SupportTicket[]> => {
    const db = getDbPool();
    
    const query = `
        SELECT * FROM SupportTickets 
        WHERE user_id = @user_id 
        ORDER BY created_at DESC
    `;
    
    const result = await db.request()
        .input('user_id', user_id)
        .query(query);
    
    return result.recordset;
}

// Get ticket by ID
export const getTicketByIdService = async (ticket_id: number): Promise<SupportTicket | null> => {
    const db = getDbPool();
    
    const query = `
        SELECT 
            st.*,
            u.first_name,
            u.last_name,
            u.email
        FROM SupportTickets st
        INNER JOIN Users u ON st.user_id = u.user_id
        WHERE st.ticket_id = @ticket_id
    `;
    
    const result = await db.request()
        .input('ticket_id', ticket_id)
        .query(query);
    
    return result.recordset[0] || null;
}

// Get all tickets (for admin)
export const getAllTicketsService = async (status?: string | null, type?: string | null): Promise<SupportTicket[]> => {
    const db = getDbPool();
    
    let query = `
        SELECT 
            st.*,
            u.first_name,
            u.last_name,
            u.email
        FROM SupportTickets st
        INNER JOIN Users u ON st.user_id = u.user_id
    `;
    
    const conditions: string[] = [];
    const request = db.request();
    
    if (status) {
        conditions.push('st.status = @status');
        request.input('status', status);
    }
    
    if (type) {
        conditions.push('st.type = @type');
        request.input('type', type);
    }
    
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ' ORDER BY st.created_at DESC';
    
    const result = await request.query(query);
    return result.recordset;
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
    
    return result.recordset[0] || null;
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
    
    return result.recordset[0] || null;
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
        SELECT * FROM SupportTickets 
        WHERE booking_id = @booking_id 
        ORDER BY created_at DESC
    `;
    
    const result = await db.request()
        .input('booking_id', booking_id)
        .query(query);
    
    return result.recordset;
}