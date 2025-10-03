const { sql, poolPromise } = require('../config/db.js');

async function updateRatings() {
    let pool;
    try {
        // Get the connection pool
        pool = await poolPromise;

        // SQL queries to update Ratings to NULL
        const queries = [
            `
            UPDATE Books
            SET Rating = NULL
            WHERE BookID IN (
                SELECT BookID 
                FROM Content 
                WHERE ContentID IN (493, 1009, 7254) 
                AND BookID IS NOT NULL
            )
            `,
            `
            UPDATE Movies
            SET Rating = NULL
            WHERE MovieID IN (
                SELECT MovieID 
                FROM Content 
                WHERE ContentID IN (493, 1009, 7254) 
                AND MovieID IS NOT NULL
            )
            `,
            `
            UPDATE Games
            SET Rating = NULL
            WHERE GameID IN (
                SELECT GameID 
                FROM Content 
                WHERE ContentID IN (493, 1009, 7254) 
                AND GameID IS NOT NULL
            )
            `
        ];

        // Execute each query
        for (const query of queries) {
            const result = await pool.request().query(query);
            console.log(`Query executed successfully, rows affected: ${result.rowsAffected}`);
        }

        console.log('All ratings updated successfully.');
    } catch (err) {
        console.error('Error executing queries:', err);
    }
}

// Run the script
updateRatings();