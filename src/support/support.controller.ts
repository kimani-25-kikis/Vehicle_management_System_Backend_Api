import { type Context } from "hono";
import * as supportServices from "./support.service.ts";
import { EmailService } from '../email/email.service.ts';

// Create a new support ticket


export const createTicket = async (c: Context) => {
    try {
        const body = await c.req.json();
        const user_id = c.customer?.user_id;
        const user_name = c.customer?.first_name + ' ' + c.customer?.last_name;
        const user_email = c.customer?.email;

        console.log("🔵 Creating ticket for user:", user_id, user_email);

        if (!user_id) {
            return c.json({ error: 'User authentication required' }, 401);
        }

        // Validation...
        if (!body.subject || !body.description) {
            return c.json({ error: 'Missing subject or description' }, 400);
        }

        const ticketType = body.type || 'general_inquiry';
        
        // Call service
        const result = await supportServices.createTicketService({
            user_id,
            subject: body.subject,
            description: body.description,
            type: ticketType,
            priority: body.priority || 'medium',
            booking_id: body.booking_id || null
        });

        if (!result) {
            return c.json({ error: 'Failed to create ticket' }, 500);
        }
        
        console.log("✅ Ticket created with ID:", result.ticket_id);

        // 🔥 Send email notification (async - don't await to avoid slowing response)
        if (user_email) {
            EmailService.sendTicketConfirmationEmail({
                customerName: user_name || 'Customer',
                customerEmail: user_email,
                ticketId: result.ticket_id,
                subject: result.subject,
                description: result.description,
                type: result.type,
                priority: result.priority,
                status: result.status,
                bookingId: result.booking_id || undefined,
                createdAt: result.created_at.toISOString()
            }).then(emailSuccess => {
                if (emailSuccess) {
                    console.log(`✅ Email sent to ${user_email} for ticket #${result.ticket_id}`);
                } else {
                    console.log(`⚠️ Failed to send email to ${user_email}`);
                }
            }).catch(emailError => {
                console.error(`❌ Email error:`, emailError);
            });
        } else {
            console.log("⚠️ No email found for user, skipping email notification");
        }

        // Send admin notification for damage reports or urgent tickets
if (result.type === 'damage_report' || result.priority === 'urgent' || result.priority === 'high') {
    EmailService.sendAdminTicketNotification({
        ticketId: result.ticket_id,
        subject: result.subject,
        type: result.type,
        priority: result.priority,
        customerName: user_name || 'Customer',
        customerEmail: user_email || 'No email',
        description: result.description,
        bookingId: result.booking_id || undefined,
        createdAt: result.created_at.toISOString()
    }).then(adminEmailSuccess => {
        console.log(`✅ Admin notification ${adminEmailSuccess ? 'sent' : 'failed'} for ticket #${result.ticket_id}`);
    }).catch(adminEmailError => {
        console.error(`❌ Admin email error:`, adminEmailError);
    });
}

        return c.json({ 
            success: true,
            message: 'Support ticket created successfully!',
            ticket: result 
        }, 201);

    } catch (error: any) {
        console.error('❌ Error in createTicket:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to create support ticket'
        }, 500);
    }
}

// Get user's own tickets
export const getMyTickets = async (c: Context) => {
    try {
        const user_id = c.customer?.user_id;
        
        if (!user_id) {
            return c.json({ error: 'User authentication required' }, 401);
        }

        const result = await supportServices.getUserTicketsService(user_id);
        
        return c.json({ 
            success: true,
            tickets: result 
        });

    } catch (error: any) {
        console.error('Error fetching user tickets:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to fetch tickets' 
        }, 500);
    }
}

// Get ticket by ID
export const getTicketById = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const user_id = c.customer?.user_id;
        
        const result = await supportServices.getTicketByIdService(ticket_id);
        
        if (!result) {
            return c.json({ 
                success: false,
                error: 'Ticket not found' 
            }, 404);
        }

        // Users can only see their own tickets (unless admin)
        if (result.user_id !== user_id && c.customer?.user_type !== 'admin') {
            return c.json({ 
                success: false,
                error: 'Access denied' 
            }, 403);
        }

        return c.json({ 
            success: true,
            ticket: result 
        });

    } catch (error: any) {
        console.error('Error fetching ticket:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to fetch ticket' 
        }, 500);
    }
}

// Admin: Get all tickets
export const getAllTickets = async (c: Context) => {
    try {
        const status = c.req.query('status');
        const type = c.req.query('type');
        const priority = c.req.query('priority');
        const search = c.req.query('search');
        
        const result = await supportServices.getAllTicketsService(
            status || null,
            type || null,
            priority || null,
            search || null
        );
        
        return c.json({ 
            success: true,
            tickets: result 
        });

    } catch (error: any) {
        console.error('Error fetching all tickets:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to fetch tickets' 
        }, 500);
    }
}

// Admin: Update ticket status
export const updateTicketStatus = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const body = await c.req.json();
        
        if (!body.status) {
            return c.json({ 
                success: false,
                error: 'Status is required' 
            }, 400);
        }

        const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed', 'On Hold'];
        if (!validStatuses.includes(body.status)) {
            return c.json({ 
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
            }, 400);
        }

        const result = await supportServices.updateTicketStatusService(ticket_id, body.status);
        
        if (!result) {
            return c.json({ 
                success: false,
                error: 'Ticket not found' 
            }, 404);
        }

        return c.json({ 
            success: true,
            message: 'Ticket status updated successfully',
            ticket: result 
        });

    } catch (error: any) {
        console.error('Error updating ticket status:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to update ticket status' 
        }, 500);
    }
}

