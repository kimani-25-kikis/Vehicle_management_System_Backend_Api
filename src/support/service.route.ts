import { Hono } from 'hono';
import * as supportControllers from './support.controller.ts';
import { customerRoleAuth, adminRoleAuth } from '../middleware/bearAuth.ts';

const supportRoutes = new Hono();

// Customer routes
supportRoutes.post('/tickets', customerRoleAuth, supportControllers.createTicket);
supportRoutes.get('/tickets/my-tickets', customerRoleAuth, supportControllers.getMyTickets);
supportRoutes.get('/tickets/:ticket_id', customerRoleAuth, supportControllers.getTicketById);

// Admin routes
supportRoutes.get('/tickets/admin/all', adminRoleAuth, supportControllers.getAllTickets);
supportRoutes.patch('/tickets/admin/status/:ticket_id', adminRoleAuth, supportControllers.updateTicketStatus);
supportRoutes.patch('/tickets/admin/notes/:ticket_id', adminRoleAuth, supportControllers.addAdminNotes);

export default supportRoutes;