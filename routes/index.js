var express = require("express");
var router = express.Router();
const upload = require('../config/multer');

//modules
const { getBestRated, getRandomBooks, getRandomMovies, getRandomGames } = require("../modules/home");
const { getContentByTypeAndId } = require("../modules/detail");
const { registerUser } = require("../modules/register");
const { loginUser } = require("../modules/login");
const { validateRegisterInput, validateLoginInput, validateUpdateInput, verifyCurrentPassword } = require("../modules/userValidation");
const { getUserById, checkDuplicateEmail, updateUser, getUserRequests } = require('../modules/user');
const { searchAllContent } = require('../modules/search');
const { getCommunities, createCommunity } = require('../modules/community');
const { getCategoryContent } = require("../modules/category");
const { searchCommunities } = require("../modules/searchCommunity")
const { submitOrUpdateReviewByContentId } = require('../modules/review');
const { sendContactEmail } = require('../utils/email');
const { body, validationResult } = require('express-validator');
const { getTopRatedBooks, getTopRatedMovies, getTopRatedGames } = require('../modules/bestRated');

const { sql, poolPromise } = require("../config/db");

//toevoegen pagina
const addedItems = []; // tijdelijk opgeslagen inhoud

var requests = []; // Her request: { username, title, description, status }


//user-page
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next(); // login
  }
  res.redirect("/login");
}

//isAdmin: AdminPage is for just Admin
function isAdmin(req, res, next) {
  if (
    req.session.user &&
    req.session.user.UserType &&
    req.session.user.UserType.toLowerCase() === 'admin'
  ) {
    return next();
  }

  return res.status(403).render('error', {
    title: "Access Denied",
    error: "Unauthorized access"
  });
}

router.get('/', async function (req, res) {
  try {
    const bestRatedContent = await getBestRated();
    const randomBooksContent = await getRandomBooks();
    const randomMoviesContent = await getRandomMovies();
    const randomGamesContent = await getRandomGames();

    res.render('index', {
      title: 'Home',
      banner: '/images/BannerHome.jpg',
      hero: {
        cta: 'Welcome to MediaMate',
        shortDescription: 'Find the best in entertainment'
      },
      searchQuery: '',
      bestRatedContent,
      randomBooksContent,
      randomMoviesContent,
      randomGamesContent,
      user: req.session.user || null // Pass user explicitly
    });
  } catch (error) {
    console.error('Error loading homepage content:', error);
    res.render('index', {
      title: 'Home',
      banner: '/images/BannerHome.jpg',
      hero: {
        cta: 'Welcome to MediaMate',
        shortDescription: 'Find the best in entertainment'
      },
      searchQuery: '',
      bestRatedContent: [],
      randomBooksContent: [],
      randomMoviesContent: [],
      randomGamesContent: [],
      error: 'Failed to load content',
    });
  }
});

router.post('/search', async function (req, res) {
  console.log('POST /search received:', req.body);
  const query = req.body.query?.trim() || '';
  const contentType = req.body.contentType || null;
  let genres = [];

  try {
    if (req.body.genres) {
      if (typeof req.body.genres === 'string') {
        genres = req.body.genres.split(',').map(g => g.trim()).filter(g => g);
      } else if (Array.isArray(req.body.genres)) {
        genres = req.body.genres.map(g => g.trim()).filter(g => g);
      }
    } else if (req.body['genres[]']) {
      genres = Array.isArray(req.body['genres[]'])
        ? req.body['genres[]'].map(g => g.trim()).filter(g => g)
        : [req.body['genres[]']].filter(g => g);
    }
    if (!Array.isArray(genres)) {
      console.warn('Genres is not an array after parsing:', genres);
      genres = [];
    }
    console.log('Parsed genres:', genres);
  } catch (error) {
    console.error('Error parsing genres:', error.message);
    genres = [];
  }

  const queryParams = new URLSearchParams({ query });
  if (genres.length > 0) {
    queryParams.append('genres', genres.join(','));
  }
  if (contentType) {
    queryParams.append('contentType', contentType);
  }
  console.log(`Redirecting to /search?${queryParams.toString()}`);
  res.redirect(`/search?${queryParams.toString()}`);
});

