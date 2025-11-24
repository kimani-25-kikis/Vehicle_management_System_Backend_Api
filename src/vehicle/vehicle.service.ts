import { getDbPool } from "../db/db.config.ts"

interface VehicleResponse {
    vehicle_id: number;
    vehicle_spec_id: number;
    rental_rate: number;
    availability: boolean;
    current_location: string;
    created_at: string;
    updated_at: string;
}

interface VehicleSpecification {
    vehicle_spec_id: number;
    manufacturer: string;
    model: string;
    year: number;
    fuel_type: string;
    engine_capacity: number | null;
    transmission: string;
    seating_capacity: number;
    color: string;
    features: string | null;
    vehicle_type: string;
    created_at: string;
    updated_at: string;
}

interface VehicleWithSpecification {
    vehicle_id: number;
    rental_rate: number;
    availability: boolean;
    current_location: string;
    created_at: string;
    updated_at: string;
    specification: VehicleSpecification;
}

interface VehicleFilters {
    location?: string;
    vehicle_type?: string;
    manufacturer?: string;
    model?: string;
    fuel_type?: string;
    min_seating?: number;
    max_seating?: number;
    min_price?: number;
    max_price?: number;
}

// Get all vehicles with optional filters
export const getAllVehiclesService = async (filters?: VehicleFilters): Promise<VehicleWithSpecification[]> => {
    const db = getDbPool();
    
    let query = `
        SELECT 
            v.vehicle_id,
            v.vehicle_spec_id,
            v.rental_rate,
            v.availability,
            v.current_location,
            v.created_at,
            v.updated_at,
            vs.manufacturer,
            vs.model,
            vs.year,
            vs.fuel_type,
            vs.engine_capacity,
            vs.transmission,
            vs.seating_capacity,
            vs.color,
            vs.features,
            vs.vehicle_type,
            vs.created_at as spec_created_at,
            vs.updated_at as spec_updated_at
        FROM Vehicles v
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE 1=1
    `;
    
    const request = db.request();

    if (filters?.location) {
        query += ' AND v.current_location LIKE @location';
        request.input('location', `%${filters.location}%`);
    }
    
    if (filters?.vehicle_type) {
        query += ' AND vs.vehicle_type = @vehicle_type';
        request.input('vehicle_type', filters.vehicle_type);
    }
    
    if (filters?.manufacturer) {
        query += ' AND vs.manufacturer LIKE @manufacturer';
        request.input('manufacturer', `%${filters.manufacturer}%`);
    }
    
    if (filters?.model) {
        query += ' AND vs.model LIKE @model';
        request.input('model', `%${filters.model}%`);
    }
    
    if (filters?.fuel_type) {
        query += ' AND vs.fuel_type = @fuel_type';
        request.input('fuel_type', filters.fuel_type);
    }
    
    if (filters?.min_seating) {
        query += ' AND vs.seating_capacity >= @min_seating';
        request.input('min_seating', filters.min_seating);
    }
    
    if (filters?.max_seating) {
        query += ' AND vs.seating_capacity <= @max_seating';
        request.input('max_seating', filters.max_seating);
    }
    
    if (filters?.min_price) {
        query += ' AND v.rental_rate >= @min_price';
        request.input('min_price', filters.min_price);
    }
    
    if (filters?.max_price) {
        query += ' AND v.rental_rate <= @max_price';
        request.input('max_price', filters.max_price);
    }

    query += ' ORDER BY v.created_at DESC';

    const result = await request.query(query);
    
    // Structure the data with nested specification
    const vehiclesWithSpecs: VehicleWithSpecification[] = result.recordset.map(vehicle => ({
        vehicle_id: vehicle.vehicle_id,
        rental_rate: vehicle.rental_rate,
        availability: vehicle.availability,
        current_location: vehicle.current_location,
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at,
        specification: {
            vehicle_spec_id: vehicle.vehicle_spec_id,
            manufacturer: vehicle.manufacturer,
            model: vehicle.model,
            year: vehicle.year,
            fuel_type: vehicle.fuel_type,
            engine_capacity: vehicle.engine_capacity,
            transmission: vehicle.transmission,
            seating_capacity: vehicle.seating_capacity,
            color: vehicle.color,
            features: vehicle.features,
            vehicle_type: vehicle.vehicle_type,
            created_at: vehicle.spec_created_at,
            updated_at: vehicle.spec_updated_at
        }
    }));
    
    return vehiclesWithSpecs;
}

