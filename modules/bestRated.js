const { poolPromise } = require('../config/db');
const { truncateDescription } = require('./truncate');
const { truncateTitle } = require('./truncateTitle');

async function getTopRatedBooks(limit = 10) {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT TOP (${limit})
      C.ContentID,
      B.BookID AS ItemID,
      B.Title,
      B.Description,
      B.Image,
      B.Rating,
      STRING_AGG(G.Name, ', ') AS Genres
    FROM Content C
    JOIN Books B ON C.BookID = B.BookID
    LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
    LEFT JOIN Genres G ON CG.GenreID = G.GenreID
    WHERE B.Rating IS NOT NULL
    GROUP BY C.ContentID, B.BookID, B.Title, B.Description, B.Image, B.Rating
    ORDER BY B.Rating DESC, B.BookID DESC
  `);

  return result.recordset.map(row => ({
    id: row.ContentID,
    name: truncateTitle(row.Title),
    image: row.Image || '/images/placeholder.jpg',
    rating: row.Rating,
    description: truncateDescription(row.Description),
    Genres: row.Genres ? row.Genres.split(', ').map(genre => genre.trim()) : [],
    ContentType: 'Book',
    type: 'books'
  }));
}

async function getTopRatedMovies(limit = 10) {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT TOP (${limit})
      C.ContentID,
      M.MovieID AS ItemID,
      M.Title,
      M.Description,
      M.Image,
      M.Rating,
      STRING_AGG(G.Name, ', ') AS Genres
    FROM Content C
    JOIN Movies M ON C.MovieID = M.MovieID
    LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
    LEFT JOIN Genres G ON CG.GenreID = G.GenreID
    WHERE M.Rating IS NOT NULL
    GROUP BY C.ContentID, M.MovieID, M.Title, M.Description, M.Image, M.Rating
    ORDER BY M.Rating DESC, M.MovieID DESC
  `);

  return result.recordset.map(row => ({
    id: row.ContentID,
    name: truncateTitle(row.Title),
    image: row.Image || '/images/placeholder.jpg',
    rating: row.Rating,
    description: truncateDescription(row.Description),
    Genres: row.Genres ? row.Genres.split(', ').map(genre => genre.trim()) : [],
    ContentType: 'Movie',
    type: 'movies'
  }));
}

async function getTopRatedGames(limit = 10) {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT TOP (${limit})
      C.ContentID,
      G.GameID AS ItemID,
      G.Title,
      G.Description,
      G.Image,
      G.Rating,
      STRING_AGG(G2.Name, ', ') AS Genres
    FROM Content C
    JOIN Games G ON C.GameID = G.GameID
    LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
    LEFT JOIN Genres G2 ON CG.GenreID = G2.GenreID
    WHERE G.Rating IS NOT NULL
    GROUP BY C.ContentID, G.GameID, G.Title, G.Description, G.Image, G.Rating
    ORDER BY G.Rating DESC, G.GameID DESC
  `);

  return result.recordset.map(row => ({
    id: row.ContentID,
    name: truncateTitle(row.Title),
    image: row.Image || '/images/placeholder.jpg',
    rating: row.Rating,
    description: truncateDescription(row.Description),
    Genres: row.Genres ? row.Genres.split(', ').map(genre => genre.trim()) : [],
    ContentType: 'Game',
    type: 'games'
  }));
}

module.exports = {
  getTopRatedBooks,
  getTopRatedMovies,
  getTopRatedGames
};