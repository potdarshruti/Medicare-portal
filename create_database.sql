-- Create the database
CREATE DATABASE MedicalInventory;
GO

-- Use the database
USE MedicalInventory;
GO

-- Create medicines table
CREATE TABLE medicines (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    batch NVARCHAR(50) NOT NULL,
    expiry DATE NOT NULL,
    brand NVARCHAR(100) NOT NULL,
    supplier NVARCHAR(100) NOT NULL,
    quantity INT NOT NULL
);

-- Create history table
CREATE TABLE history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    type NVARCHAR(50) NOT NULL,
    medicine_name NVARCHAR(100) NOT NULL,
    batch NVARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    person NVARCHAR(100) NOT NULL,
    timestamp DATETIME DEFAULT GETDATE()
);

-- Create indexes for better performance
CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_batch ON medicines(batch);
CREATE INDEX idx_history_type ON history(type);
CREATE INDEX idx_history_medicine ON history(medicine_name);
CREATE INDEX idx_history_timestamp ON history(timestamp);

-- Optional: Create a view for expired medicines
CREATE VIEW vw_expired_medicines AS
SELECT *
FROM medicines
WHERE expiry < GETDATE();

-- Optional: Create a view for low stock medicines (less than 10 units)
CREATE VIEW vw_low_stock_medicines AS
SELECT *
FROM medicines
WHERE quantity < 10;

GO
