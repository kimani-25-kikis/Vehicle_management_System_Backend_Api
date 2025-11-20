import { getDbPool } from "../db/db.config.ts"

interface TicketResponse {
    ticket_id: number;
    user_id: number;
    subject: string;
    description: string;
    status: string;
    created_at: string;
    updated_at: string;
}

interface TicketWithDetails extends TicketResponse {
    user_name: string;
    user_email: string;
}

// Create new support ticket
export const createTicketService = async (
    user_id: number,
    subject: string,
    description: string
): Promise<TicketResponse | string> => {
    const db = getDbPool();
    
    try {
        const query = `
            INSERT INTO SupportTickets (user_id, subject, description)
            OUTPUT INSERTED.*
            VALUES (@user_id, @subject, @description)
        `;
        
        const result = await db.request()
            .input('user_id', user_id)
            .input('subject', subject)
            .input('description', description)
            .query(query);

        return result.recordset[0];
    } catch (error: any) {
        console.error('Error in createTicketService:', error);
        return "Failed to create support ticket";
    }
}

// Get user's tickets
export const getUserTicketsService = async (user_id: number): Promise<TicketWithDetails[]> => {
    const db = getDbPool();
    const query = `
        SELECT 
            t.*,
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email
        FROM SupportTickets t
        JOIN Users u ON t.user_id = u.user_id
        WHERE t.user_id = @user_id
        ORDER BY t.created_at DESC
    `;
    const result = await db.request()
        .input('user_id', user_id)
        .query(query);
    return result.recordset;
}

// Get all tickets (admin only)
export const getAllTicketsService = async (): Promise<TicketWithDetails[]> => {
    const db = getDbPool();
    const query = `
        SELECT 
            t.*,
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email
        FROM SupportTickets t
        JOIN Users u ON t.user_id = u.user_id
        ORDER BY t.created_at DESC
    `;
    const result = await db.request().query(query);
    return result.recordset;
}

// Get ticket by ID
export const getTicketByIdService = async (ticket_id: number): Promise<TicketWithDetails | null> => {
    const db = getDbPool();
    const query = `
        SELECT 
            t.*,
            u.first_name + ' ' + u.last_name as user_name,
            u.email as user_email
        FROM SupportTickets t
        JOIN Users u ON t.user_id = u.user_id
        WHERE t.ticket_id = @ticket_id
    `;
    const result = await db.request()
        .input('ticket_id', ticket_id)
        .query(query);
    return result.recordset[0] || null;
}

// Update ticket status
export const updateTicketStatusService = async (
    ticket_id: number,
    status: string
): Promise<TicketResponse | null> => {
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

// Update ticket
export const updateTicketService = async (
    ticket_id: number,
    subject?: string,
    description?: string,
    status?: string
): Promise<TicketResponse | null> => {
    const db = getDbPool();
    
    let query = 'UPDATE SupportTickets SET ';
    const updates: string[] = [];
    const request = db.request();

    request.input('ticket_id', ticket_id);

    if (subject !== undefined) {
        updates.push('subject = @subject');
        request.input('subject', subject);
    }

    if (description !== undefined) {
        updates.push('description = @description');
        request.input('description', description);
    }

    if (status !== undefined) {
        updates.push('status = @status');
        request.input('status', status);
    }

    if (updates.length === 0) {
        return null;
    }

    query += updates.join(', ') + ', updated_at = GETDATE() OUTPUT INSERTED.* WHERE ticket_id = @ticket_id';

    const result = await request.query(query);
    return result.recordset[0] || null;
}

// Delete ticket
export const deleteTicketService = async (ticket_id: number): Promise<string> => {
    const db = getDbPool();
    const query = 'DELETE FROM SupportTickets WHERE ticket_id = @ticket_id';
    const result = await db.request()
        .input('ticket_id', ticket_id)
        .query(query);
    return result.rowsAffected[0] === 1 ? "Support ticket deleted successfully 🎊" : "Failed to delete support ticket";
}