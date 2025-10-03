const { sql, poolPromise } = require('../config/db'); // adjust path as needed

const indexQueries = [
  // Content Table
  `CREATE NONCLUSTERED INDEX IX_Content_BookID ON Content(BookID);`,
  `CREATE NONCLUSTERED INDEX IX_Content_MovieID ON Content(MovieID);`,
  `CREATE NONCLUSTERED INDEX IX_Content_GameID ON Content(GameID);`,

  // Reviews Table
  `CREATE NONCLUSTERED INDEX IX_Reviews_ContentID ON Reviews(ContentID);`,
  `CREATE NONCLUSTERED INDEX IX_Reviews_UserID ON Reviews(UserID);`,

  // Favorites Table
  `CREATE NONCLUSTERED INDEX IX_Favorites_UserID ON Favorites(UserID);`,
  `CREATE NONCLUSTERED INDEX IX_Favorites_ContentID ON Favorites(ContentID);`,
  `CREATE NONCLUSTERED INDEX IX_Favorites_ChatID ON Favorites(ChatRooms_ChatID);`,

  // Requests Table
  `CREATE NONCLUSTERED INDEX IX_Requests_UserID ON Requests(UserID);`,

  // Messages Table
  `CREATE NONCLUSTERED INDEX IX_Messages_ChatID ON Messages(ChatID);`,
  `CREATE NONCLUSTERED INDEX IX_Messages_FromUser ON Messages(FromUser);`
];

async function createIndexes() {
  try {
    const pool = await poolPromise;

    for (const query of indexQueries) {
      try {
        console.log(`Running: ${query}`);
        await pool.request().query(query);
        console.log('✔️  Index created or already exists.');
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.warn(`⚠️  Index already exists, skipping.`);
        } else {
          console.error(`❌ Failed to create index:`, err.message);
        }
      }
    }

    console.log('✅ All indexing complete.');
  } catch (err) {
    console.error('❌ Database error:', err);
  }
}

createIndexes();