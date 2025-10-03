-- Ensure no active connections to the database
ALTER DATABASE MediaMate SET SINGLE_USER WITH ROLLBACK IMMEDIATE;

-- Drop the MediaMate database
DROP DATABASE MediaMate;
GO