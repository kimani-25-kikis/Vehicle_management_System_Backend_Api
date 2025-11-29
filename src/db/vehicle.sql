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

CREATE TABLE PaymentsTable(
    payment_id INT IDENTITY(1,1) PRIMARY KEY,
    booking_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status NVARCHAR(20) CHECK (payment_status IN ('Pending', 'Completed', 'Failed', 'Refunded')) DEFAULT 'Pending',
    -- payment_date DATETIME2,
    payment_method NVARCHAR(50),
    transaction_id NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE NO ACTION

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
###PART 2

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
select*from Users
select*from PaymentsTable

UPDATE users SET user_type = 'admin' WHERE user_id = 1



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
    vehicle_type NVARCHAR(20) CHECK (vehicle_type IN ('two-wheeler', 'four-wheeler')),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
SELECT * FROM VehicleSpecifications;


-- Vehicles Table (Now includes location field)
CREATE TABLE Vehicles (
    vehicle_id INT IDENTITY(1,1) PRIMARY KEY,
    vehicle_spec_id INT NOT NULL,
    rental_rate DECIMAL(10,2) NOT NULL,
    availability BIT DEFAULT 1,
    current_location NVARCHAR(100), 
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (vehicle_spec_id) REFERENCES VehicleSpecifications(vehicle_spec_id) ON DELETE CASCADE
);

select*from vehicles

-- Bookings Table (Now includes pickup_location and return_location)
CREATE TABLE Bookings (
    booking_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    pickup_location NVARCHAR(100) NOT NULL, -- 
    return_location NVARCHAR(100) NOT NULL, --
    booking_date DATETIME2 NOT NULL,
    return_date DATETIME2 NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    booking_status NVARCHAR(20) CHECK (booking_status IN ('Pending', 'Confirmed', 'Active', 'Completed', 'Cancelled')) DEFAULT 'Pending',
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id)
);

CREATE TABLE PaymentsTable(
    payment_id INT IDENTITY(1,1) PRIMARY KEY,
    booking_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status NVARCHAR(20) CHECK (payment_status IN ('Pending', 'Completed', 'Failed', 'Refunded')) DEFAULT 'Pending',
    payment_method NVARCHAR(50),
    transaction_id NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE NO ACTION

);

SELECT * FROM  PaymentsTable

ALTER TABLE Bookings ADD
    pickup_date DATETIME2 NULL,
    driver_license_number NVARCHAR(50) NULL,
    driver_license_expiry DATE NULL,
    driver_license_front_url NVARCHAR(255) NULL,
    driver_license_back_url NVARCHAR(255) NULL,
    insurance_type NVARCHAR(20) NULL,
    additional_protection BIT NULL,
    roadside_assistance BIT NULL,
    verified_by_admin BIT NULL,
    verified_at DATETIME2 NULL,
    admin_notes NVARCHAR(500) NULL;

ALTER TABLE Bookings ADD CONSTRAINT DF_Bookings_InsuranceType DEFAULT 'basic' FOR insurance_type;
ALTER TABLE Bookings ADD CONSTRAINT DF_Bookings_AdditionalProtection DEFAULT 0 FOR additional_protection;
ALTER TABLE Bookings ADD CONSTRAINT DF_Bookings_Roadside DEFAULT 1 FOR roadside_assistance;
ALTER TABLE Bookings ADD CONSTRAINT DF_Bookings_Verified DEFAULT 0 FOR verified_by_admin;

UPDATE Bookings SET
    insurance_type = ISNULL(insurance_type, 'basic'),
    additional_protection = ISNULL(additional_protection, 0),
    roadside_assistance = ISNULL(roadside_assistance, 1),
    verified_by_admin = ISNULL(verified_by_admin, 0);

ALTER TABLE Bookings ALTER COLUMN pickup_date DATETIME2 NOT NULL ;
ALTER TABLE Bookings ALTER COLUMN driver_license_number NVARCHAR(50) NOT NULL;
ALTER TABLE Bookings ALTER COLUMN driver_license_expiry DATE NOT NULL ;
ALTER TABLE Bookings ALTER COLUMN driver_license_front_url NVARCHAR(255) NOT NULL;
ALTER TABLE Bookings ALTER COLUMN driver_license_back_url NVARCHAR(255) NOT NULL;

