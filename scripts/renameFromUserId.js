const { sql, poolPromise } = require('../config/db.js');

async function renameFromUserID() {
  try {
    // Get a connection from the pool
    const pool = await poolPromise;
    
    // Drop the foreign key constraint
    console.log('Dropping foreign key constraint Messages_Users_FK...');
    await pool.request().query(`
      ALTER TABLE Messages DROP CONSTRAINT Messages_Users_FK
    `);
    
    // Rename the column
    console.log('Renaming FromUserID to FromUser...');
    await pool.request().query(`
      EXEC sp_rename 'Messages.FromUserID', 'FromUser', 'COLUMN'
    `);
    
    // Recreate the foreign key constraint
    console.log('Recreating foreign key constraint...');
    await pool.request().query(`
      ALTER TABLE Messages 
      ADD CONSTRAINT Messages_Users_FK 
      FOREIGN KEY (FromUser) REFERENCES Users (UserID) 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);
    
    console.log('Column renamed successfully.');
  } catch (err) {
    console.error('Error renaming column:', err);
    throw err;
  } finally {
    // Close the connection pool
    await sql.close();
  }
}

// Execute the script
renameFromUserID()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });