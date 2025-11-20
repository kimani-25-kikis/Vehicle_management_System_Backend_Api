import {Hono} from 'hono'
import * as userControllers from './users.controller.ts'
import { adminRoleAuth } from '../middleware/bearAuth.ts'


const userRoutes = new Hono()


userRoutes.get('/users', adminRoleAuth, userControllers.getAllUsers)

userRoutes.get('/users/:user_id', userControllers.getUserById)

userRoutes.put('/users/:user_id', userControllers.updateUser)

userRoutes.delete('/users/:user_id', userControllers.deleteUser)



export default userRoutes