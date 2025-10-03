const { sql, poolPromise } = require('../config/db.js');

async function deleteReviews() {
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);
      const result = await request.query('DELETE FROM Reviews');

      await transaction.commit();
      const rowsDeleted = result.rowsAffected[0];
      console.log(`Deleted ${rowsDeleted} records from Reviews successfully`);
      return { success: true, message: `Deleted ${rowsDeleted} records from Reviews` };
    } catch (err) {
      await transaction.rollback();
      console.error('Error deleting records from Reviews:', err);
      throw err;
    }
  } catch (err) {
    console.error('Error connecting to database:', err);
    throw err;
  }
}

deleteReviews();