// Get vehicle by vehicle_id
export const getVehicleByIdService = async (vehicle_id: number): Promise<VehicleWithSpecification | null> => {
    const db = getDbPool();
    const query = `
        SELECT 
            v.vehicle_id,
            v.vehicle_spec_id,
            v.rental_rate,
            v.availability,
            v.current_location,
            v.created_at,
            v.updated_at,
            vs.manufacturer,
            vs.model,
            vs.year,
            vs.fuel_type,
            vs.engine_capacity,
            vs.transmission,
            vs.seating_capacity,
            vs.color,
            vs.features,
            vs.vehicle_type,
            vs.created_at as spec_created_at,
            vs.updated_at as spec_updated_at
        FROM Vehicles v
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE v.vehicle_id = @vehicle_id
    `;
    const result = await db.request()
        .input('vehicle_id', vehicle_id)
        .query(query);
    
    if (!result.recordset[0]) {
        return null;
    }

    const vehicle = result.recordset[0];
    return {
        vehicle_id: vehicle.vehicle_id,
        rental_rate: vehicle.rental_rate,
        availability: vehicle.availability,
        current_location: vehicle.current_location,
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at,
        specification: {
            vehicle_spec_id: vehicle.vehicle_spec_id,
            manufacturer: vehicle.manufacturer,
            model: vehicle.model,
            year: vehicle.year,
            fuel_type: vehicle.fuel_type,
            engine_capacity: vehicle.engine_capacity,
            transmission: vehicle.transmission,
            seating_capacity: vehicle.seating_capacity,
            color: vehicle.color,
            features: vehicle.features,
            vehicle_type: vehicle.vehicle_type,
            created_at: vehicle.spec_created_at,
            updated_at: vehicle.spec_updated_at
        }
    };
}

// Create new vehicle
export const createVehicleService = async (
    vehicle_spec_id: number | undefined,
    rental_rate: number,
    current_location: string,
    manufacturer?: string,
    model?: string,
    year?: number,
    fuel_type?: string,
    engine_capacity?: number,
    transmission?: string,
    seating_capacity?: number,
    color?: string,
    features?: string,
    vehicle_type?: string
): Promise<VehicleWithSpecification | string> => {
    const db = getDbPool();
    
    try {
        let final_vehicle_spec_id = vehicle_spec_id;

        // If no vehicle_spec_id provided, create new specification first
        if (!vehicle_spec_id) {
            if (!manufacturer || !model || !year || !fuel_type || !seating_capacity || !vehicle_type) {
                return "Vehicle specification data is required when vehicle_spec_id is not provided";
            }

            const specQuery = `
                INSERT INTO VehicleSpecifications 
                (manufacturer, model, year, fuel_type, engine_capacity, transmission, seating_capacity, color, features, vehicle_type)
                OUTPUT INSERTED.vehicle_spec_id
                VALUES (@manufacturer, @model, @year, @fuel_type, @engine_capacity, @transmission, @seating_capacity, @color, @features, @vehicle_type)
            `;
            
            const specResult = await db.request()
                .input('manufacturer', manufacturer)
                .input('model', model)
                .input('year', year)
                .input('fuel_type', fuel_type)
                .input('engine_capacity', engine_capacity || null)
                .input('transmission', transmission || null)
                .input('seating_capacity', seating_capacity)
                .input('color', color || null)
                .input('features', features || null)
                .input('vehicle_type', vehicle_type)
                .query(specQuery);

            final_vehicle_spec_id = specResult.recordset[0].vehicle_spec_id;
        }

        // Create the vehicle
        const vehicleQuery = `
            INSERT INTO Vehicles (vehicle_spec_id, rental_rate, current_location)
            OUTPUT INSERTED.*
            VALUES (@vehicle_spec_id, @rental_rate, @current_location)
        `;
        
        const vehicleResult = await db.request()
            .input('vehicle_spec_id', final_vehicle_spec_id)
            .input('rental_rate', rental_rate)
            .input('current_location', current_location)
            .query(vehicleQuery);

        const vehicle = vehicleResult.recordset[0];
        
        // Get the full vehicle with specification
        return await getVehicleByIdService(vehicle.vehicle_id) || "Failed to retrieve created vehicle";
    } catch (error: any) {
        console.error('Error in createVehicleService:', error);
        return "Failed to create vehicle";
    }
}

