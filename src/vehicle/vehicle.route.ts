import {Hono} from 'hono'
import * as vehicleControllers from './vehicle.controller.ts'
import { adminRoleAuth } from '../middleware/bearAuth.ts'

const vehicleRoutes = new Hono()

// Public routes
vehicleRoutes.get('/vehicles', vehicleControllers.getAllVehicles)
vehicleRoutes.get('/vehicles/locations', vehicleControllers.getAvailableLocations)
vehicleRoutes.get('/vehicles/specifications', vehicleControllers.getVehicleSpecifications)
vehicleRoutes.get('/vehicles/:vehicle_id', vehicleControllers.getVehicleById)

// Admin protected routes
vehicleRoutes.post('/vehicles', adminRoleAuth, vehicleControllers.createVehicle)
vehicleRoutes.put('/vehicles/:vehicle_id', adminRoleAuth, vehicleControllers.updateVehicle)
vehicleRoutes.delete('/vehicles/:vehicle_id', adminRoleAuth, vehicleControllers.deleteVehicle)
vehicleRoutes.patch('/vehicles/:vehicle_id/availability', adminRoleAuth, vehicleControllers.updateVehicleAvailability)

export default vehicleRoutes