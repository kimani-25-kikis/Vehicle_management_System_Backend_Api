import { getDbPool } from "../db/db.config.ts"

interface UserResponse {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
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
//update user by user_id - FIXED VERSION
export const updateUserService = async (
    user_id: number, 
    first_name: string, 
    last_name: string, 
    email: string, 
    phone_number: string, 
    password: string,
    address?: string  // Add address parameter
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

//delete user by user_id
export const deleteUserService = async (user_id:number): Promise<string> => {
        const db = getDbPool(); // Get existing connection
        const query = 'DELETE FROM Users WHERE user_id = @user_id';
        const result = await db.request()
            .input('user_id', user_id)
            .query(query);
        return result.rowsAffected[0] === 1 ? "User deleted successfully 🎊" : "Failed to delete user";
}
