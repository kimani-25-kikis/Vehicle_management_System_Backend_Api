import { Hono } from 'hono';
import * as supportControllers from './support.controller.ts';

const supportRoutes = new Hono();

// Public routes (no authentication)
supportRoutes.post('/tickets', supportControllers.createTicket);
supportRoutes.get('/tickets/my-tickets', supportControllers.getMyTickets);
supportRoutes.get('/tickets/:ticket_id', supportControllers.getTicketById);
supportRoutes.post('/tickets/:ticket_id/reply', supportControllers.addTicketReply);
supportRoutes.post('/tickets/:ticket_id/attachment', supportControllers.uploadAttachment);

// Admin routes (still public in this case, but labeled as admin)
supportRoutes.get('/tickets/admin/all', supportControllers.getAllTickets);
supportRoutes.patch('/tickets/admin/status/:ticket_id', supportControllers.updateTicketStatus);
supportRoutes.patch('/tickets/admin/notes/:ticket_id', supportControllers.addAdminNotes);
supportRoutes.patch('/tickets/admin/assign/:ticket_id', supportControllers.assignTicket);
supportRoutes.get('/tickets/admin/stats', supportControllers.getTicketStats);
supportRoutes.patch('/tickets/admin/priority/:ticket_id', supportControllers.updateTicketPriority);

export default supportRoutes;