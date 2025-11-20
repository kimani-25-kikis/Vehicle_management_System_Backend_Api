import {Hono} from 'hono'
import * as authControllers from './auth.controller.ts'

const authRoutes = new Hono()

// Register new user
authRoutes.post('/auth/register', authControllers.createUser)

// Login user
authRoutes.post('/auth/login', authControllers.loginUser )





export default authRoutes