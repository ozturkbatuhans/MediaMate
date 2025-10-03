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
      if (error.response && (error.response.status === 429 || error.response.status === 502 || error.response.status === 503)) {
        if (attempt === retries) {
          throw new Error(`Failed after ${retries} attempts: ${error.message} (Status: ${error.response?.status})`);
        }
        console.log(`Attempt ${attempt} failed with status ${error.response.status} for URL ${url}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`Request failed: ${error.message} (Status: ${error.response?.status || 'N/A'})`);
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
    `);
  const addedByUserID = userResult.recordset && userResult.recordset.length > 0 ? userResult.recordset[0].UserID : 1;

  const gameGenres = [
    'Action', 'Adventure', 'RPG', 'Shooter', 'Strategy', 'Simulation',
    'Puzzle', 'Arcade', 'Platformer', 'Sports', 'Fighting', 'Racing',
    'Multiplayer', 'Battle Royale', 'MOBA', 'Survival', 'Open World',
    'Sandbox', 'Horror', 'Stealth', 'Visual Novel', 'Idle', 'Card Game',
    'Board Game', 'Trivia', 'Music', 'Educational'
  ];

  const rawgGenreMap = {
    'action': 'Action',
    'adventure': 'Adventure',
    'role-playing-games-rpg': 'RPG',
    'shooter': 'Shooter',
    'strategy': 'Strategy',
    'simulation': 'Simulation',
    'puzzle': 'Puzzle',
    'arcade': 'Arcade',
    'platformer': 'Platformer',
    'sports': 'Sports',
    'fighting': 'Fighting',
    'racing': 'Racing',
    'massively-multiplayer': 'Multiplayer',
    'battle-royale': 'Battle Royale',
    'moba': 'MOBA',
    'survival': 'Survival',
    'open-world': 'Open World',
    'sandbox': 'Sandbox',
    'horror': 'Horror',
    'stealth': 'Stealth',
    'visual-novel': 'Visual Novel',
    'indie': 'Idle',
    'card': 'Card Game',
    'board-games': 'Board Game',
    'educational': 'Educational',
    'music': 'Music'
  };

  // Cache GenreIDs
  const genreIdCache = {};
  for (const genre of gameGenres) {
    const genreIdResult = await pool.request()
      .input('Name', sql.NVarChar, genre)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM Genres WHERE Name = @Name)
        INSERT INTO Genres (Name) VALUES (@Name);
        SELECT GenreID FROM Genres WHERE Name = @Name
      `);
    genreIdCache[genre] = genreIdResult.recordset[0].GenreID;
  }

  const processedGames = new Set();
  const gamesPerGenre = {};
  let totalGamesInserted = 0;
  const targetGamesPerGenre = 200;
  const targetTotalGames = gameGenres.length * targetGamesPerGenre;

  for (const genre of gameGenres) {
    let gamesInsertedForGenre = 0;

    for (let page = 1; page <= 5; page++) {
      try {
        // Reduced delay to align with RAWG rate limits (~60 req/min)
        await new Promise(resolve => setTimeout(resolve, 100));

        const params = {
          key: 'f161c5ceeac2444a950ccf2fe1cdebb4',
          page: page,
          page_size: 40
        };
        const rawgGenreSlug = Object.keys(rawgGenreMap).find(key => rawgGenreMap[key] === genre);
        if (['battle-royale', 'moba', 'open-world', 'horror', 'visual-novel', 'music', 'survival', 'sandbox', 'stealth'].includes(rawgGenreSlug)) {
          params.tags = rawgGenreSlug;
        } else {
          params.genres = rawgGenreSlug;
        }

        const response = await fetchWithRetry('https://api.rawg.io/api/games', params);
        const games = response.data.results || [];

        if (games.length === 0) {
          console.log(`No games found for genre "${genre}" on page ${page}.`);
          break;
        }

        for (const game of games) {
          const title = game.name || 'No title';

          if (processedGames.has(title)) {
            console.log(`Game "${title}" already processed, skipping.`);
            continue;
          }

          const existingGame = await pool.request()
            .input('Title', sql.NVarChar, title)
            .query('SELECT GameID FROM Games WHERE Title = @Title');
          if (existingGame.recordset.length > 0) {
            console.log(`Game "${title}" already exists in database, skipping.`);
            processedGames.add(title);
            continue;
          }

          // Use short description from list endpoint to avoid detail call
          let description = game.short_description || game.description || 'No description';
          description = typeof description === 'string' ? description : String(description);
          description = striptags(description);
          if (description.length > 2000) {
            console.log(`Truncating description for game "${title}": Original length = ${description.length}`);
            description = description.substring(0, 2000);
          }

          let releaseDate = game.released || null;
          if (releaseDate) {
            if (/^\d{4}$/.test(releaseDate)) {
              releaseDate = `${releaseDate}-01-01`;
            } else if (/^\d{4}-\d{2}$/.test(releaseDate)) {
              releaseDate = `${releaseDate}-01`;
            } else if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
              console.log(`Invalid date format for game "${title}": ${releaseDate}, setting to NULL`);
              releaseDate = null;
            }
            if (releaseDate) {
              const dateObj = new Date(releaseDate);
              if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 1000 || dateObj.getFullYear() > 9999) {
                console.log(`Invalid date for game "${title}": ${releaseDate}, setting to NULL`);
                releaseDate = null;
              }
            }
          }

          const imageUrl = game.background_image || null;

          const gameResult = await pool.request()
            .input('Title', sql.NVarChar, title)
            .input('Description', sql.NVarChar, description)
            .input('ReleaseDate', sql.Date, releaseDate)
            .input('Image', sql.NVarChar, imageUrl)
            .input('AddedByUserID', sql.Int, addedByUserID)
            .query(`
              INSERT INTO Games (Title, Description, ReleaseDate, Rating, Image, AddedByUserID)
              OUTPUT INSERTED.GameID
              VALUES (@Title, @Description, @ReleaseDate, NULL, @Image, @AddedByUserID)
            `);

          const gameId = gameResult.recordset[0].GameID;

          const contentResult = await pool.request()
            .input('GameID', sql.Int, gameId)
            .query(`
              INSERT INTO Content (GameID)
              OUTPUT INSERTED.ContentID
              VALUES (@GameID)
            `);

          const contentId = contentResult.recordset[0].ContentID;

          // Batch insert Content_Genre records
          const gameGenresFromApi = game.genres.map(g => rawgGenreMap[g.slug] || g.name).filter(g => gameGenres.includes(g));
          if (gameGenresFromApi.length > 0) {
            let values = gameGenresFromApi.map(g => `(${genreIdCache[g]}, ${contentId})`).join(', ');
            await pool.request()
              .query(`
                INSERT INTO Content_Genre (GenreID, ContentID)
                VALUES ${values}
              `);
          }

          gamesInsertedForGenre++;
          totalGamesInserted++;
          processedGames.add(title);
        }
      } catch (error) {
        console.error(`Error fetching games for genre "${genre}" on page ${page}:`, error.message);
        break;
      }
    }

    gamesPerGenre[genre] = gamesInsertedForGenre;
    if (gamesInsertedForGenre < targetGamesPerGenre) {
      console.log(`Genre "${genre}" yielded ${gamesInsertedForGenre} games, shortfall of ${targetGamesPerGenre - gamesInsertedForGenre}.`);
    }
  }

  // Optimized shortfall compensation
  const shortfall = targetTotalGames - totalGamesInserted;
  if (shortfall > 0) {
    console.log(`Total games inserted: ${totalGamesInserted}, shortfall: ${shortfall}. Fetching additional games.`);

    const highYieldGenres = ['Action', 'Adventure', 'RPG', 'Shooter'];
    let remainingShortfall = shortfall;

    for (const genre of highYieldGenres) {
      if (remainingShortfall <= 0) break;

      let page = 6;
      const maxShortfallPages = Math.ceil(remainingShortfall / 40); // Limit pages
      for (let i = 0; i < maxShortfallPages && remainingShortfall > 0; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));

          const params = {
            key: 'f161c5ceeac2444a950ccf2fe1cdebb4',
            page: page,
            page_size: 40
          };
          const rawgGenreSlug = Object.keys(rawgGenreMap).find(key => rawgGenreMap[key] === genre);
          if (['battle-royale', 'moba', 'open-world', 'horror', 'visual-novel', 'music', 'survival', 'sandbox', 'stealth'].includes(rawgGenreSlug)) {
            params.tags = rawgGenreSlug;
          } else {
            params.genres = rawgGenreSlug;
          }

          const response = await fetchWithRetry('https://api.rawg.io/api/games', params);
          const games = response.data.results || [];

          if (games.length === 0) {
            console.log(`No more games found for genre "${genre}" on page ${page} for shortfall.`);
            break;
          }

          for (const game of games) {
            const title = game.name || 'No title';

            if (processedGames.has(title)) {
              console.log(`Game "${title}" already processed, skipping.`);
              continue;
            }

            const existingGame = await pool.request()
              .input('Title', sql.NVarChar, title)
              .query('SELECT GameID FROM Games WHERE Title = @Title');
            if (existingGame.recordset.length > 0) {
              console.log(`Game "${title}" already exists in database, skipping.`);
              processedGames.add(title);
              continue;
            }

            let description = game.short_description || game.description || 'No description';
            description = typeof description === 'string' ? description : String(description);
            description = striptags(description);
            if (description.length > 2000) {
              console.log(`Truncating description for game "${title}": Original length = ${description.length}`);
              description = description.substring(0, 2000);
            }

            let releaseDate = game.released || null;
            if (releaseDate) {
              if (/^\d{4}$/.test(releaseDate)) {
                releaseDate = `${releaseDate}-01-01`;
              } else if (/^\d{4}-\d{2}$/.test(releaseDate)) {
                releaseDate = `${releaseDate}-01`;
              } else if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
                console.log(`Invalid date format for game "${title}": ${releaseDate}, setting to NULL`);
                releaseDate = null;
              }
              if (releaseDate) {
                const dateObj = new Date(releaseDate);
                if (isNaN(dateObj.getTime()) || dateObj.getFullYear() < 1000 || dateObj.getFullYear() > 9999) {
                  console.log(`Invalid date for game "${title}": ${releaseDate}, setting to NULL`);
                  releaseDate = null;
                }
              }
            }

            const imageUrl = game.background_image || null;

            const gameResult = await pool.request()
              .input('Title', sql.NVarChar, title)
              .input('Description', sql.NVarChar, description)
              .input('ReleaseDate', sql.Date, releaseDate)
              .input('Image', sql.NVarChar, imageUrl)
              .input('AddedByUserID', sql.Int, addedByUserID)
              .query(`
                INSERT INTO Games (Title, Description, ReleaseDate, Rating, Image, AddedByUserID)
                OUTPUT INSERTED.GameID
                VALUES (@Title, @Description, @ReleaseDate, NULL, @Image, @AddedByUserID)
              `);

            const gameId = gameResult.recordset[0].GameID;

            const contentResult = await pool.request()
              .input('GameID', sql.Int, gameId)
              .query(`
                INSERT INTO Content (GameID)
                OUTPUT INSERTED.ContentID
                VALUES (@GameID)
              `);

            const contentId = contentResult.recordset[0].ContentID;

            const gameGenresFromApi = game.genres.map(g => rawgGenreMap[g.slug] || g.name).filter(g => gameGenres.includes(g));
            if (gameGenresFromApi.length > 0) {
              let values = gameGenresFromApi.map(g => `(${genreIdCache[g]}, ${contentId})`).join(', ');
              await pool.request()
                .query(`
                  INSERT INTO Content_Genre (GenreID, ContentID)
                  VALUES ${values}
                `);
            }

            totalGamesInserted++;
            remainingShortfall--;
            gamesPerGenre[genre] = (gamesPerGenre[genre] || 0) + 1;
            processedGames.add(title);

            if (remainingShortfall <= 0) break;
          }
        } catch (error) {
          console.error(`Error fetching shortfall games for genre "${genre}" on page ${page}:`, error.message);
          break;
        }
        page++;
      }
    }

    console.log(`After compensation, total games inserted: ${totalGamesInserted}, remaining shortfall: ${remainingShortfall}.`);
  }

  console.log('Games inserted per genre:', gamesPerGenre);
  console.log(`Total games inserted: ${totalGamesInserted}`);

  await pool.close();
}

main().catch(console.error);