const bcrypt = require('bcrypt');
const { poolPromise } = require('../config/db');

function validateRegisterInput(username, email, password) {
  const trimmedUsername = username ? username.trim() : '';
  const trimmedEmail = email ? email.trim() : '';
  const errors = {};

  if (!trimmedUsername) {
    errors.username = 'Username is required';
  }
  if (!trimmedEmail) {
    errors.email = 'Email is required';
  }
  if (!password) {
    errors.password = 'Password is required';
  }

  if (trimmedUsername && trimmedUsername.length > 25) {
    errors.username = 'Username must be 25 characters or less';
  }
  if (trimmedEmail && trimmedEmail.length > 254) {
    errors.email = 'Email must be 254 characters or less';
  }
  if (password && password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  if (trimmedEmail && !/^[ \w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(trimmedEmail)) {
    errors.email = 'Invalid email format';
  }

  if (trimmedUsername && !/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    errors.username = 'Username can only contain letters, numbers, and underscores';
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors, trimmedUsername, trimmedEmail };
  }

  return { isValid: true, trimmedUsername, trimmedEmail };
}

function validateLoginInput(username, password) {
  const trimmedUsername = username ? username.trim() : '';
  const errors = {};

  if (!trimmedUsername) {
    errors.username = 'Username is required';
  }
  if (!password) {
    errors.password = 'Password is required';
  }

  if (trimmedUsername && trimmedUsername.length > 25) {
    errors.username = 'Username must be 25 characters or less';
  }

  if (trimmedUsername && !/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    errors.username = 'Username can only contain letters, numbers, and underscores';
  }

  if (password && password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors, trimmedUsername };
  }

  return { isValid: true, trimmedUsername };
}

function validateUpdateInput(email, imagePath, newPassword, currentPassword) {
  const trimmedEmail = email ? email.trim() : '';
  const trimmedImagePath = imagePath ? imagePath.trim() : '';
  const errors = {};

  // Validate email if provided
  if (trimmedEmail) {
    if (trimmedEmail.length > 254) {
      errors.email = 'Email must be 254 characters or less';
    } else if (!/^[ \w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(trimmedEmail)) {
      errors.email = 'Invalid email format';
    }
  }

  // Validate image path if provided
  if (trimmedImagePath && trimmedImagePath.length > 255) {
    errors.image = 'Image path must be 255 characters or less';
  }

  // Validate new password if provided
  if (newPassword) {
    if (!currentPassword) {
      errors.currentPassword = 'Current password is required to update password';
    }
    if (newPassword.length < 6) {
      errors.newPassword = 'New password must be at least 6 characters';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors, trimmedEmail, trimmedImagePath };
  }

  return { isValid: true, trimmedEmail, trimmedImagePath };
}

async function verifyCurrentPassword(userID, currentPassword) {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UserID', userID)
      .query('SELECT PasswordHash FROM Users WHERE UserID = @UserID');

    const user = result.recordset[0];
    if (!user) {
      return { isValid: false, error: 'User not found' };
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.PasswordHash);
    if (!isPasswordValid) {
      return { isValid: false, error: 'Current password is incorrect' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Password verification error:', error);
    return { isValid: false, error: 'Server error during password verification' };
  }
}

module.exports = { validateRegisterInput, validateLoginInput, validateUpdateInput, verifyCurrentPassword };