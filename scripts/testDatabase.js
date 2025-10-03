const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  }
};

async function testDatabaseConnection() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log('✅ Connected to the database');

    await sql.close();
    console.log('🔒 Connection closed');
  } catch (err) {
    console.error('❌ Database connection failed:', err);
  }
}

testDatabaseConnection();