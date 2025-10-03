const bcrypt = require('bcrypt');
const { poolPromise } = require('../config/db');

async function loginUser(username, password) {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Username', username)
      .query('SELECT UserID, Username, Email, PasswordHash, UserType, Image FROM Users WHERE Username = @Username');

    const user = result.recordset[0];

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);

    if (!isPasswordValid) {
      return { success: false, message: 'Invalid password' };
    }

    return {
      success: true,
      user: {
        UserID: user.UserID,
        Username: user.Username,
        Email: user.Email,
        UserType: user.UserType,
        Image: user.Image
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Server error during login' };
  }
}

module.exports = { loginUser };