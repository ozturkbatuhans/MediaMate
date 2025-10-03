USE master;
GO

CREATE DATABASE MediaMate ON
(NAME = MediaMate,
	FILENAME = 'C:\Program Files\Microsoft SQL Server\MSSQL16.VIVES\MSSQL\DATA\MediaMate.mdf',
	SIZE = 10,
	MAXSIZE = 50,
	FILEGROWTH = 5)
LOG ON
(NAME = MediaMate_log,
	FILENAME = 'C:\Program Files\Microsoft SQL Server\MSSQL16.VIVES\MSSQL\DATA\Mediamate.ldf',
	SIZE = 5 MB,
	MAXSIZE = 25 MB,
	FILEGROWTH = 5 MB);
GO