router.get('/search', async function (req, res) {
  console.log('GET /search received:', req.query);
  const query = req.query.query?.trim() || '';
  const contentType = req.query.contentType || null;
  let genres = [];
  try {
    if (req.query.genres) {
      genres = req.query.genres.split(',').map(g => g.trim()).filter(g => g);
    }
  } catch (error) {
    console.error('Error parsing genres:', error);
    genres = [];
  }
  const page = parseInt(req.query.page) || 1;
  const error = req.query.error;

  try {
    let searchResults = [];
    let searchError = error;
    let currentPage = 1;
    let totalPages = 1;
    let startPage = 1;
    let endPage = 1;

    const result = await searchAllContent(query, page, 40, genres, contentType);
    searchResults = Array.isArray(result.searchResults) ? result.searchResults : [];
    currentPage = result.currentPage;
    totalPages = result.totalPages;

    const pageWindow = 2;
    startPage = Math.max(2, currentPage - pageWindow);
    endPage = Math.min(totalPages - 1, currentPage + pageWindow);

    if (currentPage <= 3) {
      startPage = 2;
      endPage = Math.min(5, totalPages - 1);
    }
    if (currentPage >= totalPages - 2) {
      startPage = Math.max(totalPages - 4, 2);
      endPage = totalPages - 1;
    }

    if (searchResults.length === 0) {
      searchError = 'No results found';
    }

    const renderData = {
      title: 'Search Results',
      searchResults: searchResults.map(row => ({
        ...row,
        name: row.Title,
        image: row.Image,
        description: row.Description
      })),
      searchQuery: query,
      contentType,
      selectedGenres: genres,
      currentPage,
      totalPages,
      startPage,
      endPage,
      error: searchError,
      encodeURIComponent: encodeURIComponent,
      join: (arr, sep) => arr.join(sep),
      rangeHelper: (start, end) => Array.from({ length: end - start + 1 }, (_, i) => i + start)
    };

    res.render('search', renderData);
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).render('search', {
      title: 'Search Results',
      searchResults: [],
      searchQuery: query,
      contentType,
      selectedGenres: genres,
      currentPage: 1,
      totalPages: 1,
      startPage: 1,
      endPage: 1,
      error: 'Search failed, please try again',
      encodeURIComponent: encodeURIComponent,
      join: (arr, sep) => arr.join(sep),
      rangeHelper: (start, end) => Array.from({ length: end - start + 1 }, (_, i) => i + start)
    });
  }
});

const dataMap = {
  books: {
    title: 'Books',
    type: 'books',
    hero: {
      cta: 'Explore Great Reads',
      banner: '/images/BookBanner.jpg',
      shortDescription: 'Browse a hand-picked list of top books'
    }
  },
  movies: {
    title: 'Movies',
    type: 'movies',
    hero: {
      cta: 'Watch Blockbuster Films',
      banner: '/images/MovieBanner2.jpg',
      shortDescription: 'Check out the most loved movies'
    }
  },
  games: {
    title: 'Games',
    type: 'games',
    hero: {
      cta: 'Discover Exciting Games',
      banner: '/images/Banner games.webp',
      shortDescription: 'Explore a curated list of top games'
    }
  }
};

router.get('/category/:type', async (req, res) => {
  const { type } = req.params;
  const page = parseInt(req.query.page) || 1;
  const pageSize = 20;

  const pageData = dataMap[type];
  if (!pageData) return res.status(404).send('Category not found');

  try {
    const categoryResult = await getCategoryContent(type, page, pageSize);
    const { searchResults: items, currentPage, totalPages, totalCount } = categoryResult;
    let topRatedItems = [];

    if (type === 'books') {
      topRatedItems = await getTopRatedBooks();
    } else if (type === 'movies') {
      topRatedItems = await getTopRatedMovies();
    } else if (type === 'games') {
      topRatedItems = await getTopRatedGames();
    }

    res.render('category', {
      title: pageData.title,
      type: pageData.type,
      hero: pageData.hero,
      items,
      currentPage,
      totalPages,
      totalCount,
      topRatedItems
    });
  } catch (error) {
    console.error('Category route error:', error);
    res.status(500).send('Server error');
  }
});

// Detail page route
// GET content detail page
// GET content detail page
router.get('/category/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const normalizedType = type.toLowerCase();

  if (!['books', 'movies', 'games'].includes(normalizedType)) {
    return res.status(400).render('error', { title: 'Invalid Type', error: 'Invalid content type' });
  }

  try {
    const itemData = await getContentByTypeAndId(normalizedType, parseInt(id));
    if (!itemData) {
      return res.status(404).render('error', { title: 'Item Not Found', error: 'Item not found' });
    }

    const pool = await poolPromise;
    const reviewsResult = await pool.request()
      .input('ContentID', sql.Int, id)
      .query(`
        SELECT R.Rating, R.Comment, R.ReviewDate, U.Username
        FROM Reviews R
        JOIN Users U ON R.UserID = U.UserID
        WHERE R.ContentID = @ContentID
        ORDER BY R.ReviewDate DESC
      `);
    const reviews = reviewsResult.recordset.map(review => ({
      ...review,
      ReviewDate: review.ReviewDate.toISOString().split('T')[0]
    }));

    const averageResult = await pool.request()
      .input('ContentID', sql.Int, id)
      .query(`SELECT AVG(CAST(Rating AS FLOAT)) AS AverageRating FROM Reviews WHERE ContentID = @ContentID`);

    const userReviewResult = req.session.user ? await pool.request()
      .input('ContentID', sql.Int, id)
      .input('UserID', sql.Int, req.session.user.UserID)
      .query(`
        SELECT Rating, Comment
        FROM Reviews
        WHERE ContentID = @ContentID AND UserID = @UserID
      `) : { recordset: [] };

    // Check if item is favorited
    let isFavorite = false;
    if (req.session.user) {
      const favResult = await pool.request()
        .input('UserID', sql.Int, req.session.user.UserID)
        .input('ContentID', sql.Int, id)
        .query('SELECT 1 FROM Favorites WHERE UserID = @UserID AND ContentID = @ContentID');

      isFavorite = favResult.recordset.length > 0;
    }

    res.render('content-detail', {
      item: {
        id: itemData.ContentID, // Use ContentID for reviews
        specificId: itemData.SpecificID, // BookID, MovieID, or GameID
        name: itemData.Title,
        description: itemData.Description,
        image: itemData.Image || '/images/placeholder.jpg',
        releaseDate: itemData.ReleaseDate,
        Genres: itemData.Genres,
        ContentType: itemData.ContentType
      },
      title: itemData.Title,
      type: normalizedType,
      reviews: reviews,
      averageRating: averageResult.recordset[0].AverageRating?.toFixed(1) || null,
      userReview: userReviewResult.recordset[0],
      isAuthenticated: !!req.session.user,
      isFavorite
    });
  } catch (error) {
    console.error('Detail page error:', error);
    res.status(500).render('error', { title: 'Server Error', error: 'Error retrieving item detail' });
  }
});

