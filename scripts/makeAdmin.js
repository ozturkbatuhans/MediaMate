const { sql, poolPromise } = require('../config/db.js');

async function setUserToAdmin(userID = 1) {
  try {
    const pool = await poolPromise;

    // Update UserType to 'Admin'
    const updateResult = await pool.request()
      .input('userID', sql.Int, userID)
      .query('UPDATE Users SET UserType = \'Admin\' WHERE UserID = @userID');

    if (updateResult.rowsAffected[0] === 0) {
      console.log(`No user found with UserID = ${userID}`);
      return { success: false, message: `No user found with UserID = ${userID}` };
    }


    console.log(`User with UserID = ${userID} set to Admin successfully and action logged`);
    return { success: true, message: `User with UserID = ${userID} set to Admin` };
  } catch (err) {
    console.error('Error updating user to Admin:', err);
    throw err;
  }
}

setUserToAdmin();