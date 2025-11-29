import { type Context } from "hono";
import * as supportServices from "./support.service.ts";

// Create a new support ticket
export const createTicket = async (c: Context) => {
    try {
        const body = await c.req.json();
        const user_id = c.customer.user_id;

        console.log("🔵 CONTROLLER - Raw request body:", body);
        console.log("🔵 CONTROLLER - Type field:", body.type);
        console.log("🔵 CONTROLLER - All body fields:", Object.keys(body));

        // Validation
        if (!body.subject || !body.description || !body.type) {
            return c.json({ error: 'Missing required fields: subject, description, type' }, 400);
        }

        // Validate ticket type
        const validTypes = ['damage_report', 'general_inquiry', 'technical_issue'];
        if (!validTypes.includes(body.type)) {
            return c.json({ error: 'Invalid ticket type. Must be: damage_report, general_inquiry, or technical_issue' }, 400);
        }

        // For damage reports, booking_id is required
        if (body.type === 'damage_report' && !body.booking_id) {
            return c.json({ error: 'Booking ID is required for damage reports' }, 400);
        }

        // For damage reports, validate that booking belongs to user
        if (body.type === 'damage_report' && body.booking_id) {
            const isValidBooking = await supportServices.validateUserBookingService(user_id, body.booking_id);
            if (!isValidBooking) {
                return c.json({ error: 'Invalid booking or booking does not belong to you' }, 400);
            }
        }

        console.log("✅ CONTROLLER - Validation passed, calling service...");

        const result = await supportServices.createTicketService({
            user_id,
            subject: body.subject,
            description: body.description,
            type: body.type,
            booking_id: body.booking_id || null
        });

        console.log("✅ CONTROLLER - Service returned:", result);
        
        return c.json({ 
            message: 'Support ticket created successfully!',
            ticket: result 
        }, 201);

    } catch (error: any) {
        console.error('Error creating support ticket:', error.message);
        return c.json({ error: 'Failed to create support ticket' }, 500);
    }
}

// Get user's own tickets
export const getMyTickets = async (c: Context) => {
    try {
        const user_id = c.customer.user_id;
        const result = await supportServices.getUserTicketsService(user_id);
        
        return c.json({ tickets: result });

    } catch (error: any) {
        console.error('Error fetching user tickets:', error.message);
        return c.json({ error: 'Failed to fetch tickets' }, 500);
    }
}

// Get ticket by ID
export const getTicketById = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const user_id = c.customer.user_id;
        
        const result = await supportServices.getTicketByIdService(ticket_id);
        
        if (!result) {
            return c.json({ error: 'Ticket not found' }, 404);
        }

        // Users can only see their own tickets (unless admin)
        if (result.user_id !== user_id && c.customer.user_type !== 'admin') {
            return c.json({ error: 'Access denied' }, 403);
        }

        return c.json({ ticket: result });

    } catch (error: any) {
        console.error('Error fetching ticket:', error.message);
        return c.json({ error: 'Failed to fetch ticket' }, 500);
    }
}

// Admin: Get all tickets
export const getAllTickets = async (c: Context) => {
    try {
        const { status, type } = c.req.query();
        
        const result = await supportServices.getAllTicketsService(
            status || null,
            type || null
        );
        
        return c.json({ tickets: result });

    } catch (error: any) {
        console.error('Error fetching all tickets:', error.message);
        return c.json({ error: 'Failed to fetch tickets' }, 500);
    }
}

// Admin: Update ticket status
export const updateTicketStatus = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const body = await c.req.json();
        
        if (!body.status) {
            return c.json({ error: 'Status is required' }, 400);
        }

        const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
        if (!validStatuses.includes(body.status)) {
            return c.json({ error: 'Invalid status. Must be: Open, In Progress, Resolved, or Closed' }, 400);
        }

        const result = await supportServices.updateTicketStatusService(ticket_id, body.status);
        
        if (!result) {
            return c.json({ error: 'Ticket not found' }, 404);
        }

        return c.json({ 
            message: 'Ticket status updated successfully',
            ticket: result 
        });

    } catch (error: any) {
        console.error('Error updating ticket status:', error.message);
        return c.json({ error: 'Failed to update ticket status' }, 500);
    }
}

// Admin: Add admin notes to ticket
export const addAdminNotes = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const body = await c.req.json();
        
        if (!body.admin_notes) {
            return c.json({ error: 'Admin notes are required' }, 400);
        }

        const result = await supportServices.addAdminNotesService(ticket_id, body.admin_notes);
        
        if (!result) {
            return c.json({ error: 'Ticket not found' }, 404);
        }

        return c.json({ 
            message: 'Admin notes added successfully',
            ticket: result 
        });

    } catch (error: any) {
        console.error('Error adding admin notes:', error.message);
        return c.json({ error: 'Failed to add admin notes' }, 500);
    }
}