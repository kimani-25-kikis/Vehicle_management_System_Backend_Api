import { getDbPool } from "../db/db.config.ts"
import { 
  uploadVehicleImage, 
  deleteVehicleImage,
  deleteVehicleImages,
  type CloudinaryUploadResult 
} from '../cloudinary/vehicleCloudinary.service.ts';

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
    image_url: string | null;
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
    status?: 'available' | 'rented' | 'maintenance';
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
    transmission?: string;
    search?: string;
    availability?: boolean;
    status?: 'available' | 'rented' | 'maintenance';
}

// Helper function to check if vehicle has active bookings
const checkVehicleRentalStatus = async (vehicle_id: number): Promise<boolean> => {
    const db = getDbPool();
    const query = `
        SELECT COUNT(*) as active_bookings 
        FROM Bookings 
        WHERE vehicle_id = @vehicle_id 
        AND booking_status IN ('Pending', 'Confirmed', 'Active')
        AND return_date >= GETDATE()
    `;
    
    const result = await db.request()
        .input('vehicle_id', vehicle_id)
        .query(query);
    
    return result.recordset[0].active_bookings > 0;
}

// Helper function to check if vehicle can be modified/deleted
const canModifyVehicle = async (vehicle_id: number): Promise<boolean> => {
    const db = getDbPool();
    const query = `
        SELECT COUNT(*) as active_bookings 
        FROM Bookings 
        WHERE vehicle_id = @vehicle_id 
        AND booking_status IN ('Pending', 'Confirmed', 'Active')
    `;
    
    const result = await db.request()
        .input('vehicle_id', vehicle_id)
        .query(query);
    
    return result.recordset[0].active_bookings === 0;
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
            vs.image_url,
            vs.created_at as spec_created_at,
            vs.updated_at as spec_updated_at
        FROM Vehicles v
        JOIN VehicleSpecifications vs ON v.vehicle_spec_id = vs.vehicle_spec_id
        WHERE 1=1
    `;
    
    const request = db.request();

    // Handle status filter (available, rented, maintenance)
    if (filters?.status) {
        if (filters.status === 'maintenance') {
            query += ' AND v.availability = 0';
        } else if (filters.status === 'available') {
            query += ' AND v.availability = 1';
        }
        // For 'rented' status, we'll filter after checking bookings
    } else if (filters?.availability !== undefined) {
        query += ' AND v.availability = @availability';
        request.input('availability', filters.availability);
    }

    // Search functionality
    if (filters?.search) {
        query += ' AND (vs.manufacturer LIKE @search OR vs.model LIKE @search OR vs.features LIKE @search OR v.current_location LIKE @search)';
        request.input('search', `%${filters.search}%`);
    }
    
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
    
    if (filters?.transmission) {
        query += ' AND vs.transmission = @transmission';
        request.input('transmission', filters.transmission);
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
    
    // Structure the data with nested specification and determine status
    const vehiclesWithSpecs: VehicleWithSpecification[] = [];
    
    for (const vehicle of result.recordset) {
        // Determine vehicle status
        let status: 'available' | 'rented' | 'maintenance';
        
        if (!vehicle.availability) {
            status = 'maintenance';
        } else {
            const isRented = await checkVehicleRentalStatus(vehicle.vehicle_id);
            status = isRented ? 'rented' : 'available';
        }
        
        // Skip if filtering by 'rented' status and vehicle is not rented
        if (filters?.status === 'rented' && status !== 'rented') {
            continue;
        }
        
        vehiclesWithSpecs.push({
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
                image_url: vehicle.image_url,
                created_at: vehicle.spec_created_at,
                updated_at: vehicle.spec_updated_at
            },
            status: status
        });
    }
    
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
            vs.image_url,
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
    
    // Determine status
    let status: 'available' | 'rented' | 'maintenance';
    if (!vehicle.availability) {
        status = 'maintenance';
    } else {
        const isRented = await checkVehicleRentalStatus(vehicle_id);
        status = isRented ? 'rented' : 'available';
    }
    
    return {
        vehicle_id: vehicle.vehicle_id,
        rental_rate: vehicle.rental_rate,
        availability: vehicle.availability,
        current_location: vehicle.current_location,
        created_at: vehicle.created_at,
        updated_at: vehicle.updated_at,
        status: status,
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
            image_url: vehicle.image_url,
            created_at: vehicle.spec_created_at,
            updated_at: vehicle.spec_updated_at
        }
    };
}

// Create new vehicle
// Update the createVehicleService function
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
    vehicle_type?: string,
    image_url?: string,
    image_file?: { buffer: Buffer; fileName: string; mimeType: string },
    availability?: boolean
): Promise<VehicleWithSpecification | string> => {
    const db = getDbPool();
    
    // Declare these variables at the function scope so they're accessible in catch block
    let cloudinaryImageUrl: string | undefined = image_url;
    let cloudinaryPublicId: string | null = null;
    
    try {
        // Handle image upload if file is provided
        if (image_file) {
            try {
                const uploadResult = await uploadVehicleImage(
                    image_file.buffer,
                    image_file.fileName
                );
                cloudinaryImageUrl = uploadResult.secure_url;
                cloudinaryPublicId = uploadResult.public_id;
            } catch (uploadError) {
                console.error('Image upload failed:', uploadError);
                return "Failed to upload vehicle image";
            }
        }

        let final_vehicle_spec_id = vehicle_spec_id;

        // If no vehicle_spec_id provided, create new specification first
        if (!vehicle_spec_id) {
            if (!manufacturer || !model || !year || !fuel_type || !seating_capacity || !vehicle_type) {
                // Clean up uploaded image if validation fails
                if (cloudinaryPublicId) {
                    try {
                        await deleteVehicleImage(cloudinaryPublicId);
                    } catch (deleteError) {
                        console.error('Failed to cleanup uploaded image:', deleteError);
                    }
                }
                return "Vehicle specification data is required when vehicle_spec_id is not provided";
            }

            const specQuery = `
                INSERT INTO VehicleSpecifications 
                (manufacturer, model, year, fuel_type, engine_capacity, transmission, 
                 seating_capacity, color, features, vehicle_type, image_url, image_public_id)
                OUTPUT INSERTED.vehicle_spec_id
                VALUES (@manufacturer, @model, @year, @fuel_type, @engine_capacity, @transmission, 
                        @seating_capacity, @color, @features, @vehicle_type, @image_url, @image_public_id)
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
                .input('image_url', cloudinaryImageUrl || null)
                .input('image_public_id', cloudinaryPublicId || null)
                .query(specQuery);

            final_vehicle_spec_id = specResult.recordset[0].vehicle_spec_id;
        } else {
            // Update existing specification with new image if provided
            if (cloudinaryImageUrl) {
                const updateSpecQuery = `
                    UPDATE VehicleSpecifications 
                    SET image_url = @image_url, 
                        image_public_id = @image_public_id,
                        updated_at = GETDATE()
                    WHERE vehicle_spec_id = @vehicle_spec_id
                `;
                
                await db.request()
                    .input('vehicle_spec_id', final_vehicle_spec_id)
                    .input('image_url', cloudinaryImageUrl)
                    .input('image_public_id', cloudinaryPublicId)
                    .query(updateSpecQuery);
            }
        }

        // Create the vehicle WITH availability
        const vehicleQuery = `
            INSERT INTO Vehicles (vehicle_spec_id, rental_rate, current_location, availability)
            OUTPUT INSERTED.*
            VALUES (@vehicle_spec_id, @rental_rate, @current_location, @availability)
        `;
        
        const vehicleResult = await db.request()
            .input('vehicle_spec_id', final_vehicle_spec_id)
            .input('rental_rate', rental_rate)
            .input('current_location', current_location)
            .input('availability', availability !== undefined ? availability : true)
            .query(vehicleQuery);

        const vehicle = vehicleResult.recordset[0];
        
        // Get the full vehicle with specification
        const createdVehicle = await getVehicleByIdService(vehicle.vehicle_id);
        if (!createdVehicle) {
            // Clean up if we can't retrieve the created vehicle
            if (cloudinaryPublicId) {
                try {
                    await deleteVehicleImage(cloudinaryPublicId);
                } catch (deleteError) {
                    console.error('Failed to cleanup uploaded image:', deleteError);
                }
            }
            return "Failed to retrieve created vehicle";
        }
        
        return createdVehicle;
    } catch (error: any) {
        console.error('Error in createVehicleService:', error);
        
        // Clean up uploaded image if creation fails
        if (cloudinaryPublicId) {
            try {
                await deleteVehicleImage(cloudinaryPublicId);
            } catch (deleteError) {
                console.error('Failed to cleanup uploaded image:', deleteError);
            }
        }
        
        return "Failed to create vehicle";
    }
}
// Update vehicle by vehicle_id
export const updateVehicleService = async (
    vehicle_id: number,
    rental_rate?: number,
    availability?: boolean,
    current_location?: string
): Promise<VehicleWithSpecification | null | string> => {
    const db = getDbPool();
    
    // Check if vehicle can be modified
    const canModify = await canModifyVehicle(vehicle_id);
    if (!canModify) {
        return "Cannot update vehicle with active bookings";
    }
    
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
    
    // Check if vehicle can be deleted
    const canDelete = await canModifyVehicle(vehicle_id);
    if (!canDelete) {
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
    const query = `
        SELECT 
            vehicle_spec_id,
            manufacturer,
            model,
            year,
            fuel_type,
            engine_capacity,
            transmission,
            seating_capacity,
            color,
            features,
            vehicle_type,
            image_url,
            created_at,
            updated_at
        FROM VehicleSpecifications 
        ORDER BY manufacturer, model, year
    `;
    const result = await db.request().query(query);
    return result.recordset;
}

// Update vehicle availability
export const updateVehicleAvailabilityService = async (
    vehicle_id: number,
    availability: boolean
): Promise<VehicleWithSpecification | null | string> => {
    const db = getDbPool();
    
    // Check if vehicle can be modified
    const canModify = await canModifyVehicle(vehicle_id);
    if (!canModify) {
        return "Cannot update availability for vehicle with active bookings";
    }
    
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

export const addVehicleImagesService = async (
    vehicle_spec_id: number,
    images: Array<{ buffer: Buffer; fileName: string; mimeType: string }>,
    is_primary_index: number = 0
): Promise<{ success: boolean; message: string; images?: any[] }> => {
    const db = getDbPool();
    
    // Store uploaded public_ids for cleanup if needed
    const uploadedPublicIds: string[] = [];
    
    try {
        // Upload all images to Cloudinary
        const uploadPromises = images.map(async (image, index) => {
            const uploadResult = await uploadVehicleImage(
                image.buffer,
                image.fileName,
                vehicle_spec_id,
                {
                    transformation: [
                        { width: 1000, height: 750, crop: 'fill', gravity: 'auto' },
                        { quality: 'auto' }
                    ]
                }
            );
            
            // Track uploaded images
            uploadedPublicIds.push(uploadResult.public_id);
            
            return {
                ...uploadResult,
                is_primary: index === is_primary_index ? 1 : 0
            };
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        
        // Save to database
        const insertPromises = uploadResults.map(async (image) => {
            const query = `
                INSERT INTO VehicleImages 
                (vehicle_spec_id, image_url, image_public_id, is_primary)
                VALUES (@vehicle_spec_id, @image_url, @image_public_id, @is_primary)
            `;
            
            await db.request()
                .input('vehicle_spec_id', vehicle_spec_id)
                .input('image_url', image.secure_url)
                .input('image_public_id', image.public_id)
                .input('is_primary', image.is_primary)
                .query(query);
        });
        
        await Promise.all(insertPromises);
        
        // If we added a primary image, update the main image_url in VehicleSpecifications
        const primaryImage = uploadResults.find(img => img.is_primary === 1);
        if (primaryImage) {
            await db.request()
                .input('vehicle_spec_id', vehicle_spec_id)
                .input('image_url', primaryImage.secure_url)
                .input('image_public_id', primaryImage.public_id)
                .query(`
                    UPDATE VehicleSpecifications 
                    SET image_url = @image_url, image_public_id = @image_public_id
                    WHERE vehicle_spec_id = @vehicle_spec_id
                `);
        }
        
        return {
            success: true,
            message: 'Vehicle images uploaded successfully',
            images: uploadResults
        };
    } catch (error: any) {
        console.error('Error adding vehicle images:', error);
        
        // Clean up uploaded images on failure
        if (uploadedPublicIds.length > 0) {
            try {
                // Use the plural function for multiple images
                await deleteVehicleImages(uploadedPublicIds);
            } catch (cleanupError) {
                console.error('Failed to cleanup images:', cleanupError);
            }
        }
        
        return {
            success: false,
            message: 'Failed to upload vehicle images'
        };
    }
}

export const updateVehicleImageService = async (
    vehicle_spec_id: number,
    image_file: { buffer: Buffer; fileName: string; mimeType: string }
): Promise<{ success: boolean; message: string; image_url?: string }> => {
    const db = getDbPool();
    
    // Store new upload result for cleanup if needed
    let newPublicId: string | null = null;
    let oldPublicId: string | null = null;
    
    try {
        // Get current image public_id to delete it
        const currentQuery = `
            SELECT image_public_id FROM VehicleSpecifications 
            WHERE vehicle_spec_id = @vehicle_spec_id
        `;
        
        const currentResult = await db.request()
            .input('vehicle_spec_id', vehicle_spec_id)
            .query(currentQuery);
            
        oldPublicId = currentResult.recordset[0]?.image_public_id;
        
        // Upload new image
        const uploadResult = await uploadVehicleImage(
            image_file.buffer,
            image_file.fileName,
            vehicle_spec_id
        );
        
        newPublicId = uploadResult.public_id;
        
        // Update database
        const updateQuery = `
            UPDATE VehicleSpecifications 
            SET image_url = @image_url, 
                image_public_id = @image_public_id,
                updated_at = GETDATE()
            WHERE vehicle_spec_id = @vehicle_spec_id
        `;
        
        await db.request()
            .input('vehicle_spec_id', vehicle_spec_id)
            .input('image_url', uploadResult.secure_url)
            .input('image_public_id', uploadResult.public_id)
            .query(updateQuery);
            
        // Delete old image from Cloudinary after successful update
        if (oldPublicId) {
            try {
                await deleteVehicleImage(oldPublicId);
            } catch (deleteError) {
                console.warn('Could not delete old image:', deleteError);
                // This is not critical - we can continue
            }
        }
            
        return {
            success: true,
            message: 'Vehicle image updated successfully',
            image_url: uploadResult.secure_url
        };
    } catch (error: any) {
        console.error('Error updating vehicle image:', error);
        
        // Clean up new uploaded image if update failed
        if (newPublicId) {
            try {
                await deleteVehicleImage(newPublicId);
            } catch (cleanupError) {
                console.error('Failed to cleanup uploaded image:', cleanupError);
            }
        }
        
        return {
            success: false,
            message: 'Failed to update vehicle image'
        };
    }
}