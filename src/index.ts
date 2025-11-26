import { serve } from '@hono/node-server'
import { Hono } from 'hono' 
import type { Context } from 'hono'
import { limiter } from './middleware/rateLimiters.ts'
import { cors } from 'hono/cors'
import userRoutes from './users/users.route.ts'
import initDatabaseConnection from './db/db.config.ts'
import { logger } from 'hono/logger'
import { prometheus } from '@hono/prometheus'
import authRoutes from './auth/auth.route.ts'
import vehicleRoutes from './vehicle/vehicle.route.ts'
import bookingRoutes from './booking/booking.route.ts'
import ticketRoutes from './ticket/ticket.route.ts'
import paymentRoutes from './payment/payment.route.ts'
import uploadRoutes from './uploads/uploads.routes.ts'

const app = new Hono()

// ✅ Enable CORS for frontend
app.use(
  '*',
  cors({
    origin: 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)

// Prometheus middleware
const { printMetrics, registerMetrics } = prometheus()
app.use('*', registerMetrics)
app.get('/metrics', printMetrics)

// Apply logger middleware
app.use('*', logger())

// Apply rate limiter middleware
app.use(limiter)

// Root endpoint
app.get('/', (c: Context) => { // ✅ Added Context type
  return c.json({
    message: 'Luxury Motors',
  })
})

// API routes
app.get('/api', (c: Context) => {
  return c.json(
    {
      message: 'Welcome to our Luxury Motors',
    },
    200
  )
})

// ✅ Mount API routes
app.route('/api', userRoutes)
app.route('/api', authRoutes)
app.route('/api', vehicleRoutes)
app.route('/api', bookingRoutes)
app.route('/api', paymentRoutes)
app.route('/api', ticketRoutes)
app.route('/api', uploadRoutes)

// 404 handler
app.notFound((c: Context) => {
  return c.json(
    {
      success: false,
      message: 'Route not found',
      path: c.req.path,
    },
    404
  )
})

// Start server after DB connection
const port = Number(process.env.PORT) || 3000

initDatabaseConnection()
  .then(() => {
    serve(
      {
        fetch: app.fetch,
        port,
      },
      (info) => {
        console.log(`🚀 Server is running on http://localhost:${info.port}`)
      }
    )
  })
  .catch((error) => {
    console.error('Failed to initialize database connection:', error)
  })