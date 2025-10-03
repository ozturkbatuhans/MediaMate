const sql = require('mssql');  // SQL Server module for interacting with the database
const axios = require('axios'); // Axios for making HTTP requests to the TMDB API
require('dotenv').config(); // Load environment variables from .env file

// Database configuration
const dbConfig = {
  server: process.env.DB_HOST,    // Host of your database server
  port: parseInt(process.env.DB_PORT), // Database port
  user: process.env.DB_USERNAME,  // Database username
  password: process.env.DB_PASSWORD,  // Database password
  database: process.env.DB_DATABASE,  // The name of your database
  options: {
    encrypt: false,  // Optional, depending on your setup (encrypt the connection)
    trustServerCertificate: true,  // Disable certificate checking
  }
};

// Function to connect to the database
async function connect() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("Connected to the database!");
    return pool;  // Return the database connection
  } catch (err) {
    console.error('Error connecting to the database:', err);
    throw err;  // Rethrow the error so it can be caught by the calling code
  }
}

// Function to close the database connection
async function close() {
  try {
    await sql.close();
    console.log("Database connection closed.");
  } catch (err) {
    console.error("Error closing the connection:", err);
  }
}

// Function to fetch popular movies from TMDB API
async function getPopularMovies() {
  try {
    let allMovies = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const response = await axios.get('https://api.themoviedb.org/3/movie/popular', {
        params: {
          api_key: process.env.TMDB_API_KEY,  // TMDB API key from .env file
          language: 'en-US',                  // Language settings
          page: page,                         // Specify the page number
        }
      });

      // Log de ruwe data die we ontvangen van de API
      console.log("Received response from TMDB:", response.data); // Dit logt de volledige API-response
      allMovies.push(...response.data.results); // Add results to the allMovies array
      totalPages = response.data.total_pages;   // Get the total number of pages
      page++;
    }

    return allMovies;  // Return the collected movies
  } catch (error) {
    console.error('Error fetching popular movies:', error.message);
    return [];  // Return an empty array in case of error
  }
}

// Function to insert genres into the Genres table
async function insertGenres(genres, pool) {
  try {
    for (const genre of genres) {
      const request = pool.request();
      request.input('GenreID', sql.Int, genre.id);
      request.input('Name', sql.VarChar(255), genre.name);

      // Log the query being executed
      const query = `
        IF NOT EXISTS (SELECT 1 FROM Genres WHERE GenreID = @GenreID)
        BEGIN
          INSERT INTO Genres (GenreID, Name) VALUES (@GenreID, @Name)
        END
      `;
      console.log('Executing query:', query);

      await request.query(query);  
    }
  } catch (error) {
    console.error('Error inserting genres:', error.message);
  }
}

// Function to insert movies into the Content table
async function insertMovies(movies, pool) {
  try {
    for (const movie of movies) {
      const movieRequest = pool.request();
      movieRequest.input('ContentID', sql.Int, movie.id);
      movieRequest.input('Title', sql.VarChar(255), movie.title);
      movieRequest.input('ContentType', sql.VarChar(10), 'Film');  // Set 'Film' in ContentType
      movieRequest.input('Description', sql.VarChar(300), movie.overview || '');
      movieRequest.input('ReleaseDate', sql.Date, movie.release_date || null);

      // Log the query being executed
      const movieQuery = `
        IF NOT EXISTS (SELECT 1 FROM Content WHERE ContentID = @ContentID)
        BEGIN
          INSERT INTO Content (ContentID, Title, ContentType, Description, ReleaseDate)
          VALUES (@ContentID, @Title, @ContentType, @Description, @ReleaseDate)
        END
      `;
      console.log('Executing movie insert query:', movieQuery);

      await movieRequest.query(movieQuery);  // Execute the query

      // Insert the genre relationships for the movie into the Content_Genre table
      const contentGenres = movie.genre_ids;
      for (const genreID of contentGenres) {
        const contentGenreRequest = pool.request();
        contentGenreRequest.input('ContentID', sql.Int, movie.id);
        contentGenreRequest.input('GenreID', sql.Int, genreID);

        // Log the query being executed
        const genreQuery = `
          IF NOT EXISTS (SELECT 1 FROM Content_Genre WHERE ContentID = @ContentID AND GenreID = @GenreID)
          BEGIN
            INSERT INTO Content_Genre (ContentID, GenreID)
            VALUES (@ContentID, @GenreID)
          END
        `;
        console.log('Executing genre insert query:', genreQuery);

        await contentGenreRequest.query(genreQuery);  // Execute the query
      }
    }
  } catch (error) {
    console.error('Error inserting movies:', error.message);
  }
}


// Export the functions so they can be used in other files
module.exports = {
  connect,
  close,
  getPopularMovies,
  insertGenres,
  insertMovies
};