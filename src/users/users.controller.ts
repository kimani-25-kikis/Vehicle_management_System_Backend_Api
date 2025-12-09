import { type Context } from "hono"
import * as userServices from "./users.service.ts";
import bcrypt from "bcryptjs";
import { getDbPool } from "../db/db.config.ts";
//get all users
export const getAllUsers = async (c: Context) => {
    try {
        const result = await userServices.getAllUsersService();
        // console.log("🚀 ~ getAllUsers ~ result:", result)
        if (result.length === 0) {
            return c.json({ message: 'No users found' }, 404);
        }
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching users:', error.message);
        return c.json({ error: 'Failed to fetch users' }, 500);
    }
}

// ADD THIS FUNCTION - Create new user
export const createUser = async (c: Context) => {
    try {
        const body = await c.req.json();

        // Validate required fields
        if (!body.first_name || !body.last_name || !body.email) {
            return c.json({ error: 'First name, last name, and email are required' }, 400);
        }

        // Check if user already exists by email
        const existingUser = await userServices.getUserByEmailService(body.email);
        if (existingUser) {
            return c.json({ error: 'User with this email already exists' }, 409);
        }

        // Generate a default password if not provided
        let password = body.password;
        if (!password || password.trim() === '') {
            // Generate a random password or use a default one
            // You might want to send this to the user via email
            password = 'DefaultPassword123!';
        }

        // Hash the password
        const saltRounds = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, saltRounds);

        // Create the user
        const result = await userServices.createUserService(
            body.first_name,
            body.last_name,
            body.email,
            body.phone_number || null,
            hashedPassword,
            body.user_type || 'user', // Default to 'user' if not specified
            body.address || null
        );

        if (result === null) {
            return c.json({ error: 'Failed to create user' }, 500);
        }

        // Don't return the password in the response
        const { password: _, ...userWithoutPassword } = result;

        return c.json({ 
            message: 'User created successfully', 
            user: userWithoutPassword 
        }, 201);

    } catch (error) {
        console.error('Error creating user:', error);
        return c.json({ error: 'Failed to create user' }, 500);
    }
}

//get user by user_id
export const getUserById = async (c: Context) => {
    const user_id = parseInt(c.req.param('user_id'))
    try {
        const result = await userServices.getUserByIdService(user_id);
        if (result === null) {
            return c.json({ error: 'User not found' }, 404);
        }
        return c.json(result);
    } catch (error) {
        console.error('Error fetching user:', error);
        return c.json({ error: 'Failed to fetch user' }, 500);
    }
}




//update user by user_id
//update user by user_id - FIXED VERSION
// Update user by user_id - ENHANCED VERSION
export const updateUser = async (c: Context) => {
    try {
        const user_id = parseInt(c.req.param('user_id'))
        const body = await c.req.json()

        // Check if user exists
        const checkExists = await userServices.getUserByIdService(user_id);
        if (checkExists === null) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Check if email already exists (excluding current user)
        if (body.email && body.email !== checkExists.email) {
            const existingUser = await userServices.getUserByEmailService(body.email);
            if (existingUser && existingUser.user_id !== user_id) {
                return c.json({ error: 'Email already exists' }, 400);
            }
        }

        // Validate user_type if provided
        if (body.user_type && !['customer', 'admin'].includes(body.user_type)) {
            return c.json({ error: 'user_type must be either "customer" or "admin"' }, 400);
        }

        // Only hash password if it's provided and different from current
        let hashedPassword = checkExists.password; // Keep current password by default
        
        if (body.password && body.password.trim() !== '') {
            const saltRounds = bcrypt.genSaltSync(10);
            hashedPassword = bcrypt.hashSync(body.password, saltRounds);
        }

        // Call service with ALL fields including user_type
        const result = await userServices.updateUserService(
            user_id, 
            body.first_name, 
            body.last_name, 
            body.email, 
            body.phone_number, 
            hashedPassword,
            body.address,
            body.user_type  // Pass user_type to service
        );
        
        if (result === null) {
            return c.json({ error: 'Failed to update user' }, 500);
        }

        return c.json({ 
            message: 'User updated successfully', 
            updated_user: result 
        }, 200);

    } catch (error) {
        console.error('Error updating user:', error);
        return c.json({ error: 'Failed to update user' }, 500);
    }
}

