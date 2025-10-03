const { sql, poolPromise } = require('../config/db.js');

async function getUsers() {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query('SELECT * FROM Communities');
    
    console.log(result.recordset);
    return result.recordset;
  } catch (err) {
    console.error('Error fetching users:', err);
    throw err;
  }
}

getUsers();