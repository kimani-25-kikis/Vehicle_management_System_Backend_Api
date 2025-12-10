import bcrypt from "bcryptjs";
import { type Context } from "hono";
import { getUserByEmailService } from "../users/users.service.ts";
import * as authServices from "./auth.service.ts";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
import { EmailService } from "../email/email.service.ts"; 

dotenv.config();

interface CreateUserRequest {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    user_type: string;
    password: string;
}

interface LoginRequest {
    email: string;
    password: string;
}

interface UserPayload {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    user_type: 'admin' | 'customer';
}

export const createUser = async (c: Context) => {
    const body = await c.req.json() as CreateUserRequest;

    try {
        const emailCheck = await getUserByEmailService(body.email);
        if (emailCheck !== null) {
            return c.json({ error: 'Email already exists 😟' }, 400);
        }

        const saltRounds = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(body.password, saltRounds);
        body.password = hashedPassword;

        const result = await authServices.createUserService(body.first_name, body.last_name, body.email, body.phone_number, body.password);
        
        if (result === "User Registered successfully 🎊") {
            //✅ SEND WELCOME EMAIL AFTER SUCCESSFUL REGISTRATION
            EmailService.sendWelcomeEmail({
                customerName: `${body.first_name} ${body.last_name}`,
                customerEmail: body.email
            }).then(emailSuccess => {
                if (emailSuccess) {
                    console.log(`✅ Welcome email sent to: ${body.email}`);
                } else {
                    console.log(`❌ Failed to send welcome email to: ${body.email}`);
                }
            }).catch(emailError => {
                console.error('Email sending error:', emailError);
            });

            return c.json({ message: result }, 201);
        }
        return c.json({ error: result }, 500);
    } catch (error: any) {
        console.error('Error creating user:', error);
        return c.json({ error: error.message }, 500);
    }
}

export const loginUser = async (c: Context) => {
    const body = await c.req.json() as LoginRequest;
    try {
        const existingUser = await getUserByEmailService(body.email);
        if (existingUser === null) {
            return c.json({ error: 'Invalid email or password 😟' }, 400);
        }

        const isPasswordValid = bcrypt.compareSync(body.password, existingUser.password);
        if (!isPasswordValid) {
            return c.json({ error: 'Invalid email or password 😟' }, 400);
        }

        const userType: UserPayload["user_type"] = existingUser.user_type === 'admin' ? 'admin' : 'customer';
        const payload: UserPayload = {
            user_id: existingUser.user_id,
            first_name: existingUser.first_name,
            last_name: existingUser.last_name,
            email: existingUser.email,
            user_type: userType
        };

        const secretKey = process.env.JWT_SECRET as string;
        const token = "Bearer "+jwt.sign(payload, secretKey, { expiresIn: '2h' });

        const userInfo: UserPayload = {
            user_id: existingUser.user_id,
            first_name: existingUser.first_name,
            last_name: existingUser.last_name,
            email: existingUser.email,
            user_type: userType
        };

        return c.json({ message: 'Login successful 🎉', token: token, userInfo: userInfo }, 200);

    } catch (error: any) {
        console.error('Error logging in user:', error);
        return c.json({ error: error.message }, 500);
    }
}