router.post('/category/:type/:id/review', isAuthenticated, async (req, res) => {
  const { id } = req.params; // id is ContentID
  const { rating, comment } = req.body;
  const userID = req.session.user?.UserID;

  try {
    await submitOrUpdateReviewByContentId(parseInt(id), userID, parseInt(rating), comment);
    res.redirect(`/category/${req.params.type}/${id}`);
  } catch (error) {
    console.error('Review submission error:', error);
    res.status(500).render('error', { title: 'Review Error', error: error.message });
  }
});

// Contact Page - GET
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact',
    successMessage: null,
    errorMessage: null
  });
});

// Contact Page - POST
router.post('/contact', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').trim().notEmpty().withMessage('Message is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('contact', {
      title: 'Contact',
      errorMessage: errors.array().map(err => err.msg).join(', '),
      successMessage: null
    });
  }

  const { name, email, message } = req.body;

  console.log('Contact form submitted:');
  console.log('Name:', name);
  console.log('Email:', email);
  console.log('Message:', message);

  const result = await sendContactEmail({ name, email, message });

  if (result.success) {
    res.render('contact', {
      title: 'Contact',
      successMessage: `Thanks for contacting us, ${name}!`,
      errorMessage: null
    });
  } else {
    res.render('contact', {
      title: 'Contact',
      errorMessage: 'Failed to send message. Please try again later.',
      successMessage: null
    });
  }
});

router.post('/community', async function (req, res) {
  console.log('POST /community received:', req.body);
  const query = req.body.query?.trim() || '';

  const queryParams = new URLSearchParams({ query });
  console.log(`Redirecting to /community?${queryParams.toString()}`);
  res.redirect(`/community?${queryParams.toString()}`);
});

router.get('/community', async function (req, res) {
  console.log('GET /community received:', req.query);
  const query = req.query.query?.trim() || '';

  try {
    let communities = [];
    if (query) {
      communities = await searchCommunities(query);
      console.log(`Search returned ${communities.length} communities`);
    } else {
      communities = await getCommunities();
      console.log(`Random load returned ${communities.length} communities`);
    }
    if (req.session.user) {
      for (let community of communities) {
        const pool = await poolPromise;
        const favResult = await pool.request()
          .input('UserID', sql.Int, req.session.user.UserID)
          .input('RoomID', sql.Int, community.RoomID)
          .query('SELECT 1 FROM Favorites WHERE UserID = @UserID AND RoomID = @RoomID');

        community.isFavorite = favResult.recordset.length > 0;
      }
    }
    res.render('community', {
      title: 'Community',
      communities,
      searchQuery: query,
      error: communities.length === 0 && query ? 'No communities found for your search.' : null
    });
  } catch (error) {
    console.error('❌ Community load error:', error.message, error);
    res.render('community', {
      title: 'Community',
      communities: [],
      searchQuery: query,
      error: 'Failed to load communities.'
    });
  }
});

// GET: Render create community form
router.get('/create-community', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  res.render('create-community', {
    title: 'Create Community',
    active: 'create-community',
    error: null
  });
});

