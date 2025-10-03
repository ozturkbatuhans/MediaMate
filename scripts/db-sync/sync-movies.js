require('dotenv').config();
const axios = require('axios');
const striptags = require('striptags');
const { sql, poolPromise } = require('../../config/db');

async function fetchWithRetry(url, params, retries = 3, delay = 100) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.get(url, { params });
            return response;
        } catch (error) {
            if (error.response && [429, 502, 503].includes(error.response.status)) {
                if (attempt === retries) {
                    throw new Error(`Failed after ${retries} attempts: ${error.message} (Status: ${error.response.status})`);
                }
                console.log(`Attempt ${attempt} failed with status ${error.response.status} for URL ${url}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw new Error(`Request failed: ${error.message}`);
            }
        }
    }
}

async function main() {
    let pool;
    try {
        pool = await poolPromise;
        console.log('Connected to SQL Server.');
    } catch (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }

    try {
        // Insert admin user if not exists
        const userResult = await pool.request()
            .input('Username', sql.NVarChar, 'Admin')
            .input('Email', sql.NVarChar, null)
            .input('PasswordHash', sql.NVarChar, 'Tp:r7576jX')
            .input('UserType', sql.NVarChar, 'Admin')
            .query(`
                IF NOT EXISTS (SELECT 1 FROM Users WHERE Username = @Username)
                INSERT INTO Users (Username, Email, PasswordHash, UserType)
                OUTPUT INSERTED.UserID
                VALUES (@Username, @Email, @PasswordHash, @UserType)
                ELSE
                SELECT UserID FROM Users WHERE Username = @Username
            `);
        const addedByUserID = userResult.recordset[0].UserID;

        const movieGenres = [
            'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
            'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
            'Romance', 'Sci-Fi', 'Sport', 'Thriller', 'War', 'Western'
        ];

        const tmdbGenreMap = {
            28: 'Action',
            12: 'Adventure',
            16: 'Animation',
            35: 'Comedy',
            80: 'Crime',
            99: 'Documentary',
            18: 'Drama',
            10751: 'Family',
            14: 'Fantasy',
            36: 'History',
            27: 'Horror',
            10402: 'Music',
            9648: 'Mystery',
            10749: 'Romance',
            878: 'Sci-Fi',
            35: 'Sport', // Fallback to Comedy for Sport
            53: 'Thriller',
            10752: 'War',
            37: 'Western'
        };

        // Cache GenreIDs
        const genreIdCache = new Map();
        for (const genre of movieGenres) {
            const genreResult = await pool.request()
                .input('Name', sql.NVarChar, genre)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM Genres WHERE Name = @Name)
                    INSERT INTO Genres (Name) VALUES (@Name);
                    SELECT GenreID FROM Genres WHERE Name = @Name
                `);
            genreIdCache.set(genre, genreResult.recordset[0].GenreID);
        }

        const processedMovies = new Set();
        const moviesPerGenre = new Map(movieGenres.map(g => [g, 0]));
        let totalMoviesInserted = 0;
        const targetMoviesPerGenre = 263; // 5000 ÷ 19 ≈ 263
        const targetTotalMovies = 5000;

        for (const genre of movieGenres) {
            let moviesInsertedForGenre = 0;
            const tmdbGenreId = Object.keys(tmdbGenreMap).find(key => tmdbGenreMap[key] === genre) || 35;

            for (let page = 1; page <= 10; page++) {
                for (const sortBy of ['popularity.desc', 'release_date.desc']) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 100));

                        const params = {
                            api_key: 'c6fbfed994de21544500c97199ead40d', // Updated API key
                            language: 'en-US',
                            page,
                            with_genres: tmdbGenreId,
                            sort_by: sortBy
                        };

                        const response = await fetchWithRetry('https://api.themoviedb.org/3/discover/movie', params);
                        const movies = response.data.results || [];

                        if (movies.length === 0) {
                            console.log(`No movies found for genre "${genre}" on page ${page} (sort: ${sortBy}).`);
                            break;
                        }

                        for (const movie of movies) {
                            const title = movie.title?.trim() || 'Unknown Title';

                            if (processedMovies.has(title)) {
                                console.log(`Movie "${title}" already processed, skipping.`);
                                continue;
                            }

                            const existingMovie = await pool.request()
                                .input('Title', sql.NVarChar, title)
                                .query('SELECT MovieID FROM Movies WHERE Title = @Title');
                            if (existingMovie.recordset.length > 0) {
                                console.log(`Movie "${title}" already exists in database, skipping.`);
                                processedMovies.add(title);
                                continue;
                            }

                            let description = movie.overview || 'No description';
                            description = striptags(description);
                            if (description.length > 2000) {
                                console.log(`Truncating description for movie "${title}": Original length: ${description.length}`);
                                description = description.substring(0, 2000);
                            }

                            let releaseDate = movie.release_date || null;
                            if (releaseDate) {
                                if (/^\d{4}$/.test(releaseDate)) {
                                    releaseDate = `${releaseDate}-01-01`;
                                } else if (/^\d{4}-\d{2}$/.test(releaseDate)) {
                                    releaseDate = `${releaseDate}-01`;
                                } else if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
                                    console.log(`Invalid date format for movie "${title}": ${releaseDate}, setting to NULL`);
                                    releaseDate = null;
                                }
                                if (releaseDate) {
                                    const dateObj = new Date(releaseDate);
                                    if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 1 || dateObj.getFullYear() > 9999) {
                                        console.log(`Invalid date for movie "${title}": ${releaseDate}, setting to NULL`);
                                        releaseDate = null;
                                    }
                                }
                            }

                            const imageUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;

                            const movieResult = await pool.request()
                                .input('Title', sql.NVarChar, title)
                                .input('Description', sql.NVarChar, description)
                                .input('ReleaseDate', sql.Date, releaseDate)
                                .input('Image', sql.NVarChar, imageUrl)
                                .input('AddedByUserID', sql.Int, addedByUserID)
                                .query(`
                                    INSERT INTO Movies (Title, Description, ReleaseDate, Rating, Image, AddedByUserID)
                                    OUTPUT INSERTED.MovieID
                                    VALUES (@Title, @Description, @ReleaseDate, NULL, @Image, @AddedByUserID)
                                `);

                            const movieId = movieResult.recordset[0].MovieID;

                            const contentResult = await pool.request()
                                .input('MovieID', sql.Int, movieId)
                                .query(`
                                    INSERT INTO Content (MovieID)
                                    OUTPUT INSERTED.ContentID
                                    VALUES (@MovieID)
                                `);

                            const contentId = contentResult.recordset[0].ContentID;

                            const movieGenresFromApi = movie.genre_ids
                                .map(id => tmdbGenreMap[id])
                                .filter(g => g && movieGenres.includes(g));
                            if (movieGenresFromApi.length > 0) {
                                const values = movieGenresFromApi
                                    .map(g => `(${genreIdCache.get(g)}, ${contentId})`)
                                    .join(', ');
                                await pool.request()
                                    .query(`
                                        INSERT INTO Content_Genre (GenreID, ContentID)
                                        VALUES ${values}
                                    `);
                            }

                            moviesInsertedForGenre++;
                            totalMoviesInserted++;
                            processedMovies.add(title);
                            moviesPerGenre.set(genre, moviesInsertedForGenre);

                            if (totalMoviesInserted % 100 === 0) {
                                console.log(`Progress: ${totalMoviesInserted}/${targetTotalMovies} movies inserted.`);
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching movies for genre "${genre}" on page ${page} (sort: ${sortBy}):`, error.message);
                        break;
                    }
                }
            }

            if (moviesInsertedForGenre < targetMoviesPerGenre) {
                console.log(`Genre "${genre}" yielded ${moviesInsertedForGenre} movies, shortfall of ${targetMoviesPerGenre - moviesInsertedForGenre}.`);
            }
        }

        // Shortfall compensation
        let shortfall = targetTotalMovies - totalMoviesInserted;
        if (shortfall > 0) {
            console.log(`Total movies inserted: ${totalMoviesInserted}, shortfall: ${shortfall}. Fetching additional movies...`);

            const highYieldGenres = ['Action', 'Drama', 'Thriller'];
            let page = 11;

            for (const genre of highYieldGenres) {
                if (shortfall <= 0) break;

                const tmdbGenreId = Object.keys(tmdbGenreMap).find(key => tmdbGenreMap[key] === genre) || 35;
                const maxShortfallPages = Math.min(20, Math.ceil(shortfall / 20 / 3));

                for (let i = 0; i < maxShortfallPages && shortfall > 0; i++) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 100));

                        const params = {
                            api_key: 'c6fbfed994de21544500c97199ead40d', // Updated API key
                            language: 'en-US',
                            page,
                            with_genres: tmdbGenreId,
                            sort_by: 'popularity.desc'
                        };

                        const response = await fetchWithRetry('https://api.themoviedb.org/3/discover/movie', params);
                        const movies = response.data.results || [];

                        if (movies.length === 0) {
                            console.log(`No more movies found for genre "${genre}" on page ${page} for shortfall.`);
                            break;
                        }

                        for (const movie of movies) {
                            const title = movie.title?.trim() || 'Unknown Title';

                            if (processedMovies.has(title)) {
                                console.log(`Movie "${title}" already processed, skipping.`);
                                continue;
                            }

                            const existingMovie = await pool.request()
                                .input('Title', sql.NVarChar, title)
                                .query('SELECT MovieID FROM Movies WHERE Title = @Title');
                            if (existingMovie.recordset.length > 0) {
                                console.log(`Movie "${title}" already exists in database, skipping.`);
                                processedMovies.add(title);
                                continue;
                            }

                            let description = movie.overview || 'No description';
                            description = striptags(description);
                            if (description.length > 2000) {
                                console.log(`Truncating description for movie "${title}": Original length: ${description.length}`);
                                description = description.substring(0, 2000);
                            }

                            let releaseDate = movie.release_date || null;
                            if (releaseDate) {
                                if (/^\d{4}$/.test(releaseDate)) {
                                    releaseDate = `${releaseDate}-01-01`;
                                } else if (/^\d{4}-\d{2}$/.test(releaseDate)) {
                                    releaseDate = `${releaseDate}-01`;
                                } else if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
                                    console.log(`Invalid date format for movie "${title}": ${releaseDate}, setting to NULL`);
                                    releaseDate = null;
                                }
                                if (releaseDate) {
                                    const dateObj = new Date(releaseDate);
                                    if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 1 || dateObj.getFullYear() > 9999) {
                                        console.log(`Invalid date for movie "${title}": ${releaseDate}, setting to NULL`);
                                        releaseDate = null;
                                    }
                                }
                            }

                            const imageUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;

                            const movieResult = await pool.request()
                                .input('Title', sql.NVarChar, title)
                                .input('Description', sql.NVarChar, description)
                                .input('ReleaseDate', sql.Date, releaseDate)
                                .input('Image', sql.NVarChar, imageUrl)
                                .input('AddedByUserID', sql.Int, addedByUserID)
                                .query(`
                                    INSERT INTO Movies (Title, Description, ReleaseDate, Rating, Image, AddedByUserID)
                                    OUTPUT INSERTED.MovieID
                                    VALUES (@Title, @Description, @ReleaseDate, NULL, @Image, @AddedByUserID)
                                `);

                            const movieId = movieResult.recordset[0].MovieID;

                            const contentResult = await pool.request()
                                .input('MovieID', sql.Int, movieId)
                                .query(`
                                    INSERT INTO Content (MovieID)
                                    OUTPUT INSERTED.ContentID
                                    VALUES (@MovieID)
                                `);

                            const contentId = contentResult.recordset[0].ContentID;

                            const movieGenresFromApi = movie.genre_ids
                                .map(id => tmdbGenreMap[id])
                                .filter(g => g && movieGenres.includes(g));
                            if (movieGenresFromApi.length > 0) {
                                const values = movieGenresFromApi
                                    .map(g => `(${genreIdCache.get(g)}, ${contentId})`)
                                    .join(', ');
                                await pool.request()
                                    .query(`
                                        INSERT INTO Content_Genre (GenreID, ContentID)
                                        VALUES ${values}
                                    `);
                            }

                            totalMoviesInserted++;
                            shortfall--;
                            moviesPerGenre.set(genre, moviesPerGenre.get(genre) + 1);
                            processedMovies.add(title);

                            if (totalMoviesInserted % 100 === 0) {
                                console.log(`Progress: ${totalMoviesInserted}/${targetTotalMovies} movies inserted.`);
                            }

                            if (shortfall <= 0) break;
                        }
                    } catch (error) {
                        console.error(`Error fetching shortfall movies for genre "${genre}" on page ${page}:`, error.message);
                        break;
                    }
                    page++;
                }
            }

            console.log(`After compensation, total movies inserted: ${totalMoviesInserted}, remaining shortfall: ${shortfall}.`);
        }

        console.log('Movies inserted per genre:', Object.fromEntries(moviesPerGenre));
        console.log(`Total movies inserted: ${totalMoviesInserted}`);
    } catch (error) {
        console.error('Error in main process:', error.message);
    } finally {
        await pool.close();
    }
}

main().catch(console.error);