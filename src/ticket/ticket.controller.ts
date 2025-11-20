import { type Context } from "hono"
import * as ticketServices from "./ticket.service.ts";

// Create new support ticket
export const createTicket = async (c: Context) => {
    try {
        const customer = c.customer;
        const body = await c.req.json()

        // Validate required fields
        if (!body.subject || !body.description) {
            return c.json({ error: 'Subject and description are required' }, 400);
        }

        const result = await ticketServices.createTicketService(
            customer.user_id,
            body.subject,
            body.description
        );

        if (typeof result === "string") {
            return c.json({ error: result }, 500);
        }

        return c.json({ message: 'Support ticket created successfully 🎊', ticket: result }, 201);
    } catch (error: any) {
        console.error('Error creating support ticket:', error.message);
        return c.json({ error: error.message }, 500);
    }
}

// Get user's tickets
export const getUserTickets = async (c: Context) => {
    try {
        const customer = c.customer;
        const result = await ticketServices.getUserTicketsService(customer.user_id);
        
        if (result.length === 0) {
            return c.json({ message: 'No support tickets found' }, 404);
        }
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching user tickets:', error.message);
        return c.json({ error: 'Failed to fetch support tickets' }, 500);
    }
}

// Get all tickets (admin only)
export const getAllTickets = async (c: Context) => {
    try {
        const customer = c.customer;
        
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await ticketServices.getAllTicketsService();
        
        if (result.length === 0) {
            return c.json({ message: 'No support tickets found' }, 404);
        }
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching all tickets:', error.message);
        return c.json({ error: 'Failed to fetch support tickets' }, 500);
    }
}

// Get ticket by ID
export const getTicketById = async (c: Context) => {
    const ticket_id = parseInt(c.req.param('ticket_id'))
    try {
        const customer = c.customer;
        
        const result = await ticketServices.getTicketByIdService(ticket_id);
        if (result === null) {
            return c.json({ error: 'Support ticket not found' }, 404);
        }

        // Users can only see their own tickets, admins can see all
        if (customer.user_type !== 'admin' && result.user_id !== customer.user_id) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        return c.json(result);
    } catch (error) {
        console.error('Error fetching ticket:', error);
        return c.json({ error: 'Failed to fetch support ticket' }, 500);
    }
}

// Update ticket status (admin only)
export const updateTicketStatus = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'))
        const customer = c.customer;
        const body = await c.req.json()

        // Only admins can update ticket status
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
        if (!body.status || !validStatuses.includes(body.status)) {
            return c.json({ error: 'Valid status is required' }, 400);
        }

        const result = await ticketServices.updateTicketStatusService(ticket_id, body.status);
        
        if (result === null) {
            return c.json({ error: 'Ticket not found or status update failed' }, 404);
        }

        return c.json({ message: 'Ticket status updated successfully', updated_ticket: result }, 200);

    } catch (error) {
        console.error('Error updating ticket status:', error);
        return c.json({ error: 'Failed to update ticket status' }, 500);
    }
}

// Update ticket (user can update their own tickets)
export const updateTicket = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'))
        const customer = c.customer;
        const body = await c.req.json()

        // Check if ticket exists
        const existingTicket = await ticketServices.getTicketByIdService(ticket_id);
        if (existingTicket === null) {
            return c.json({ error: 'Support ticket not found' }, 404);
        }

        // Users can only update their own tickets, admins can update any
        if (customer.user_type !== 'admin' && existingTicket.user_id !== customer.user_id) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        // Users can only update subject and description, admins can update status too
        let result;
        if (customer.user_type === 'admin' && body.status) {
            result = await ticketServices.updateTicketService(ticket_id, body.subject, body.description, body.status);
        } else {
            result = await ticketServices.updateTicketService(ticket_id, body.subject, body.description);
        }

        if (result === null) {
            return c.json({ error: 'Failed to update support ticket' }, 404);
        }

        return c.json({ message: 'Support ticket updated successfully', updated_ticket: result }, 200);

    } catch (error) {
        console.error('Error updating ticket:', error);
        return c.json({ error: 'Failed to update support ticket' }, 500);
    }
}

// Delete ticket
export const deleteTicket = async (c: Context) => {
    const ticket_id = parseInt(c.req.param('ticket_id'))
    try {
        const customer = c.customer;
        
        const ticket = await ticketServices.getTicketByIdService(ticket_id);
        if (ticket === null) {
            return c.json({ error: 'Support ticket not found' }, 404);
        }

        // Users can only delete their own tickets, admins can delete any
        if (customer.user_type !== 'admin' && ticket.user_id !== customer.user_id) {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const result = await ticketServices.deleteTicketService(ticket_id);
        
        if (result === "Failed to delete support ticket") {
            return c.json({ error: result }, 404);
        }

        return c.json({ message: result, deleted_ticket: ticket }, 200);
    } catch (error) {
        console.error('Error deleting ticket:', error);
        return c.json({ error: 'Failed to delete support ticket' }, 500);
    }
}