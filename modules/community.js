const { sql, poolPromise } = require('../config/db');

async function getCommunities() {
  console.log('getCommunities: Fetching random communities');
  try {
    const pool = await poolPromise;
    const query = `
      SELECT 
        RoomID,
        ChatName,
        Keywords,
        Image,
        CreatorID
      FROM Communities
      ORDER BY NEWID()
    `;
    console.log(`Executing query: ${query}`);
    const result = await pool.request().query(query);
    console.log(`Query returned ${result.recordset.length} communities`);

    const communities = result.recordset.map(item => ({
      RoomID: item.RoomID,
      ChatName: item.ChatName,
      Keywords: item.Keywords || '',
      Image: item.Image,
      CreatorID: item.CreatorID
    }));

    console.log(`Returning ${communities.length} communities`);
    return communities;
  } catch (err) {
    console.error(`Error fetching communities: ${err.message}`, err);
    return [];
  }
}

async function createCommunity(ChatName, Keywords, Image, CreatorID) {
  console.log("🚀 Inserting to DB...");
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('ChatName', sql.NVarChar(30), ChatName)
      .input('Keywords', sql.NVarChar(150), Keywords)
      .input('Image', sql.NVarChar(255), Image)
      .input('CreatorID', sql.Int, CreatorID)
      .query(`
        INSERT INTO Communities (ChatName, Keywords, Image, CreatorID)
        VALUES (@ChatName, @Keywords, @Image, @CreatorID)
      `);
    console.log(`Community created: ${ChatName}`);
  } catch (err) {
    console.error(`Error creating community: ${err.message}`, err);
    throw err;
  }
}


module.exports = { getCommunities, createCommunity };