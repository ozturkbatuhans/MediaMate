const express = require('express');
const router = express.Router();
const axios = require('axios');
const {
  connect,
  close,
  getPopularMovies,
  insertGenres,
  insertMovies
} = require('./db'); // Gebruik functies uit db.js

// Route to import movies and genres from TMDB
router.get('/movies', async (req, res) => {
  let pool;
  try {
    pool = await connect(); // Establish database connection

    // Fetch genres from TMDB API
    const genresResponse = await axios.get('https://api.themoviedb.org/3/genre/movie/list', {
      params: {
        api_key: process.env.TMDB_API_KEY,
        language: 'en-US'
      }
    });

    const genres = genresResponse.data.genres;

    // Insert genres into the database
    await insertGenres(genres, pool);

    // Fetch popular movies from TMDB API
    const movies = await getPopularMovies();

    // Insert movies and their genre relationships
    await insertMovies(movies, pool);

    res.status(200).json({ message: '✅ Movies and genres have been successfully added to the database.' });

  } catch (err) {
    console.error('❌ Error during import:', err);
    res.status(500).json({ error: 'Import failed.' });
  } finally {
    if (pool) await close(); // Always close DB connection
  }
});

module.exports = router;