// POST: Handle create community form submission
router.post('/create-community', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  console.log('POST /create-community received:', req.body);
  const { ChatName, Keywords, Image } = req.body;
  const CreatorID = req.session.user.UserID; // Assumes UserID is stored in session

  try {
    // Basic validation
    if (!ChatName || ChatName.trim().length === 0) {
      throw new Error('Community name is required.');
    }
    if (ChatName.length > 30) {
      throw new Error('Community name must be 30 characters or less.');
    }
    if (Keywords && Keywords.length > 150) {
      throw new Error('Keywords must be 150 characters or less.');
    }
    if (Image && Image.length > 255) {
      throw new Error('Image URL must be 255 characters or less.');
    }

    await createCommunity(ChatName.trim(), Keywords ? Keywords.trim() : null, Image ? Image.trim() : null, CreatorID);
    console.log(`Community created: ${ChatName}`);
    res.redirect('/community'); // Redirect to community page after creation
  } catch (error) {
    console.error('❌ Create community error:', error.message, error);
    res.render('create-community', {
      title: 'Create Community',
      active: 'create-community',
      error: error.message || 'Failed to create community. Please try again.',
      ChatName,
      Keywords,
      Image
    });
  }
});


router.get("/faq", function (req, res, next) {
  res.render("faq", {
    title: "FAQ",
    cta: "Frequently Asked Questions",
    shortDescription: "Find answers to common questions below",
    faqs: [
      {
        question: "What is MediaMate?",
        answer: "MediaMate is a platform to discover top games, books, and movies."
      },
      {
        question: "Is MediaMate free to use?",
        answer: "Yes, it's completely free to browse and explore content."
      },
      {
        question: "How often is content updated?",
        answer: "New content is added weekly to keep things fresh."
      },
      {
        question: "Can I create an account?",
        answer: "You can browse without an account but to get to use all features you would need to make an account."
      },
      {
        question: "How do you choose which media to feature?",
        answer: "We curate content based on popularity, reviews, and community feedback."
      },
      {
        question: "Can I suggest content to be added?",
        answer: "Logged users get can request games, books, and movies."
      },
      {
        question: "Is MediaMate available on mobile?",
        answer: "Yes, the site is fully responsive and works great on phones and tablets."
      },
      {
        question: "Does MediaMate have ads?",
        answer: "No, we currently do not display any ads on the platform."
      },
      {
        question: "What browsers are supported?",
        answer: "MediaMate works on all modern browsers including Chrome, Firefox, Safari, and Edge."
      },
      {
        question: "Who is behind MediaMate?",
        answer: "MediaMate is built by a small team of developers and media enthusiasts."
      }
    ]
  });
});


// Login Page - GET
router.get("/login", function (req, res) {
  res.render("login", {
    title: "Login",
    errorMessage: null,
    successMessage: null
  });
});

// Login Page - POST
router.post("/login", async function (req, res) {
  const { username, password } = req.body;
  console.log("Session user after login:", req.session.user);

  const validationResult = validateLoginInput(username, password);

  if (!validationResult.isValid) {
    return res.render("login", {
      title: "Login",
      errorMessage: validationResult.error,
      successMessage: null
    });
  }

  try {
    const result = await loginUser(validationResult.trimmedUsername, password);

    if (result.success) {
      req.session.user = {
        UserID: result.user.UserID,
        Username: result.user.Username,
        UserType: result.user.UserType
      };

      console.log("Session user set:", req.session.user);

      req.session.save(err => {
        if (err) {
          console.error("Session save error:", err);
          return res.render("login", {
            title: "Login",
            errorMessage: "Session could not be saved.",
            successMessage: null
          });
        }

        return res.redirect("/");
      });

    } else {
      return res.render("login", {
        title: "Login",
        errorMessage: result.message,
        successMessage: null
      });
    }

  } catch (error) {
    console.error("Login error:", error);
    return res.render("login", {
      title: "Login",
      errorMessage: "Server error during login",
      successMessage: null
    });
  }
});


// Logout
router.get("/logout", function (req, res) {
  req.session.destroy();
  res.redirect("/");
});


// Register Page - GET
router.get("/register", function (req, res) {
  res.render("register", {
    title: "Register",
    errorMessage: null,
    successMessage: null
  });
});

// Register Page - POST
router.post("/register", async function (req, res) {
  const { username, email, password } = req.body;

  // Validate inputs
  const validationResult = validateRegisterInput(username, email, password);

  if (!validationResult.isValid) {
    return res.render("register", {
      title: "Register",
      errorMessage: validationResult.error,
      successMessage: null
    });
  }

  try {
    const result = await registerUser(validationResult.trimmedUsername, validationResult.trimmedEmail, password);

    if (result.success) {
      return res.render("register", {
        title: "Register",
        errorMessage: null,
        successMessage: `Welcome, ${result.user.Username}! Your account has been created.`
      });
    } else {
      return res.render("register", {
        title: "Register",
        errorMessage: result.message,
        successMessage: null
      });
    }
  } catch (error) {
    console.error("Registration error:", error);
    return res.render("register", {
      title: "Register",
      errorMessage: "Server error during registration",
      successMessage: null
    });
  }
});

