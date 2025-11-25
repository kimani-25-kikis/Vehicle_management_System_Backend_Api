import { type Context } from "hono"
import * as vehicleServices from "./vehicle.service.ts";

// Get all vehicles with optional filters
// Get all vehicles with optional filters
// In vehicle.controller.ts - Update getAllVehicles
export const getAllVehicles = async (c: Context) => {
    try {
        const location = c.req.query('location');
        const vehicle_type = c.req.query('vehicle_type');
        const manufacturer = c.req.query('manufacturer');
        const model = c.req.query('model');
        const fuel_type = c.req.query('fuel_type');
        const min_seating = c.req.query('min_seating');
        const max_seating = c.req.query('max_seating');
        const price_range = c.req.query('price_range'); // Get price_range from query
        const transmission = c.req.query('transmission');
        const search = c.req.query('search');

        // Convert price_range to min_price and max_price
        let min_price, max_price;
        if (price_range) {
            switch (price_range) {
                case '0-50':
                    min_price = 0;
                    max_price = 50;
                    break;
                case '50-100':
                    min_price = 50;
                    max_price = 100;
                    break;
                case '100-200':
                    min_price = 100;
                    max_price = 200;
                    break;
                case '200+':
                    min_price = 200;
                    max_price = undefined; // No upper limit
                    break;
                default:
                    min_price = undefined;
                    max_price = undefined;
            }
        }

        const filters = {
            location,
            vehicle_type,
            manufacturer,
            model,
            fuel_type,
            transmission,
            search,
            min_seating: min_seating ? parseInt(min_seating) : undefined,
            max_seating: max_seating ? parseInt(max_seating) : undefined,
            min_price: min_price !== undefined ? min_price : (c.req.query('min_price') ? parseFloat(c.req.query('min_price') as string) : undefined),
            max_price: max_price !== undefined ? max_price : (c.req.query('max_price') ? parseFloat(c.req.query('max_price') as string) : undefined)
        };

        const result = await vehicleServices.getAllVehiclesService(filters);
        
        if (result.length === 0) {
            return c.json({ 
                vehicles: [],
                total: 0,
                page: 1,
                limit: 0,
                message: 'No vehicles found' 
            }, 200);
        }

        return c.json({
            vehicles: result,
            total: result.length,
            page: 1,
            limit: result.length
        });
    } catch (error: any) {
        console.error('Error fetching vehicles:', error.message);
        return c.json({ error: 'Failed to fetch vehicles' }, 500);
    }
}
// Get vehicle by vehicle_id
export const getVehicleById = async (c: Context) => {
    const vehicle_id = parseInt(c.req.param('vehicle_id'))
    try {
        const result = await vehicleServices.getVehicleByIdService(vehicle_id);
        if (result === null) {
            return c.json({ error: 'Vehicle not found' }, 404);
        }
        return c.json(result);
    } catch (error) {
        console.error('Error fetching vehicle:', error);
        return c.json({ error: 'Failed to fetch vehicle' }, 500);
    }
}

// Create new vehicle
export const createVehicle = async (c: Context) => {
    try {
        const customer = c.customer;
        
        // Only admins can create vehicles
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const body = await c.req.json()

        // Validate required fields
        if (!body.rental_rate || !body.current_location) {
            return c.json({ error: 'Rental rate and current location are required' }, 400);
        }

        // If no vehicle_spec_id provided, check if we have specification data
        if (!body.vehicle_spec_id) {
            if (!body.manufacturer || !body.model || !body.year || 
                !body.fuel_type || !body.seating_capacity || !body.vehicle_type) {
                return c.json({ error: 'Vehicle specification data is required when vehicle_spec_id is not provided' }, 400);
            }
        }

        const result = await vehicleServices.createVehicleService(
            body.vehicle_spec_id,
            body.rental_rate,
            body.current_location,
            body.manufacturer,
            body.model,
            body.year,
            body.fuel_type,
            body.engine_capacity,
            body.transmission,
            body.seating_capacity,
            body.color,
            body.features,
            body.vehicle_type,
            body.image_url // ✅ ADDED IMAGE_URL PARAMETER
        );

        if (typeof result === "string") {
            return c.json({ error: result }, 500);
        }

        return c.json({ message: 'Vehicle created successfully 🎊', vehicle: result }, 201);
    } catch (error: any) {
        console.error('Error creating vehicle:', error.message);
        return c.json({ error: error.message }, 500);
    }
}

