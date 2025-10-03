const { sql, poolPromise } = require('../config/db');

async function searchAllContent(query, page = 1, pageSize = 40, genres = [], contentType = null) {
  try {
    console.log(`Search parameters: query=${query}, page=${page}, pageSize=${pageSize}, genres=${JSON.stringify(genres)}, contentType=${contentType}`);
    
    // Validate genres parameter
    if (!Array.isArray(genres)) {
      console.warn('Genres parameter is not an array:', genres);
      genres = [];
    }

    const pool = await poolPromise.catch(err => {
      console.error('Database connection error:', err.message);
      throw new Error('Database connection failed');
    });
    console.log('Database connection established');

    // Sanitize query to prevent SQL injection
    const sanitizedQuery = query ? `%${query.replace(/[%_]/g, '')}%` : '';
    const offset = (page - 1) * pageSize;

    const request = pool.request();
    request.input('query', sql.NVarChar, sanitizedQuery);
    request.input('offset', sql.Int, offset);
    request.input('pageSize', sql.Int, pageSize);

    // Build dynamic genre filter
    let genreFilter = '';
    let genreJoinType = genres.length > 0 ? 'INNER' : 'LEFT';
    let sanitizedGenres = [];
    if (genres.length > 0) {
      sanitizedGenres = genres.map(genre => genre.replace(/['"]/g, ''));
      console.log('Sanitized genres:', sanitizedGenres);
      genreFilter = `AND EXISTS (
        SELECT 1
        FROM Content_Genre cg2
        JOIN Genres g2 ON g2.GenreID = cg2.GenreID
        WHERE cg2.ContentID = c.ContentID
        AND g2.Name IN (${sanitizedGenres.map((_, i) => `@genre${i}`).join(', ')})
      )`;
      sanitizedGenres.forEach((genre, i) => {
        console.log(`Binding genre${i}: ${genre}`);
        request.input(`genre${i}`, sql.NVarChar, genre);
      });
    }

    // Define valid content types
    const validContentTypes = {
      books: { table: 'Books', idColumn: 'BookID', contentType: 'Book' },
      movies: { table: 'Movies', idColumn: 'MovieID', contentType: 'Movie' },
      games: { table: 'Games', idColumn: 'GameID', contentType: 'Game' }
    };

    let sqlQuery = '';
    if (contentType && validContentTypes[contentType.toLowerCase()]) {
      // Search only the specified content type
      const config = validContentTypes[contentType.toLowerCase()];
      sqlQuery = `
        WITH SearchResults AS (
          -- ${config.contentType}: Title search
          SELECT 
            T.${config.idColumn} AS ItemID,
            c.ContentID,
            '${config.contentType}' AS ContentType,
            T.Title,
            T.Image,
            T.Description,
            CAST(STRING_AGG(Genres.Name, ',') AS NVARCHAR(MAX)) AS Genres,
            CASE WHEN @query = '' THEN 1 ELSE 1 END AS Rank
          FROM ${config.table} T
          JOIN Content c ON c.${config.idColumn} = T.${config.idColumn}
          ${genreJoinType} JOIN Content_Genre cg ON cg.ContentID = c.ContentID
          ${genreJoinType} JOIN Genres ON Genres.GenreID = cg.GenreID
          WHERE (@query = '' OR T.Title LIKE @query) ${genreFilter}
          GROUP BY T.${config.idColumn}, c.ContentID, T.Title, T.Image, T.Description

          UNION ALL

          -- ${config.contentType}: Description search
          SELECT 
            T.${config.idColumn} AS ItemID,
            c.ContentID,
            '${config.contentType}' AS ContentType,
            T.Title,
            T.Image,
            T.Description,
            CAST(STRING_AGG(Genres.Name, ',') AS NVARCHAR(MAX)) AS Genres,
            2 AS Rank
          FROM ${config.table} T
          JOIN Content c ON c.${config.idColumn} = T.${config.idColumn}
          ${genreJoinType} JOIN Content_Genre cg ON cg.ContentID = c.ContentID
          ${genreJoinType} JOIN Genres ON Genres.GenreID = cg.GenreID
          WHERE @query != '' AND T.Description LIKE @query ${genreFilter}
          GROUP BY T.${config.idColumn}, c.ContentID, T.Title, T.Image, T.Description
        )
        SELECT 
          ItemID,
          ContentID,
          ContentType,
          Title,
          Image,
          Genres,
          Description,
          (SELECT COUNT(DISTINCT CONCAT(ContentType, CAST(ItemID AS NVARCHAR(50)))) FROM SearchResults) AS TotalCount
        FROM (
          SELECT DISTINCT
            ItemID,
            ContentID,
            ContentType,
            Title,
            Image,
            Genres,
            Description,
            MIN(Rank) AS Rank
          FROM SearchResults
          GROUP BY ItemID, ContentID, ContentType, Title, Image, Genres, Description
          ORDER BY MIN(Rank), Title
          OFFSET @offset ROWS
          FETCH NEXT @pageSize ROWS ONLY
        ) AS OrderedResults;
      `;
    } else {
      // Search all content types
      sqlQuery = `
        WITH SearchResults AS (
          -- Books: All or Title search
          SELECT 
            b.BookID AS ItemID,
            c.ContentID,
            'Book' AS ContentType,
            b.Title,
            b.Image,
            b.Description,
            CAST(STRING_AGG(Genres.Name, ',') AS NVARCHAR(MAX)) AS Genres,
            CASE WHEN @query = '' THEN 1 ELSE 1 END AS Rank
          FROM Books b
          JOIN Content c ON c.BookID = b.BookID
          ${genreJoinType} JOIN Content_Genre cg ON cg.ContentID = c.ContentID
          ${genreJoinType} JOIN Genres ON Genres.GenreID = cg.GenreID
          WHERE (@query = '' OR b.Title LIKE @query) ${genreFilter}
          GROUP BY b.BookID, c.ContentID, b.Title, b.Image, b.Description

          UNION ALL

          -- Books: Description search
          SELECT 
            b.BookID AS ItemID,
            c.ContentID,
            'Book' AS ContentType,
            b.Title,
            b.Image,
            b.Description,
            CAST(STRING_AGG(Genres.Name, ',') AS NVARCHAR(MAX)) AS Genres,
            2 AS Rank
          FROM Books b
          JOIN Content c ON c.BookID = b.BookID
          ${genreJoinType} JOIN Content_Genre cg ON cg.ContentID = c.ContentID
          ${genreJoinType} JOIN Genres ON Genres.GenreID = cg.GenreID
          WHERE @query != '' AND b.Description LIKE @query ${genreFilter}
          GROUP BY b.BookID, c.ContentID, b.Title, b.Image, b.Description

          UNION ALL

          -- Movies: All or Title search
          SELECT 
            m.MovieID AS ItemID,
            c.ContentID,
            'Movie' AS ContentType,
            m.Title,
            m.Image,
            m.Description,
            CAST(STRING_AGG(Genres.Name, ',') AS NVARCHAR(MAX)) AS Genres,
            CASE WHEN @query = '' THEN 1 ELSE 1 END AS Rank
          FROM Movies m
          JOIN Content c ON c.MovieID = m.MovieID
          ${genreJoinType} JOIN Content_Genre cg ON cg.ContentID = c.ContentID
          ${genreJoinType} JOIN Genres ON Genres.GenreID = cg.GenreID
          WHERE (@query = '' OR m.Title LIKE @query) ${genreFilter}
          GROUP BY m.MovieID, c.ContentID, m.Title, m.Image, m.Description

          UNION ALL

          -- Movies: Description search
          SELECT 
            m.MovieID AS ItemID,
            c.ContentID,
            'Movie' AS ContentType,
            m.Title,
            m.Image,
            m.Description,
            CAST(STRING_AGG(Genres.Name, ',') AS NVARCHAR(MAX)) AS Genres,
            2 AS Rank
          FROM Movies m
          JOIN Content c ON c.MovieID = m.MovieID
          ${genreJoinType} JOIN Content_Genre cg ON cg.ContentID = c.ContentID
          ${genreJoinType} JOIN Genres ON Genres.GenreID = cg.GenreID
          WHERE @query != '' AND m.Description LIKE @query ${genreFilter}
          GROUP BY m.MovieID, c.ContentID, m.Title, m.Image, m.Description

          UNION ALL

          -- Games: All or Title search
          SELECT 
            g.GameID AS ItemID,
            c.ContentID,
            'Game' AS ContentType,
            g.Title,
            g.Image,
            g.Description,
            CAST(STRING_AGG(Genres.Name, ',') AS NVARCHAR(MAX)) AS Genres,
            CASE WHEN @query = '' THEN 1 ELSE 1 END AS Rank
          FROM Games g
          JOIN Content c ON c.GameID = g.GameID
          ${genreJoinType} JOIN Content_Genre cg ON cg.ContentID = c.ContentID
          ${genreJoinType} JOIN Genres ON Genres.GenreID = cg.GenreID
          WHERE (@query = '' OR g.Title LIKE @query) ${genreFilter}
          GROUP BY g.GameID, c.ContentID, g.Title, g.Image, g.Description

          UNION ALL

          -- Games: Description search
          SELECT 
            g.GameID AS ItemID,
            c.ContentID,
            'Game' AS ContentType,
            g.Title,
            g.Image,
            g.Description,
            CAST(STRING_AGG(Genres.Name, ',') AS NVARCHAR(MAX)) AS Genres,
            2 AS Rank
          FROM Games g
          JOIN Content c ON c.GameID = g.GameID
          ${genreJoinType} JOIN Content_Genre cg ON cg.ContentID = c.ContentID
          ${genreJoinType} JOIN Genres ON Genres.GenreID = cg.GenreID
          WHERE @query != '' AND g.Description LIKE @query ${genreFilter}
          GROUP BY g.GameID, c.ContentID, g.Title, g.Image, g.Description
        )
        SELECT 
          ItemID,
          ContentID,
          ContentType,
          Title,
          Image,
          Genres,
          Description,
          (SELECT COUNT(DISTINCT CONCAT(ContentType, CAST(ItemID AS NVARCHAR(50)))) FROM SearchResults) AS TotalCount
        FROM (
          SELECT DISTINCT
            ItemID,
            ContentID,
            ContentType,
            Title,
            Image,
            Genres,
            Description,
            MIN(Rank) AS Rank
          FROM SearchResults
          GROUP BY ItemID, ContentID, ContentType, Title, Image, Genres, Description
          ORDER BY MIN(Rank), Title
          OFFSET @offset ROWS
          FETCH NEXT @pageSize ROWS ONLY
        ) AS OrderedResults;
      `;
    }

    console.log('Query parameters:', { query: sanitizedQuery, offset, pageSize, genres, contentType });

    const result = await request.query(sqlQuery).catch(err => {
      console.error('SQL query error:', err.message);
      throw new Error('SQL query failed');
    });

    const searchResults = result.recordset.map(row => ({
      ItemID: row.ItemID,
      ContentID: row.ContentID,
      ContentType: row.ContentType,
      Title: row.Title,
      Image: row.Image,
      Genres: row.Genres ? row.Genres.split(',').map(genre => genre.trim()) : [],
      Description: row.Description
    }));
    const totalCount = result.recordset.length > 0 ? result.recordset[0].TotalCount : 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    console.log(`Search results: ${searchResults.length} items, totalCount: ${totalCount}, totalPages: ${totalPages}`);

    return {
      searchResults,
      currentPage: page,
      totalPages,
      totalCount
    };
  } catch (err) {
    console.error('Search error:', err.message);
    throw new Error('Failed to perform search');
  }
}

module.exports = { searchAllContent };