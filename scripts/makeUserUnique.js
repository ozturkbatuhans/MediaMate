const { poolPromise } = require("../config/db.js"); // your existing db config
const sql = require("mssql");

async function checkForDuplicateUsernames() {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT Username, COUNT(*) AS Count
      FROM Users
      GROUP BY Username
      HAVING COUNT(*) > 1
    `);

    if (result.recordset.length > 0) {
      console.log("There are duplicate usernames. Please resolve the following:");
      console.table(result.recordset);
      return false; // Duplicates found, constraint can't be applied yet
    }

    return true; // No duplicates found
  } catch (err) {
    console.error("Error checking for duplicate usernames:", err);
    return false;
  }
}

async function makeUsernameUnique() {
  const areUsernamesUnique = await checkForDuplicateUsernames();
  if (!areUsernamesUnique) {
    console.error("Cannot proceed with unique constraint due to duplicate usernames.");
    return;
  }

  try {
    const pool = await poolPromise;
    // Add unique constraint on the Username column
    const result = await pool.request().query(`
      ALTER TABLE Users
      ADD CONSTRAINT UQ_Users_Username UNIQUE (Username)
    `);

    console.log("Username column is now unique!");
  } catch (err) {
    console.error("Error adding unique constraint on Username:", err);
  }
}

makeUsernameUnique()
  .then(() => console.log("Operation complete"))
  .catch((err) => console.error("Error during operation:", err));
