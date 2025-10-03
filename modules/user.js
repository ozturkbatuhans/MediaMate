const { poolPromise } = require('../config/db');

async function getUserById(userID) {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UserID', userID)
      .query('SELECT Username, Email, Image, UserType FROM Users WHERE UserID = @UserID');

    const user = result.recordset[0];
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, user };
  } catch (error) {
    console.error('Error fetching user:', error);
    return { success: false, message: 'Server error fetching user' };
  }
}

async function checkDuplicateEmail(email, userID) {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('Email', email)
      .input('UserID', userID)
      .query('SELECT UserID FROM Users WHERE Email = @Email AND UserID != @UserID');

    if (result.recordset.length > 0) {
      return { isUnique: false, message: 'Email already in use' };
    }

    return { isUnique: true };
  } catch (error) {
    console.error('Error checking duplicate email:', error);
    return { isUnique: false, message: 'Server error checking email' };
  }
}

async function updateUser(userID, updates, inputs) {
  try {
    const pool = await poolPromise;
    if (updates.length === 0) {
      return { success: true }; // No updates needed
    }

    const query = `UPDATE Users SET ${updates.join(', ')} WHERE UserID = @UserID`;
    const request = pool.request().input('UserID', userID);

    if (inputs.Email) request.input('Email', inputs.Email);
    if (inputs.Image) request.input('Image', inputs.Image);
    if (inputs.PasswordHash) request.input('PasswordHash', inputs.PasswordHash);

    await request.query(query);
    return { success: true };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, message: 'Server error during update' };
  }
}

async function getUserRequests(userID) {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UserID', userID)
      .query('SELECT RequestID, UserID, Status, Description, ContentType FROM Requests WHERE UserID = @UserID');

    return {
      success: true,
      requests: result.recordset
    };
  } catch (error) {
    console.error('Error fetching user requests:', error);
    return {
      success: false,
      message: 'Server error fetching requests'
    };
  }
}

module.exports = { getUserById, checkDuplicateEmail, updateUser, getUserRequests };