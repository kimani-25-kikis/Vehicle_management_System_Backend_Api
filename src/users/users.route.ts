import {Hono} from 'hono'
import * as userControllers from './users.controller.ts'
import { adminRoleAuth, customerRoleAuth } from '../middleware/bearAuth.ts'

const userRoutes = new Hono()

userRoutes.put('/users/change-password',customerRoleAuth, userControllers.changePassword) 


userRoutes.post('/users', userControllers.createUser) 

userRoutes.get('/users', userControllers.getAllUsers)
userRoutes.get('/users/:user_id', userControllers.getUserById)
userRoutes.put('/users/:user_id', userControllers.updateUser)

userRoutes.delete('/users/:user_id', userControllers.deleteUser)

userRoutes.get('/test-auth', customerRoleAuth, (c) => {
  return c.json({ 
    message: 'Authenticated',
    user: c.customer 
  });
});

export default userRoutes