import { getDbPool } from "../db/db.config.ts"

interface UserResponse {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    address:string;
    phone_number: string;
    password: string;
    user_type?: string;
    
}

export const getAllUsersService = async (): Promise<UserResponse[] > => {

        const db = getDbPool(); 
        const query = 'SELECT * FROM Users';
        const result = await db.request().query(query);
        return result.recordset;
}

export const getUserByIdService = async (user_id: number): Promise<UserResponse | null> => {
        const db = getDbPool(); // Get existing connection
        const query = 'SELECT * FROM Users WHERE user_id = @user_id';
        const result = await db.request()
            .input('user_id', user_id)
            .query(query);
        return result.recordset[0] || null;
}

export const getUserByEmailService = async (email: string): Promise<UserResponse | null> => {
    const db = getDbPool(); // Get existing connection
    const query = 'SELECT * FROM Users WHERE email = @email';
    const result = await db.request()
        .input('email', email)
        .query(query);
    return result.recordset[0] || null;
}



//update user by user_id
// Update user by user_id - ENHANCED VERSION to include user_type
export const updateUserService = async (
    user_id: number, 
    first_name?: string, 
    last_name?: string, 
    email?: string, 
    phone_number?: string, 
    password?: string,
    address?: string,
    user_type?: string  // ADD THIS PARAMETER
): Promise<UserResponse | null> => {
    const db = getDbPool();
    
    // Build dynamic query for partial updates
    const updates: string[] = [];
    const inputs: any = { user_id };
    
    if (first_name !== undefined) {
        updates.push('first_name = @first_name');
        inputs.first_name = first_name;
    }
    if (last_name !== undefined) {
        updates.push('last_name = @last_name');
        inputs.last_name = last_name;
    }
    if (email !== undefined) {
        updates.push('email = @email');
        inputs.email = email;
    }
    if (phone_number !== undefined) {
        updates.push('phone_number = @phone_number');
        inputs.phone_number = phone_number;
    }
    if (password !== undefined) {
        updates.push('password = @password');
        inputs.password = password;
    }
    if (address !== undefined) {
        updates.push('address = @address');
        inputs.address = address;
    }
    if (user_type !== undefined) {  // ADD THIS CHECK
        updates.push('user_type = @user_type');
        inputs.user_type = user_type;
    }
    
    if (updates.length === 0) {
        throw new Error('No fields to update');
    }
    
    const query = `UPDATE Users SET ${updates.join(', ')}, updated_at = GETDATE() OUTPUT INSERTED.* WHERE user_id = @user_id`;
    
    const request = db.request();
    
    // Add all inputs to the request
    Object.keys(inputs).forEach(key => {
        request.input(key, inputs[key]);
    });
    
    const result = await request.query(query);
    return result.recordset[0] || null;
}
export const createUserService = async (
    first_name: string,
    last_name: string,
    email: string,
    phone_number: string | null,
    password: string,
    user_type: string = 'customer',
    address: string | null = null
): Promise<UserResponse | null> => {
    const db = getDbPool();
    
    const query = `
        INSERT INTO Users 
        (first_name, last_name, email, phone_number, password, user_type, address, created_at, updated_at)
        OUTPUT INSERTED.*
        VALUES (@first_name, @last_name, @email, @phone_number, @password, @user_type, @address, GETDATE(), GETDATE())
    `;
    
    try {
        const result = await db.request()
            .input('first_name', first_name)
            .input('last_name', last_name)
            .input('email', email)
            .input('phone_number', phone_number)
            .input('password', password)
            .input('user_type', user_type)
            .input('address', address)
            .query(query);
            
        return result.recordset[0] || null;
    } catch (error) {
        console.error('Error in createUserService:', error);
        throw error;
    }
}

//delete user by user_id
export const deleteUserService = async (user_id:number): Promise<string> => {
        const db = getDbPool(); // Get existing connection
        const query = 'DELETE FROM Users WHERE user_id = @user_id';
        const result = await db.request()
            .input('user_id', user_id)
            .query(query);
        return result.rowsAffected[0] === 1 ? "User deleted successfully 🎊" : "Failed to delete user";
}

// Add this function to users.service.ts
export const updateUserRoleService = async (
    user_id: number, 
    user_type: string
): Promise<UserResponse | null> => {
    const db = getDbPool();
    
    const query = `
        UPDATE Users 
        SET user_type = @user_type, updated_at = GETDATE() 
        OUTPUT INSERTED.* 
        WHERE user_id = @user_id
    `;
    
    try {
        const result = await db.request()
            .input('user_id', user_id)
            .input('user_type', user_type)
            .query(query);
            
        return result.recordset[0] || null;
    } catch (error) {
        console.error('Error in updateUserRoleService:', error);
        throw error;
    }
}