// Update vehicle by vehicle_id
export const updateVehicle = async (c: Context) => {
    try {
        const vehicle_id = parseInt(c.req.param('vehicle_id'))
        const customer = c.customer;
        
        // Only admins can update vehicles
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const body = await c.req.json()

        // Check if vehicle exists
        const checkExists = await vehicleServices.getVehicleByIdService(vehicle_id);
        if (checkExists === null) {
            return c.json({ error: 'Vehicle not found' }, 404);
        }

        const result = await vehicleServices.updateVehicleService(
            vehicle_id,
            body.rental_rate,
            body.availability,
            body.current_location
        );

        if (result === null) {
            return c.json({ error: 'Failed to update vehicle' }, 404);
        }

        return c.json({ message: 'Vehicle updated successfully', updated_vehicle: result }, 200);

    } catch (error) {
        console.error('Error updating vehicle:', error);
        return c.json({ error: 'Failed to update vehicle' }, 500);
    }
}

// Delete vehicle by vehicle_id
export const deleteVehicle = async (c: Context) => {
    const vehicle_id = parseInt(c.req.param('vehicle_id'))
    try {
        const customer = c.customer;
        
        // Only admins can delete vehicles
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        // Check if vehicle exists
        const check = await vehicleServices.getVehicleByIdService(vehicle_id);
        if (check === null) {
            return c.json({ error: 'Vehicle not found' }, 404);
        }

        // Delete vehicle if exists
        const result = await vehicleServices.deleteVehicleService(vehicle_id);
        if (result === "Failed to delete vehicle") {
            return c.json({ error: 'Failed to delete vehicle' }, 404);
        }

        return c.json({ message: result, deleted_vehicle: check }, 200);
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        return c.json({ error: 'Failed to delete vehicle' }, 500);
    }
}

// Get available locations
export const getAvailableLocations = async (c: Context) => {
    try {
        const result = await vehicleServices.getAvailableLocationsService();
        
        if (result.length === 0) {
            return c.json({ message: 'No locations found' }, 404);
        }
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching locations:', error.message);
        return c.json({ error: 'Failed to fetch locations' }, 500);
    }
}

// Get vehicle specifications
export const getVehicleSpecifications = async (c: Context) => {
    try {
        const result = await vehicleServices.getVehicleSpecificationsService();
        
        if (result.length === 0) {
            return c.json({ message: 'No vehicle specifications found' }, 404);
        }
        return c.json(result);
    } catch (error: any) {
        console.error('Error fetching vehicle specifications:', error.message);
        return c.json({ error: 'Failed to fetch vehicle specifications' }, 500);
    }
}

// Update vehicle availability
export const updateVehicleAvailability = async (c: Context) => {
    try {
        const vehicle_id = parseInt(c.req.param('vehicle_id'))
        const customer = c.customer;
        
        // Only admins can update availability
        if (customer.user_type !== 'admin') {
            return c.json({ error: 'Unauthorized' }, 403);
        }

        const body = await c.req.json()

        // Check if vehicle exists
        const checkExists = await vehicleServices.getVehicleByIdService(vehicle_id);
        if (checkExists === null) {
            return c.json({ error: 'Vehicle not found' }, 404);
        }

        if (typeof body.availability !== 'boolean') {
            return c.json({ error: 'Availability must be a boolean' }, 400);
        }

        const result = await vehicleServices.updateVehicleAvailabilityService(vehicle_id, body.availability);

        if (result === null) {
            return c.json({ error: 'Failed to update vehicle availability' }, 404);
        }

        return c.json({ 
            message: `Vehicle ${body.availability ? 'made available' : 'made unavailable'} successfully`, 
            updated_vehicle: result 
        }, 200);

    } catch (error) {
        console.error('Error updating vehicle availability:', error);
        return c.json({ error: 'Failed to update vehicle availability' }, 500);
    }
}