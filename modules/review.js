const { poolPromise, sql } = require('../config/db');

async function submitOrUpdateReviewByContentId(contentId, userId, rating, comment) {
  const pool = await poolPromise;

  // Step 1: Confirm ContentID exists and get original IDs
  const contentRes = await pool.request()
    .input('ContentID', sql.Int, contentId)
    .query('SELECT BookID, MovieID, GameID FROM Content WHERE ContentID = @ContentID');

  if (contentRes.recordset.length === 0) {
    throw new Error(`Content with ID ${contentId} does not exist`);
  }

  const { BookID, MovieID, GameID } = contentRes.recordset[0];

  let table, column, originalId;

  if (BookID) {
    table = 'Books';
    column = 'BookID';
    originalId = BookID;
  } else if (MovieID) {
    table = 'Movies';
    column = 'MovieID';
    originalId = MovieID;
  } else if (GameID) {
    table = 'Games';
    column = 'GameID';
    originalId = GameID;
  } else {
    throw new Error(`ContentID ${contentId} does not link to a valid content type`);
  }

  // Step 2: Insert or update review for this ContentID & UserID
  const reviewDate = new Date();

  const existingReview = await pool.request()
    .input('ContentID', sql.Int, contentId)
    .input('UserID', sql.Int, userId)
    .query('SELECT ReviewID FROM Reviews WHERE ContentID = @ContentID AND UserID = @UserID');

  if (existingReview.recordset.length > 0) {
    await pool.request()
      .input('Rating', sql.Decimal(2, 1), rating)
      .input('Comment', sql.NVarChar(sql.MAX), comment)
      .input('ReviewDate', sql.DateTime, reviewDate)
      .input('ContentID', sql.Int, contentId)
      .input('UserID', sql.Int, userId)
      .query(`
        UPDATE Reviews
        SET Rating = @Rating, Comment = @Comment, ReviewDate = @ReviewDate
        WHERE ContentID = @ContentID AND UserID = @UserID
      `);
  } else {
    await pool.request()
      .input('UserID', sql.Int, userId)
      .input('ContentID', sql.Int, contentId)
      .input('Rating', sql.Decimal(2, 1), rating)
      .input('Comment', sql.NVarChar(sql.MAX), comment)
      .input('ReviewDate', sql.DateTime, reviewDate)
      .query(`
        INSERT INTO Reviews (UserID, ContentID, Rating, Comment, ReviewDate)
        VALUES (@UserID, @ContentID, @Rating, @Comment, @ReviewDate)
      `);
  }

  // Step 3: Update average rating in the original content table
  await pool.request()
    .input('OriginalId', sql.Int, originalId)
    .query(`
      UPDATE ${table}
      SET Rating = avgRatings.AvgRating
      FROM ${table}
      JOIN Content c ON c.${column} = ${table}.${column}
      JOIN (
        SELECT ContentID, AVG(CAST(Rating AS FLOAT)) AS AvgRating
        FROM Reviews
        GROUP BY ContentID
      ) avgRatings ON avgRatings.ContentID = c.ContentID
      WHERE c.${column} = @OriginalId
    `);
}

module.exports = {
  submitOrUpdateReviewByContentId
};















