import {Hono} from 'hono'
import * as ticketControllers from './ticket.controller.ts'
import { bothRolesAuth, adminRoleAuth } from '../middleware/bearAuth.ts'

const ticketRoutes = new Hono()

// Apply auth middleware to all ticket routes
ticketRoutes.use('*', bothRolesAuth)

// User routes
ticketRoutes.post('/tickets', ticketControllers.createTicket)
ticketRoutes.get('/tickets/my-tickets', ticketControllers.getUserTickets)
ticketRoutes.get('/tickets/:ticket_id', ticketControllers.getTicketById)
ticketRoutes.put('/tickets/:ticket_id', ticketControllers.updateTicket)
ticketRoutes.delete('/tickets/:ticket_id', ticketControllers.deleteTicket)

// Admin only routes
ticketRoutes.get('/tickets', adminRoleAuth, ticketControllers.getAllTickets)
ticketRoutes.put('/tickets/:ticket_id/status', adminRoleAuth, ticketControllers.updateTicketStatus)

export default ticketRoutes