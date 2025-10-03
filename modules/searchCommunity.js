const { sql, poolPromise } = require('../config/db');

async function searchCommunities(searchQuery) {
  console.log(`searchCommunities: searchQuery=${searchQuery}`);
  try {
    const pool = await poolPromise;
    let query = `
      SELECT 
        RoomID,
        ChatName,
        Keywords,
        Image,
        CreatorID
      FROM Communities
    `;
    const params = {};
    let communities = [];

    if (searchQuery.trim()) {
      const keywords = searchQuery.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
      console.log(`Keywords parsed: ${keywords}`);
      if (keywords.length > 0) {
        const keywordConditions = keywords.map((_, i) => `LOWER(Keywords) LIKE @keyword${i}`).join(' OR ');
        const chatNameConditions = keywords.map((_, i) => `LOWER(ChatName) LIKE @keyword${i}`).join(' OR ');
        
        query += `
          WHERE (${keywordConditions}) OR (${chatNameConditions})
          ORDER BY 
            (
              ${keywords.map((_, i) => `CASE WHEN LOWER(Keywords) LIKE @keyword${i} THEN 1 ELSE 0 END`).join(' + ')}
            ) DESC,
            (
              ${keywords.map((_, i) => `CASE WHEN LOWER(ChatName) LIKE @keyword${i} THEN 1 ELSE 0 END`).join(' + ')}
            ) DESC
        `;

        keywords.forEach((keyword, i) => {
          params[`keyword${i}`] = `%${keyword}%`;
          console.log(`Parameter @keyword${i}: %${keyword}%`);
        });

        console.log(`Executing query: ${query}`);
        const request = pool.request();
        for (const [key, value] of Object.entries(params)) {
          request.input(key, sql.NVarChar, value);
        }

        const result = await request.query(query);
        console.log(`Query returned ${result.recordset.length} communities`);

        communities = result.recordset.map(item => ({
          RoomID: item.RoomID,
          ChatName: item.ChatName,
          Keywords: item.Keywords || '',
          Image: item.Image,
          CreatorID: item.CreatorID
        }));
      }
    } else {
      console.log('No search query provided, returning empty results');
    }

    console.log(`Returning ${communities.length} communities`);
    return communities;
  } catch (err) {
    console.error(`Error searching communities: ${err.message}`, err);
    return [];
  }
}

module.exports = { searchCommunities };