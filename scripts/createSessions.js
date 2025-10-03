const { sql, poolPromise } = require('../config/db');

async function createSessionsTable() {
  try {
    const pool = await poolPromise;

    const createTableQuery = `
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'sessions'
      )
      BEGIN
        CREATE TABLE [dbo].[sessions] (
          [sid] NVARCHAR(255) NOT NULL PRIMARY KEY,
          [expires] DATETIME NOT NULL,
          [session] NVARCHAR(MAX)
        )
      END
    `;

    await pool.request().query(createTableQuery);
    console.log('✅ sessions table created or already exists.');
  } catch (err) {
    console.error('❌ Error creating sessions table:', err);
  } finally {
    sql.close();
  }
}

createSessionsTable();
