const { sql, poolPromise } = require('../config/db.js');

async function getFirst20Games() {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM Content WHERE ContentID = 6228');
    
    console.log(result.recordset);
    return result.recordset;
  } catch (err) {
    console.error('Error fetching games:', err);
    throw err;
  }
}

getFirst20Games();