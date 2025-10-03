const { sql, poolPromise } = require('../config/db'); // Adjust path if needed

async function clearGames() {
  let pool;
  try {
    pool = await poolPromise;
    console.log('Starting game data cleanup');

    // Begin transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Delete from Content_Genre for games
      const deleteContentGenre = await transaction.request().query(`
        DELETE FROM Content_Genre 
        WHERE ContentID IN (SELECT ContentID FROM Content WHERE GameID IS NOT NULL)
      `);
      console.log(`Deleted ${deleteContentGenre.rowsAffected[0]} Content_Genre entries`);

      // Delete from Content for games
      const deleteContent = await transaction.request().query(`
        DELETE FROM Content 
        WHERE GameID IS NOT NULL
      `);
      console.log(`Deleted ${deleteContent.rowsAffected[0]} Content entries`);

      // Delete from Games
      const deleteGames = await transaction.request().query(`
        DELETE FROM Games
      `);
      console.log(`Deleted ${deleteGames.rowsAffected[0]} Games entries`);

      // Commit transaction
      await transaction.commit();
      console.log('All game-related data cleared successfully');
    } catch (err) {
      // Rollback on error
      await transaction.rollback();
      throw new Error(`Transaction error: ${err.message}`);
    }
  } catch (err) {
    console.error('Error clearing games:', err.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('Database connection closed');
    }
  }
}

clearGames().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});