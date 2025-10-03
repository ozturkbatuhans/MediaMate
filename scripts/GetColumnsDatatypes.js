const { sql, poolPromise } = require('../config/db'); // adjust if your config file is named differently

const tableName = 'Favorites'; // change this to your table name
const schemaName = 'dbo'; // adjust if your table is under a different schema

async function getColumnsWithTypes() {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('tableName', sql.VarChar, tableName)
      .input('schemaName', sql.VarChar, schemaName)
      .query(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName AND TABLE_SCHEMA = @schemaName
        ORDER BY ORDINAL_POSITION
      `);

    console.log(`Kolommen in "${schemaName}.${tableName}":`);
    result.recordset.forEach(row => {
      console.log(`- ${row.COLUMN_NAME}: ${row.DATA_TYPE}`);
    });
  } catch (err) {
    console.error('Fout bij ophalen van kolommen:', err.message);
  }
}

getColumnsWithTypes();