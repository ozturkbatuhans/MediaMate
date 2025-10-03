const bcrypt = require('bcrypt');
const { sql, poolPromise } = require('../config/db.js');

async function updateUserPassword(userID = 1, password = 'Tp:r7576jX') {
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Update user's password
      const request = new sql.Request(transaction);
      const result = await request
        .input('userID', sql.Int, userID)
        .input('passwordHash', sql.NVarChar, hashedPassword)
        .query('UPDATE Users SET PasswordHash = @passwordHash WHERE UserID = @userID');

      if (result.rowsAffected[0] === 0) {
        await transaction.rollback();
        console.log(`No user found with UserID = ${userID}`);
        return { success: false, message: `No user found with UserID = ${userID}` };
      }

      await transaction.commit();
      console.log(`Password updated successfully for UserID = ${userID}`);
      return { success: true, message: `Password updated for UserID = ${userID}` };
    } catch (err) {
      await transaction.rollback();
      console.error('Error updating password:', err);
      return { success: false, message: 'Server error during password update' };
    }
  } catch (err) {
    console.error('Error connecting to database:', err);
    return { success: false, message: 'Database connection error' };
  }
}

updateUserPassword();