// User Page - GET
router.get("/user", isAuthenticated, async (req, res) => {
  const userResult = await getUserById(req.session.user.UserID);
  if (!userResult.success) {
    return res.status(404).render('error', { message: userResult.message });
  }

  const requestsResult = await getUserRequests(req.session.user.UserID);
  if (!requestsResult.success) {
    return res.status(500).render('error', { message: requestsResult.message });
  }

  //sort for new requests
  requestsResult.requests.sort((a, b) => b.RequestID - a.RequestID);

  res.render("user", {
    title: "Your Profile",
    user: userResult.user,
    requests: requestsResult.requests,
    errors: {},
    successMessage: null,
    inputValues: { email: userResult.user.Email }
  });
});

// User Page - POST (Update Email, Image, Password)
router.post("/user", isAuthenticated, upload.single('image'), async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const userID = req.session.user.UserID;

  // Validate inputs
  const validationResult = validateUpdateInput(email, imagePath, newPassword, currentPassword);
  if (!validationResult.isValid) {
    const userResult = await getUserById(userID);
    const requestsResult = await getUserRequests(userID);
    const user = userResult.success ? userResult.user : req.session.user;
    const requests = requestsResult.success ? requestsResult.requests : [];

    return res.render("user", {
      title: "Your Profile",
      user,
      requests,
      errors: validationResult.errors,
      successMessage: null,
      inputValues: { email: validationResult.trimmedEmail || user.Email }
    });
  }

  // Verify current password if updating password
  if (newPassword) {
    const passwordVerification = await verifyCurrentPassword(userID, currentPassword);
    if (!passwordVerification.isValid) {
      const userResult = await getUserById(userID);
      const requestsResult = await getUserRequests(userID);
      const user = userResult.success ? userResult.user : req.session.user;
      const requests = requestsResult.success ? requestsResult.requests : [];

      return res.render("user", {
        title: "Your Profile",
        user,
        requests,
        errors: { currentPassword: passwordVerification.error },
        successMessage: null,
        inputValues: { email: validationResult.trimmedEmail || user.Email }
      });
    }
  }

  // Check for duplicate email
  if (validationResult.trimmedEmail && validationResult.trimmedEmail !== req.session.user.Email) {
    const emailCheck = await checkDuplicateEmail(validationResult.trimmedEmail, userID);
    if (!emailCheck.isUnique) {
      const userResult = await getUserById(userID);
      const requestsResult = await getUserRequests(userID);
      const user = userResult.success ? userResult.user : req.session.user;
      const requests = requestsResult.success ? requestsResult.requests : [];

      return res.render("user", {
        title: "Your Profile",
        user,
        requests,
        errors: { email: emailCheck.message },
        successMessage: null,
        inputValues: { email: validationResult.trimmedEmail }
      });
    }
  }

  // Build update inputs
  const updates = [];
  const inputs = {};
  if (validationResult.trimmedEmail && validationResult.trimmedEmail !== req.session.user.Email) {
    updates.push('Email = @Email');
    inputs.Email = validationResult.trimmedEmail;
  }
  if (imagePath) {
    updates.push('Image = @Image');
    inputs.Image = imagePath;
  }
  if (newPassword) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    updates.push('PasswordHash = @PasswordHash');
    inputs.PasswordHash = hashedPassword;
  }

  // Update user
  const updateResult = await updateUser(userID, updates, inputs);
  if (!updateResult.success) {
    const userResult = await getUserById(userID);
    const requestsResult = await getUserRequests(userID);
    const user = userResult.success ? userResult.user : req.session.user;
    const requests = requestsResult.success ? requestsResult.requests : [];

    return res.render("user", {
      title: "Your Profile",
      user,
      requests,
      errors: { general: updateResult.message },
      successMessage: null,
      inputValues: { email: validationResult.trimmedEmail || user.Email }
    });
  }

  // Update session
  if (inputs.Email) req.session.user.Email = inputs.Email;
  if (inputs.Image) req.session.user.Image = inputs.Image;

  // Fetch updated user data and requests
  const userResult = await getUserById(userID);
  const requestsResult = await getUserRequests(userID);
  const user = userResult.success ? userResult.user : req.session.user;
  const requests = requestsResult.success ? requestsResult.requests : [];

  res.render("user", {
    title: "Your Profile",
    user,
    requests,
    errors: {},
    successMessage: 'Profile updated successfully',
    inputValues: { email: user.Email }
  });
});