// Update vehicle by vehicle_id
export const updateVehicleService = async (
    vehicle_id: number,
    rental_rate?: number,
    availability?: boolean,
    current_location?: string
): Promise<VehicleWithSpecification | null> => {
    const db = getDbPool();
    
    let query = 'UPDATE Vehicles SET ';
    const updates: string[] = [];
    const request = db.request();

    request.input('vehicle_id', vehicle_id);

    if (rental_rate !== undefined) {
        updates.push('rental_rate = @rental_rate');
        request.input('rental_rate', rental_rate);
    }

    if (availability !== undefined) {
        updates.push('availability = @availability');
        request.input('availability', availability);
    }

    if (current_location !== undefined) {
        updates.push('current_location = @current_location');
        request.input('current_location', current_location);
    }

    if (updates.length === 0) {
        return null;
    }

    query += updates.join(', ') + ', updated_at = GETDATE() OUTPUT INSERTED.* WHERE vehicle_id = @vehicle_id';

    const result = await request.query(query);
    
    if (!result.recordset[0]) {
        return null;
    }

    // Return the full vehicle with specification
    return await getVehicleByIdService(vehicle_id);
}

// Delete vehicle by vehicle_id
export const deleteVehicleService = async (vehicle_id: number): Promise<string> => {
    const db = getDbPool();
    
    // Check if vehicle has active bookings
    const checkBookingsQuery = `
        SELECT COUNT(*) as booking_count 
        FROM Bookings 
        WHERE vehicle_id = @vehicle_id 
        AND booking_status IN ('Pending', 'Confirmed', 'Active')
    `;
    
    const bookingsResult = await db.request()
        .input('vehicle_id', vehicle_id)
        .query(checkBookingsQuery);

    if (bookingsResult.recordset[0].booking_count > 0) {
        return "Cannot delete vehicle with active bookings";
    }

    const deleteQuery = 'DELETE FROM Vehicles WHERE vehicle_id = @vehicle_id';
    const result = await db.request()
        .input('vehicle_id', vehicle_id)
        .query(deleteQuery);
    
    return result.rowsAffected[0] === 1 ? "Vehicle deleted successfully 🎊" : "Failed to delete vehicle";
}

// Get available locations
export const getAvailableLocationsService = async (): Promise<string[]> => {
    const db = getDbPool();
    const query = 'SELECT DISTINCT current_location FROM Vehicles WHERE availability = 1 ORDER BY current_location';
    const result = await db.request().query(query);
    return result.recordset.map(row => row.current_location);
}

// Get vehicle specifications
export const getVehicleSpecificationsService = async (): Promise<any[]> => {
    const db = getDbPool();
    const query = 'SELECT * FROM VehicleSpecifications ORDER BY manufacturer, model, year';
    const result = await db.request().query(query);
    return result.recordset;
}

// Update vehicle availability
export const updateVehicleAvailabilityService = async (
    vehicle_id: number,
    availability: boolean
): Promise<VehicleWithSpecification | null> => {
    const db = getDbPool();
    const query = `
        UPDATE Vehicles 
        SET availability = @availability, updated_at = GETDATE() 
        OUTPUT INSERTED.* 
        WHERE vehicle_id = @vehicle_id
    `;
    const result = await db.request()
        .input('vehicle_id', vehicle_id)
        .input('availability', availability)
        .query(query);
    
    if (!result.recordset[0]) {
        return null;
    }

    // Return the full vehicle with specification
    return await getVehicleByIdService(vehicle_id);
}