SELECT * FROM Bookings
WHERE admin_notes IS NULL;

UPDATE Bookings
SET admin_notes = ''
WHERE admin_notes IS NULL;

ALTER TABLE Bookings
ALTER COLUMN admin_notes NVARCHAR(500) NOT NULL;

ALTER TABLE Bookings
ALTER COLUMN admin_notes NVARCHAR(500) NULL;




select*from Bookings


select*from Bookings

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

-- Add type column to your table
ALTER TABLE SupportTickets ADD type NVARCHAR(20) 
CHECK (type IN ('damage_report', 'general_inquiry', 'technical_issue')) DEFAULT 'general_inquiry';

ALTER TABLE SupportTickets 
ADD booking_id INT NULL FOREIGN KEY REFERENCES Bookings(booking_id)

ALTER TABLE SupportTickets 
ADD admin_notes NVARCHAR(MAX) NULL;

-- Create indexes for better performance
CREATE INDEX IX_SupportTickets_UserID ON SupportTickets(user_id);
CREATE INDEX IX_SupportTickets_Status ON SupportTickets(status);
CREATE INDEX IX_SupportTickets_Type ON SupportTickets(type);
CREATE INDEX IX_SupportTickets_BookingID ON SupportTickets(booking_id);

select*from SupportTickets

-- Reviews table
CREATE TABLE Reviews (
    review_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    booking_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment NVARCHAR(1000) NOT NULL,
    is_approved BIT DEFAULT 0,
    admin_notes NVARCHAR(500) NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id) ON DELETE NO ACTION
);

-- Create indexes for better performance
CREATE INDEX IX_Reviews_UserID ON Reviews(user_id);
CREATE INDEX IX_Reviews_BookingID ON Reviews(booking_id);
CREATE INDEX IX_Reviews_VehicleID ON Reviews(vehicle_id);
CREATE INDEX IX_Reviews_Approved ON Reviews(is_approved);
CREATE INDEX IX_Reviews_Rating ON Reviews(rating);
CREATE INDEX IX_Reviews_CreatedAt ON Reviews(created_at DESC);

-- Optional: Create a unique constraint to prevent duplicate reviews for same booking
CREATE UNIQUE INDEX UQ_Reviews_BookingID ON Reviews(booking_id);

select*from Reviews

CREATE TABLE VehicleMaintenance (
    maintenance_id INT IDENTITY(1,1) PRIMARY KEY,
    vehicle_id INT NOT NULL,
    maintenance_type NVARCHAR(50) NOT NULL CHECK (maintenance_type IN ('Routine Service', 'Repair', 'Inspection', 'Tire Replacement', 'Brake Service', 'Oil Change', 'Battery Replacement')),
    maintenance_date DATETIME2 NOT NULL,
    description NVARCHAR(MAX),
    cost DECIMAL(10,2),
    mileage INT,
    next_service_date DATETIME2,
    performed_by NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id) ON DELETE CASCADE
);

CREATE TABLE VehicleHistory (
    history_id INT IDENTITY(1,1) PRIMARY KEY,
    vehicle_id INT NOT NULL,
    event_type NVARCHAR(50) NOT NULL CHECK (event_type IN ('Purchase', 'Service', 'Accident', 'Upgrade', 'Transfer', 'Rental')),
    event_date DATETIME2 NOT NULL,
    description NVARCHAR(MAX),
    odometer_reading INT,
    notes NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id) ON DELETE CASCADE
);

CREATE TABLE DriverLicenseUploads (
    upload_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    license_number NVARCHAR(100) NOT NULL,
    file_type NVARCHAR(10) NOT NULL, -- 'front' or 'back'
    file_name NVARCHAR(255) NOT NULL,
    file_path NVARCHAR(500) NOT NULL,
    uploaded_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    verified_by_admin BIT DEFAULT 0,
    verified_at DATETIME2 NULL,
    verification_notes NVARCHAR(500) NULL,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

select*from DriverLicenseUploads

-- Index for better query performance
CREATE INDEX IX_DriverLicenseUploads_UserId ON DriverLicenseUploads(user_id);
CREATE INDEX IX_DriverLicenseUploads_LicenseNumber ON DriverLicenseUploads(license_number);
CREATE INDEX IX_DriverLicenseUploads_Verified ON DriverLicenseUploads(verified_by_admin);