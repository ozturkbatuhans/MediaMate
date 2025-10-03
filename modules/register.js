const bcrypt = require('bcrypt');
const { poolPromise } = require('../config/db');

async function registerUser(username, email, password) {
  try {
    const pool = await poolPromise;

    // Check if email already exists
    const existingEmail = await pool.request()
      .input('Email', email)
      .query('SELECT UserID FROM Users WHERE Email = @Email');

    if (existingEmail.recordset.length > 0) {
      return { success: false, message: 'Email already registered' };
    }

    // Check if username already exists
    const existingUsername = await pool.request()
      .input('Username', username)
      .query('SELECT UserID FROM Users WHERE Username = @Username');

    if (existingUsername.recordset.length > 0) {
      return { success: false, message: 'Username already taken' };
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await pool.request()
      .input('Username', username)
      .input('Email', email)
      .input('PasswordHash', hashedPassword)
      .input('UserType', 'User')
      .input('Image', '/images/DefaultUser.jpg')
      .query(`
        INSERT INTO Users (Username, Email, PasswordHash, UserType, Image)
        OUTPUT INSERTED.UserID, INSERTED.Username, INSERTED.Email, INSERTED.UserType, INSERTED.Image
        VALUES (@Username, @Email, @PasswordHash, @UserType, @Image)
      `);

    const newUser = result.recordset[0];

    return {
      success: true,
      user: {
        UserID: newUser.UserID,
        Username: newUser.Username,
        Email: newUser.Email,
        UserType: newUser.UserType,
        Image: newUser.Image
      }
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, message: 'Server error during registration' };
  }
}

module.exports = { registerUser };