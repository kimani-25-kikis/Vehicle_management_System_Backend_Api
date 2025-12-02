import {Hono} from 'hono'
import * as userControllers from './users.controller.ts'
import { adminRoleAuth } from '../middleware/bearAuth.ts'

const userRoutes = new Hono()

// ADD THIS LINE - Create new user (POST)
userRoutes.post('/users', userControllers.createUser) // ✅ NEW

userRoutes.get('/users', userControllers.getAllUsers)
userRoutes.get('/users/:user_id', userControllers.getUserById)
userRoutes.put('/users/:user_id', userControllers.updateUser)
userRoutes.delete('/users/:user_id', userControllers.deleteUser)

export default userRoutes