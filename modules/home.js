const { poolPromise } = require("../config/db");
const { truncateDescription } = require("./truncate");

async function getBestRated() {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT TOP 10
        C.ContentID,
        B.BookID AS ItemID,
        'Book' AS ContentType,
        B.Title,
        B.Description,
        B.Image,
        B.Rating,
        STRING_AGG(G.Name, ', ') AS Genres
      FROM Content C
      INNER JOIN Books B ON C.BookID = B.BookID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G ON CG.GenreID = G.GenreID
      WHERE B.Rating IS NOT NULL
      GROUP BY C.ContentID, B.BookID, B.Title, B.Description, B.Image, B.Rating
      UNION ALL
      SELECT 
        C.ContentID,
        M.MovieID AS ItemID,
        'Movie' AS ContentType,
        M.Title,
        M.Description,
        M.Image,
        M.Rating,
        STRING_AGG(G.Name, ', ') AS Genres
      FROM Content C
      INNER JOIN Movies M ON C.MovieID = M.MovieID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G ON CG.GenreID = G.GenreID
      WHERE M.Rating IS NOT NULL
      GROUP BY C.ContentID, M.MovieID, M.Title, M.Description, M.Image, M.Rating
      UNION ALL
      SELECT 
        C.ContentID,
        G.GameID AS ItemID,
        'Game' AS ContentType,
        G.Title,
        G.Description,
        G.Image,
        G.Rating,
        STRING_AGG(G2.Name, ', ') AS Genres
      FROM Content C
      INNER JOIN Games G ON C.GameID = G.GameID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G2 ON CG.GenreID = G2.GenreID
      WHERE G.Rating IS NOT NULL
      GROUP BY C.ContentID, G.GameID, G.Title, G.Description, G.Image, G.Rating
      ORDER BY Rating DESC, ContentID DESC
    `);

    const items = result.recordset.map(row => ({
      id: row.ContentID,
      ItemID: row.ItemID,
      ContentType: row.ContentType,
      type: row.ContentType.toLowerCase() + 's',
      title: row.Title,
      description: truncateDescription(row.Description),
      fullDescription: row.Description || '',
      img: row.Image || '/images/placeholder.jpg',
      Genres: row.Genres ? row.Genres.split(', ').map(genre => genre.trim()) : [],
      rating: row.Rating || 0
    }));

    return items;
  } catch (error) {
    console.error('Error in getBestRated:', error);
    throw error;
  }
}

async function getRandomBooks() {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT TOP 10
        C.ContentID,
        B.BookID AS ItemID,
        'Book' AS ContentType,
        B.Title,
        B.Description,
        B.Image,
        STRING_AGG(G.Name, ', ') AS Genres
      FROM Content C
      INNER JOIN Books B ON C.BookID = B.BookID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G ON CG.GenreID = G.GenreID
      GROUP BY C.ContentID, B.BookID, B.Title, B.Description, B.Image
      ORDER BY NEWID()
    `);

    const items = result.recordset.map(row => ({
      id: row.ContentID,
      ItemID: row.ItemID,
      ContentType: row.ContentType,
      type: 'books',
      title: row.Title,
      description: truncateDescription(row.Description),
      img: row.Image || '/images/placeholder.jpg',
      Genres: row.Genres ? row.Genres.split(', ').map(genre => genre.trim()) : []
    }));

    return items;
  } catch (error) {
    console.error('Error in getRandomBooks:', error);
    throw error;
  }
}

async function getRandomMovies() {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT TOP 10
        C.ContentID,
        M.MovieID AS ItemID,
        'Movie' AS ContentType,
        M.Title,
        M.Description,
        M.Image,
        STRING_AGG(G.Name, ', ') AS Genres
      FROM Content C
      INNER JOIN Movies M ON C.MovieID = M.MovieID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G ON CG.GenreID = G.GenreID
      GROUP BY C.ContentID, M.MovieID, M.Title, M.Description, M.Image
      ORDER BY NEWID()
    `);

    const items = result.recordset.map(row => ({
      id: row.ContentID,
      ItemID: row.ItemID,
      ContentType: row.ContentType,
      type: 'movies',
      title: row.Title,
      description: truncateDescription(row.Description),
      img: row.Image || '/images/placeholder.jpg',
      Genres: row.Genres ? row.Genres.split(', ').map(genre => genre.trim()) : []
    }));

    return items;
  } catch (error) {
    console.error('Error in getRandomMovies:', error);
    throw error;
  }
}

async function getRandomGames() {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT TOP 10
        C.ContentID,
        G.GameID AS ItemID,
        'Game' AS ContentType,
        G.Title,
        G.Description,
        G.Image,
        STRING_AGG(G2.Name, ', ') AS Genres
      FROM Content C
      INNER JOIN Games G ON C.GameID = G.GameID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G2 ON CG.GenreID = G2.GenreID
      GROUP BY C.ContentID, G.GameID, G.Title, G.Description, G.Image
      ORDER BY NEWID()
    `);

    const items = result.recordset.map(row => ({
      id: row.ContentID,
      ItemID: row.ItemID,
      ContentType: row.ContentType,
      type: 'games',
      title: row.Title,
      description: truncateDescription(row.Description),
      img: row.Image || '/images/placeholder.jpg',
      Genres: row.Genres ? row.Genres.split(', ').map(genre => genre.trim()) : []
    }));

    return items;
  } catch (error) {
    console.error('Error in getRandomGames:', error);
    throw error;
  }
}

module.exports = {
  getBestRated,
  getRandomBooks,
  getRandomMovies,
  getRandomGames
};