// 添加收藏路由
router.post('/favorites', isAuthenticated, async (req, res) => {
    const { contentType, contentId, roomId } = req.body;
    const userID = req.session.user.UserID;
    
    try {
        const pool = await poolPromise;
        
        // 检查是否已收藏
        const checkQuery = `
            SELECT * FROM Favorites 
            WHERE UserID = @UserID 
            AND (ContentID = @ContentID OR RoomID = @RoomID)
        `;

    const checkResult = await pool.request()
      .input('UserID', sql.Int, userID)
      .input('ContentID', sql.Int, contentId || null)
      .input('RoomID', sql.Int, roomId || null)
      .query(checkQuery);

    if (checkResult.recordset.length > 0) {
      // 已收藏 -> 执行取消操作
      await pool.request()
        .input('UserID', sql.Int, userID)
        .input('ContentID', sql.Int, contentId || null)
        .input('RoomID', sql.Int, roomId || null)
        .query(`
                    DELETE FROM Favorites 
                    WHERE UserID = @UserID 
                    AND (ContentID = @ContentID OR RoomID = @RoomID)
                `);

      return res.json({ success: true, action: 'removed' });
    }

    // 添加收藏
    const insertQuery = `
            INSERT INTO Favorites (UserID, ContentID, RoomID) 
            VALUES (@UserID, @ContentID, @RoomID)
        `;

    await pool.request()
      .input('UserID', sql.Int, userID)
      .input('ContentID', sql.Int, contentId || null)
      .input('RoomID', sql.Int, roomId || null)
      .query(insertQuery);

    res.json({ success: true, action: 'added' });
  } catch (err) {
    console.error('Error adding favorite:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 获取收藏列表路由
router.get("/favorites", isAuthenticated, async (req, res) => {
  const userID = req.session.user.UserID;

  try {
    const pool = await poolPromise;

    // 查询所有收藏内容
    const result = await pool.request()
      .input('UserID', sql.Int, userID)
      .query(`
                SELECT 
    f.FavoriteID,
    f.ContentID,
    f.RoomID,
    COALESCE(g.Title, m.Title, b.Title, c.ChatName) AS Title,
    COALESCE(g.Image, m.Image, b.Image, c.Image) AS Image,
    CASE 
        WHEN f.RoomID IS NOT NULL THEN 'Community'
        WHEN g.GameID IS NOT NULL THEN 'Game'
        WHEN m.MovieID IS NOT NULL THEN 'Movie'
        WHEN b.BookID IS NOT NULL THEN 'Book'
    END AS ContentType
FROM Favorites f
LEFT JOIN Games g ON f.ContentID = g.GameID
LEFT JOIN Movies m ON f.ContentID = m.MovieID
LEFT JOIN Books b ON f.ContentID = b.BookID
LEFT JOIN Communities c ON f.RoomID = c.RoomID
WHERE f.UserID = @UserID
            `);
        
        const deduplicateByRoomID = (arr) => {
  const seen = new Set();
  return arr.filter(item => {
    if (seen.has(item.RoomID)) return false;
    seen.add(item.RoomID);
    return true;
  });
};

const favorites = {
  games: result.recordset.filter(item => item.ContentType === 'Game'),
  movies: result.recordset.filter(item => item.ContentType === 'Movie'),
  books: result.recordset.filter(item => item.ContentType === 'Book'),
  communities: deduplicateByRoomID(
    result.recordset.filter(item => item.ContentType === 'Community')
      .map(item => ({
        ...item,
        ChatName: item.Title,
        Description: "",
        isFavorite: true
      }))
  )
};

        
        res.render('fav-list', { 
            title: 'Favorites',
            favorites,
            user: req.session.user
        });
    } catch (err) {
        console.error('Error fetching favorites:', err);
        res.render('fav-list', {
            title: 'Favorites',
            favorites: { games: [], movies: [], books: [], communities: [] },
            error: 'Failed to load favorites'
        });
    }
});

//get add route
router.get("/add", isAuthenticated, function (req, res) {
  res.render("add", {
    title: "Request"
  });
});


//post add route
// POST: save new request to database with uploaded image
router.post("/add", isAuthenticated, upload.single('image'), async function (req, res) {
  const { type, title, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const userID = req.session.user.UserID;

  // Validate input
  if (!type || !title || !description || !imagePath) {
    return res.render("add", {
      title: "Request",
      errorMessage: "All fields are required."
    });
  }

  try {
    const pool = await poolPromise;

    await pool.request()
      .input("UserID", sql.Int, userID)
      .input("Status", sql.NVarChar, "Pending")
      .input("Description", sql.NVarChar, description)
      .input("ContentType", sql.NVarChar, type)
      .input("Title", sql.NVarChar, title)
      .input("Image", sql.NVarChar, imagePath)
      .query(`
        INSERT INTO Requests (UserID, Status, Description, ContentType, Title, Image)
        VALUES (@UserID, @Status, @Description, @ContentType, @Title, @Image)
      `);

    res.render("add", {
      title: "Request",
      successMessage: "Your request has been received."
    });
  } catch (err) {
    console.error("Database insert error:", err);
    res.render("add", {
      title: "Request",
      errorMessage: "Something went wrong while saving your request."
    });
  }
});

//admin-panel get
router.get("/admin-panel", isAuthenticated, isAdmin, async function (req, res) {
  try {
    const pool = await poolPromise;

    // Pending requests
    const pendingResult = await pool.request()
      .query(`
        SELECT 
          r.RequestID,
          r.Title,
          r.Description,
          r.Status,
          r.ContentType,
          r.Image,
          u.Username
        FROM Requests r
        JOIN Users u ON r.UserID = u.UserID
        WHERE r.Status = 'Pending'
      `);

    // Completed requests
    const completedResult = await pool.request()
      .query(`
        SELECT 
          r.RequestID,
          r.Title,
          r.Description,
          r.Status,
          r.ContentType,
          r.Image,
          u.Username
        FROM Requests r
        JOIN Users u ON r.UserID = u.UserID
        WHERE r.Status IN ('Approved', 'Rejected')
      `);


    res.render("admin-panel", {
      title: "Admin Panel",
      user: req.session.user,
      pendingRequests: pendingResult.recordset,
      completedRequests: completedResult.recordset,
      errorMessage: null
    });



  } catch (error) {
    console.error("Failed to load requests:", error);
    res.render("admin-panel", {
      title: "Admin Panel",
      pendingRequests: [],
      completedRequests: [],
      errorMessage: "Failed to load requests"
    });
  }
});

//POST
router.post("/admin-panel", isAuthenticated, isAdmin, upload.single("image"), async (req, res) => {
  const { type, title, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const userId = req.session.user.UserID;
  const username = req.session.user.Username;

  if (!type || !title || !description || !imagePath) {
    return res.redirect("/admin-panel?error=All+fields+are+required");
  }

  try {
    const pool = await poolPromise;

    // Insert into Requests with status 'Approved'
    // 1. First insert into Requests
    await pool.request()
      .input("ContentType", sql.VarChar, type)
      .input("Title", sql.NVarChar, title)
      .input("Description", sql.NVarChar, description)
      .input("Image", sql.NVarChar, imagePath)
      .input("Status", sql.NVarChar, 'Approved')
      .input("UserID", sql.Int, userId)
      .query(`
    INSERT INTO Requests (ContentType, Title, Description, Image, Status, UserID)
    VALUES (@ContentType, @Title, @Description, @Image, @Status, @UserID)
  `);

    
    // 2. Then insert into real content table
let insertContentQuery = "";
if (type === "Book") {
  insertContentQuery = `INSERT INTO Books (Title, Description, Image, AddedByUserID) VALUES (@Title, @Description, @Image, @UserID)`;
} else if (type === "Movie") {
  insertContentQuery = `INSERT INTO Movies (Title, Description, Image, AddedByUserID) VALUES (@Title, @Description, @Image, @UserID)`;
} else if (type === "Game") {
  insertContentQuery = `INSERT INTO Games (Title, Description, Image, AddedByUserID) VALUES (@Title, @Description, @Image, @UserID)`;
} else {
  console.error("Invalid type value received:", type);
  return res.status(400).render("error", { message: "Invalid content type." });
}

    await pool.request()
      .input("Title", sql.NVarChar, title)
      .input("Description", sql.NVarChar, description)
      .input("Image", sql.NVarChar, imagePath)
      .input("UserID", sql.Int, userId)
      .query(insertContentQuery);



    return res.redirect("/admin-panel?success=Content+successfully+created");
  } catch (err) {
    console.error("Create content error:", err);
    return res.redirect("/admin-panel?error=Something+went+wrong");
  }
});

router.get('/admin-panel/:requestID', isAuthenticated, isAdmin, async (req, res) => {
  const requestID = req.params.requestID;

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("RequestID", sql.Int, requestID)
      .query(`
        SELECT 
          r.RequestID,
          r.Title,
          r.Description,
          r.Status,
          r.ContentType,
          r.Image,
          u.Username
        FROM Requests r
        JOIN Users u ON r.UserID = u.UserID
        WHERE r.RequestID = @RequestID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).render("error", { message: "Request not found" });
    }

    const request = result.recordset[0];

    res.render("request-detail", {
      request
    });
  } catch (err) {
    console.error("Error loading request detail:", err);
    res.status(500).render("error", { message: "Failed to load request detail" });
  }
});



router.post('/admin/edit/:id', isAdmin, upload.single('image'), async (req, res) => {
  const action = req.body.action;
  const requestId = parseInt(req.params.id);
  const { type, title, description } = req.body;

  try {
    const pool = await poolPromise;

    if (action === 'accept') {
      // 1. Request
      const result = await pool.request()
        .input("RequestID", sql.Int, requestId)
        .query(`SELECT * FROM Requests r JOIN Users u ON r.UserID = u.UserID WHERE r.RequestID = @RequestID`);

      if (result.recordset.length === 0) {
        return res.status(404).render("error", { message: "Request not found" });
      }

      const request = result.recordset[0];
      const uploadedImage = req.file ? `/uploads/${req.file.filename}` : null;
      const imageToUse = uploadedImage || request.Image;

      // 2. UserID
      const userId = parseInt(request.UserID);
      if (isNaN(userId)) {
        console.error("UserID is not a number:", request.UserID);
        return res.status(500).render("error", { message: "Invalid user ID in request." });
      }


      if (type === "Game") {
        await pool.request()
          .input("Title", sql.NVarChar, title)
          .input("Description", sql.NVarChar, description)
          .input("Image", sql.NVarChar, imageToUse)
          .input("AddedByUserID", sql.Int, userId)
          .query(`
            INSERT INTO Games (Title, Description, Image, AddedByUserID)
            VALUES (@Title, @Description, @Image, @AddedByUserID)
          `);
      } else if (type === "Book") {
        await pool.request()
          .input("Title", sql.NVarChar, title)
          .input("Description", sql.NVarChar, description)
          .input("Image", sql.NVarChar, imageToUse)
          .input("AddedByUserID", sql.Int, userId)
          .query(`
            INSERT INTO Books (Title, Description, Image, AddedByUserID)
            VALUES (@Title, @Description, @Image, @AddedByUserID)
          `);
      } else if (type === "Movie") {
        await pool.request()
          .input("Title", sql.NVarChar, title)
          .input("Description", sql.NVarChar, description)
          .input("Image", sql.NVarChar, imageToUse)
          .input("AddedByUserID", sql.Int, userId)
          .query(`
            INSERT INTO Movies (Title, Description, Image, AddedByUserID)
            VALUES (@Title, @Description, @Image, @AddedByUserID)
          `);
      }

      // 3. Request
      await pool.request()
        .input("RequestID", sql.Int, requestId)
        .query(`UPDATE Requests SET Status = 'Approved' WHERE RequestID = @RequestID`);


      return res.render('status', {
        message: 'Request accepted and added to content. Redirecting...',
        redirect: '/admin-panel'
      });
    }

if (action === 'decline') {
    await pool.request()
    .input("RequestID", sql.Int, requestId)
    .query(`UPDATE Requests SET Status = 'Rejected' WHERE RequestID = @RequestID`);


  return res.render('status', {
    message: 'Request Declined and marked as Declined. Redirecting to admin panel...',
    redirect: '/admin-panel'
  });
}

  } catch (err) {
    console.error("Admin edit error:", err);
    res.status(500).render("error", { message: "Failed to process request" });
  }
});

/*get chatroom */
router.get("/chatroom", async function (req, res) {
  // 1. 必须登录
  if (!req.session.user) {
    return res.redirect("/login");
  }

  // 2. 从 URL query 里读 RoomID
  const RoomID = parseInt(req.query.RoomID, 10);
  if (isNaN(RoomID)) {
    return res.status(400).send("Community ID Not Exists");
  }

  try {
    const pool = await poolPromise;

    // 3. 查 Communities 里是不是有这个 RoomID
    const roomResult = await pool.request()
      .input("RoomID", sql.Int, RoomID)
      .query("SELECT * FROM Communities WHERE RoomID = @RoomID");
    const room = roomResult.recordset[0];
    if (!room) {
      return res.status(404).send("Community Not Found");
    }

    // 4. 查这个房间已经收藏（Favorites）它的成员列表
    const membersResult = await pool.request()
      .input("RoomID", sql.Int, RoomID)
      .query(`
        SELECT u.UserID, u.Username, u.Image
        FROM Favorites f
        JOIN Users u ON f.UserID = u.UserID
        WHERE f.RoomID = @RoomID
      `);
    const members = membersResult.recordset;

    // 5. 查这个房间的历史消息
    const messagesResult = await pool.request()
      .input("RoomID", sql.Int, RoomID)
      .query(`
        SELECT m.MessageID, m.FromUser, u.Username, m.Content, m.Time, m.RoomID
        FROM Messages m
        JOIN Users u ON m.FromUser = u.UserID
        WHERE m.RoomID = @RoomID
        ORDER BY m.MessageID ASC
      `);
    const messages = messagesResult.recordset.map(r => ({
      MessageID: r.MessageID,
      FromUser: r.FromUser,
      Username: r.Username,
      Content: r.Content,
      Time: r.Time,
      RoomID: r.RoomID
    }));

    // 6. 左侧只显示当前用户真正“收藏（Favorites）”过的社区列表
    const userCommunitiesResult = await pool.request()
      .input("UserID", sql.Int, req.session.user.UserID)
      .query(`
        SELECT c.RoomID, c.ChatName, c.Image
        FROM Communities c
        JOIN Favorites f ON c.RoomID = f.RoomID
        WHERE f.UserID = @UserID
        ORDER BY c.ChatName ASC
      `);
    const rooms = userCommunitiesResult.recordset;

    // 7. 渲染 chatroom.hbs，把 currentRoom、rooms、members、messages 全部给前端
    return res.render("chatroom", {
      user: req.session.user,
      currentRoom: {
        room: room,
        members: members
      },
      rooms: rooms,
      messages: messages
    });
  } catch (err) {
    console.error("Error loading chatroom", err);
    return res.status(500).send("Server Error");
  }
});
/*Get test chatroom*/
router.get("/testroom", function (req, res) {
  res.render("testroom", {});
});

module.exports = router;