//delete user by user_id
export const deleteUser = async (c: Context) => {
    const user_id = parseInt(c.req.param('user_id'))
    try {
        //check if user exists
        const check = await userServices.getUserByIdService(user_id);
        if (check === null) {
            return c.json({ error: 'User not found' }, 404);
        }

        //delete user if exists
        const result = await userServices.deleteUserService(user_id);
        if (result === null) {
            return c.json({ error: 'Failed to delete user' }, 404);
        }

        return c.json({ message: 'User deleted successfully', deleted_user: result }, 200);
    } catch (error) {
        console.error('Error deleting user:', error);
        return c.json({ error: 'Failed to delete user' }, 500);
    }
}

// Add this function to user.controller.ts

export const changePassword = async (c: Context) => {
  try {
    console.log('🔑 changePassword called');
    
    const body = await c.req.json();
    console.log('📦 Request body:', body);

    const { current_password, new_password } = body;

    // Validate required fields
    if (!current_password || !new_password) {
      return c.json({ error: 'Current password and new password are required' }, 400);
    }

    // Validate new password length
    if (new_password.length < 6) {
      return c.json({ error: 'New password must be at least 6 characters long' }, 400);
    }

    // Get authenticated user from middleware
    const customer = c.customer;
    if (!customer) {
      console.log('❌ No customer in context');
      return c.json({ error: 'Authentication required' }, 401);
    }

    const db = getDbPool();
    const user_id = customer.user_id;

    // Get user with current password
    const userQuery = `
      SELECT user_id, password, email, first_name 
      FROM Users 
      WHERE user_id = @user_id
    `;
    
    const userResult = await db.request()
      .input('user_id', user_id)
      .query(userQuery);

    if (userResult.recordset.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    const user = userResult.recordset[0];
    
    // 1. Verify current password matches
    const isPasswordValid = await bcrypt.compare(current_password, user.password);
    
    if (!isPasswordValid) {
      return c.json({ 
        error: 'Current password is incorrect' 
      }, 400);
    }

    // 2. Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(new_password, user.password);
    if (isSamePassword) {
      return c.json({ 
        error: 'New password must be different from current password' 
      }, 400);
    }

    // 3. Hash the new password
    const saltRounds = bcrypt.genSaltSync(10);
    const hashedNewPassword = bcrypt.hashSync(new_password, saltRounds);

    // 4. Update password in database
    const updateQuery = `
      UPDATE Users 
      SET password = @new_password, updated_at = GETDATE()
      WHERE user_id = @user_id
    `;
    
    const updateResult = await db.request()
      .input('new_password', hashedNewPassword)
      .input('user_id', user_id)
      .query(updateQuery);

    console.log('✅ Password updated successfully for user:', user_id);

    return c.json({ 
      success: true,
      message: 'Password updated successfully' 
    }, 200);

  } catch (error: any) {
    console.error('❌ Error in changePassword:', error);
    return c.json({ 
      error: 'Failed to change password',
      details: error.message 
    }, 500);
  }
}

// Add this function to users.controller.ts
export const updateUserRole = async (c: Context) => {
    try {
        const user_id = parseInt(c.req.param('user_id'))
        const body = await c.req.json()

        // Validate required field
        if (!body.user_type) {
            return c.json({ error: 'user_type is required' }, 400);
        }

        // Validate user_type value
        if (!['customer', 'admin'].includes(body.user_type)) {
            return c.json({ error: 'user_type must be either "customer" or "admin"' }, 400);
        }

        // Check if user exists
        const checkExists = await userServices.getUserByIdService(user_id);
        if (checkExists === null) {
            return c.json({ error: 'User not found' }, 404);
        }

        // Update only the user_type
        const result = await userServices.updateUserRoleService(user_id, body.user_type);
        
        if (result === null) {
            return c.json({ error: 'Failed to update user role' }, 500);
        }

        return c.json({ 
            message: 'User role updated successfully', 
            updated_user: result 
        }, 200);

    } catch (error) {
        console.error('Error updating user role:', error);
        return c.json({ error: 'Failed to update user role' }, 500);
    }
}