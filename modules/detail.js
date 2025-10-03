const { sql, poolPromise } = require("../config/db");

async function getContentByTypeAndId(type, id) {
  console.log(`getContentByTypeAndId: type=${type}, id=${id}`);
  const pool = await poolPromise;
  let query = "";
  let contentType = "";
  
  if (type === "books") {
    contentType = "Book";
    query = `
      SELECT 
        C.ContentID,
        B.BookID AS SpecificID,
        B.Title,
        B.Description,
        B.Image,
        B.ReleaseDate,
        STRING_AGG(G.Name, ', ') AS Genres
      FROM Books B
      INNER JOIN Content C ON C.BookID = B.BookID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G ON CG.GenreID = G.GenreID
      WHERE C.ContentID = @Id
      GROUP BY C.ContentID, B.BookID, B.Title, B.Description, B.Image, B.ReleaseDate
    `;
  } else if (type === "movies") {
    contentType = "Movie";
    query = `
      SELECT 
        C.ContentID,
        M.MovieID AS SpecificID,
        M.Title,
        M.Description,
        M.Image,
        M.ReleaseDate,
        STRING_AGG(G.Name, ', ') AS Genres
      FROM Movies M
      INNER JOIN Content C ON C.MovieID = M.MovieID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G ON CG.GenreID = G.GenreID
      WHERE C.ContentID = @Id
      GROUP BY C.ContentID, M.MovieID, M.Title, M.Description, M.Image, M.ReleaseDate
    `;
  } else if (type === "games") {
    contentType = "Game";
    query = `
      SELECT 
        C.ContentID,
        G.GameID AS SpecificID,
        G.Title,
        G.Description,
        G.Image,
        G.ReleaseDate,
        STRING_AGG(G2.Name, ', ') AS Genres
      FROM Games G
      INNER JOIN Content C ON C.GameID = G.GameID
      LEFT JOIN Content_Genre CG ON C.ContentID = CG.ContentID
      LEFT JOIN Genres G2 ON CG.GenreID = G2.GenreID
      WHERE C.ContentID = @Id
      GROUP BY C.ContentID, G.GameID, G.Title, G.Description, G.Image, G.ReleaseDate
    `;
  } else {
    console.error(`Invalid type: ${type}`);
    return null;
  }

  try {
    const result = await pool.request()
      .input("Id", id)
      .query(query);
    
    console.log(`Query result: ${JSON.stringify(result.recordset)}`);
    
    if (result.recordset.length === 0) {
      return null;
    }

    const item = result.recordset[0];
    
    // Format ReleaseDate
    if (item.ReleaseDate) {
      const rawDate = new Date(item.ReleaseDate);
      const formattedDate = rawDate.toDateString();
      item.ReleaseDate = formattedDate;
    }

    // Process Genres into an array
    item.Genres = item.Genres ? item.Genres.split(', ').map(genre => genre.trim()) : [];
    
    // Add ContentType
    item.ContentType = contentType;

    return item;
  } catch (err) {
    console.error(`Query error: ${err.message}`);
    return null;
  }
}

module.exports = { getContentByTypeAndId };