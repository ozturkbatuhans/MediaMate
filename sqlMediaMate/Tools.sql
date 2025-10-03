-- Insert Admin user if not exists
IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'Admin')
BEGIN
    INSERT INTO Users (Username, Email, PasswordHash, UserType, Image)
    OUTPUT INSERTED.UserID
    VALUES ('Admin', NULL, 'Tp:r7576jX', 'Admin', NULL);
END
ELSE
BEGIN
    -- Return UserID of existing user
    SELECT UserID
    FROM Users
    WHERE Username = 'Admin';
END
GO



select * from books
select * from movies
select * from games
select * from content