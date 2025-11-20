-- Users Table
CREATE TABLE Users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    first_name NVARCHAR(50) NOT NULL,
    last_name NVARCHAR(50) NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    contact_phone NVARCHAR(20),
    address NVARCHAR(255),
    role NVARCHAR(10) CHECK (role IN ('user', 'admin')) DEFAULT 'user',
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

EXEC sp_rename 'Users.contact_phone', 'phone_number', 'COLUMN';
EXEC sp_rename 'Users.role', 'user_type', 'COLUMN';

SELECT 
    cc.name AS constraint_name
FROM sys.check_constraints cc
JOIN sys.columns c ON cc.parent_object_id = c.object_id 
                  AND cc.parent_column_id = c.column_id
WHERE cc.parent_object_id = OBJECT_ID('Users')
  AND c.name = 'role';

ALTER TABLE Users
DROP CONSTRAINT CK__Users__role__38996AB5;  
  

select*from Users

-- Vehicle Specification Table
CREATE TABLE VehicleSpecifications (
    vehicle_spec_id INT IDENTITY(1,1) PRIMARY KEY,
    manufacturer NVARCHAR(50) NOT NULL,
    model NVARCHAR(50) NOT NULL,
    year INT NOT NULL,
    fuel_type NVARCHAR(20) NOT NULL,
    engine_capacity DECIMAL(5,2),
    transmission NVARCHAR(20) CHECK (transmission IN ('Manual', 'Automatic')),
    seating_capacity INT NOT NULL,
    color NVARCHAR(30),
    features NVARCHAR(MAX),
    vehicle_type NVARCHAR(20) CHECK (vehicle_type IN ('two-wheeler', 'four-wheeler')), -- Added for categorization
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- Vehicles Table (Now includes location field)
CREATE TABLE Vehicles (
    vehicle_id INT IDENTITY(1,1) PRIMARY KEY,
    vehicle_spec_id INT NOT NULL,
    rental_rate DECIMAL(10,2) NOT NULL,
    availability BIT DEFAULT 1,
    current_location NVARCHAR(100), -- Added location field instead of separate table
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (vehicle_spec_id) REFERENCES VehicleSpecifications(vehicle_spec_id) ON DELETE CASCADE
);

-- Bookings Table (Now includes pickup_location and return_location)
CREATE TABLE Bookings (
    booking_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    pickup_location NVARCHAR(100) NOT NULL, -- Changed from location_id FK to NVARCHAR
    return_location NVARCHAR(100) NOT NULL, -- Added return location
    booking_date DATETIME2 NOT NULL,
    return_date DATETIME2 NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    booking_status NVARCHAR(20) CHECK (booking_status IN ('Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled')) DEFAULT 'Pending',
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id)
);

-- Payments Table
CREATE TABLE Payments (
    payment_id INT IDENTITY(1,1) PRIMARY KEY,
    booking_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status NVARCHAR(20) CHECK (payment_status IN ('Pending', 'Completed', 'Failed', 'Refunded')) DEFAULT 'Pending',
    payment_date DATETIME2,
    payment_method NVARCHAR(50),
    transaction_id NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id) ON DELETE CASCADE
);

-- Customer Support Tickets Table
CREATE TABLE SupportTickets (
    ticket_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    subject NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')) DEFAULT 'Open',
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);