// Admin: Add admin notes to ticket
export const addAdminNotes = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const body = await c.req.json();
        
        if (!body.admin_notes) {
            return c.json({ 
                success: false,
                error: 'Admin notes are required' 
            }, 400);
        }

        const result = await supportServices.addAdminNotesService(ticket_id, body.admin_notes);
        
        if (!result) {
            return c.json({ 
                success: false,
                error: 'Ticket not found' 
            }, 404);
        }

        return c.json({ 
            success: true,
            message: 'Admin notes added successfully',
            ticket: result 
        });

    } catch (error: any) {
        console.error('Error adding admin notes:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to add admin notes' 
        }, 500);
    }
}

// Admin: Assign ticket
export const assignTicket = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const body = await c.req.json();
        
        if (!body.assigned_to) {
            return c.json({ 
                success: false,
                error: 'Assignee name is required' 
            }, 400);
        }

        const result = await supportServices.assignTicketService(ticket_id, body.assigned_to);
        
        if (!result) {
            return c.json({ 
                success: false,
                error: 'Ticket not found' 
            }, 404);
        }

        return c.json({ 
            success: true,
            message: 'Ticket assigned successfully',
            ticket: result 
        });

    } catch (error: any) {
        console.error('Error assigning ticket:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to assign ticket' 
        }, 500);
    }
}

// Add reply to ticket
export const addTicketReply = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const user_id = c.customer?.user_id;
        const body = await c.req.json();
        
        if (!user_id) {
            return c.json({ error: 'User authentication required' }, 401);
        }

        if (!body.message) {
            return c.json({ 
                success: false,
                error: 'Message is required' 
            }, 400);
        }

        // Check if user has access to this ticket
        const ticket = await supportServices.getTicketByIdService(ticket_id);
        if (!ticket) {
            return c.json({ 
                success: false,
                error: 'Ticket not found' 
            }, 404);
        }

        // Users can only reply to their own tickets (unless admin)
        if (ticket.user_id !== user_id && c.customer?.user_type !== 'admin') {
            return c.json({ 
                success: false,
                error: 'Access denied' 
            }, 403);
        }

        const is_admin_reply = c.customer?.user_type === 'admin';
        
        const result = await supportServices.addTicketReplyService(
            ticket_id, 
            user_id, 
            body.message, 
            is_admin_reply
        );
        
        if (!result) {
            return c.json({ 
                success: false,
                error: 'Failed to add reply' 
            }, 500);
        }

        return c.json({ 
            success: true,
            message: 'Reply added successfully',
            ticket: result 
        });

    } catch (error: any) {
        console.error('Error adding reply:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to add reply' 
        }, 500);
    }
}

// Upload attachment
export const uploadAttachment = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const user_id = c.customer?.user_id;
        
        if (!user_id) {
            return c.json({ error: 'User authentication required' }, 401);
        }

        const formData = await c.req.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return c.json({ 
                success: false,
                error: 'File is required' 
            }, 400);
        }

        // Check if user has access to this ticket
        const ticket = await supportServices.getTicketByIdService(ticket_id);
        if (!ticket) {
            return c.json({ 
                success: false,
                error: 'Ticket not found' 
            }, 404);
        }

        // Users can only add attachments to their own tickets (unless admin)
        if (ticket.user_id !== user_id && c.customer?.user_type !== 'admin') {
            return c.json({ 
                success: false,
                error: 'Access denied' 
            }, 403);
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return c.json({ 
                success: false,
                error: 'File size exceeds 10MB limit' 
            }, 400);
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
            return c.json({ 
                success: false,
                error: 'File type not allowed. Allowed: JPEG, PNG, GIF, PDF, TXT' 
            }, 400);
        }

        // In a real implementation, you would upload to cloud storage
        // For now, we'll simulate it
        const file_url = `/uploads/tickets/${ticket_id}/${Date.now()}_${file.name}`;
        
        const result = await supportServices.uploadAttachmentService(
            ticket_id,
            file.name,
            file_url,
            file.type,
            file.size,
            user_id
        );

        if (!result) {
            return c.json({ 
                success: false,
                error: 'Failed to upload attachment' 
            }, 500);
        }

        return c.json({ 
            success: true,
            message: 'Attachment uploaded successfully',
            url: file_url,
            filename: file.name,
            file_type: file.type,
            file_size: file.size
        });

    } catch (error: any) {
        console.error('Error uploading attachment:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to upload attachment' 
        }, 500);
    }
}

// Get ticket statistics
export const getTicketStats = async (c: Context) => {
    try {
        const result = await supportServices.getTicketStatsService();
        
        return c.json({ 
            success: true,
            stats: result 
        });

    } catch (error: any) {
        console.error('Error fetching ticket stats:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to fetch ticket statistics' 
        }, 500);
    }
}

// Add this function to your support.controller.ts
export const updateTicketPriority = async (c: Context) => {
    try {
        const ticket_id = parseInt(c.req.param('ticket_id'));
        const body = await c.req.json();
        
        if (!body.priority) {
            return c.json({ 
                success: false,
                error: 'Priority is required' 
            }, 400);
        }

        const validPriorities = ['urgent', 'high', 'medium', 'low'];
        if (!validPriorities.includes(body.priority)) {
            return c.json({ 
                success: false,
                error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` 
            }, 400);
        }

        const result = await supportServices.updateTicketPriorityService(ticket_id, body.priority);
        
        if (!result) {
            return c.json({ 
                success: false,
                error: 'Ticket not found' 
            }, 404);
        }

        return c.json({ 
            success: true,
            message: 'Ticket priority updated successfully',
            ticket: result 
        });

    } catch (error: any) {
        console.error('Error updating ticket priority:', error.message);
        return c.json({ 
            success: false,
            error: 'Failed to update ticket priority' 
        }, 500);
    }
}