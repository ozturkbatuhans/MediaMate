# MediaMate

A comprehensive media discovery and community platform for books, movies, and games

<img width="1903" height="656" alt="image" src="https://github.com/user-attachments/assets/0275ef2d-59f9-455c-829a-eace9bd7545d" />
<img width="1900" height="1073" alt="image" src="https://github.com/user-attachments/assets/a0590cf0-c171-42ad-83d3-53e19c6933d0" />
<img width="1890" height="1068" alt="image" src="https://github.com/user-attachments/assets/99dfbf74-a251-4260-98c7-0b7efbb60ee5" />

## Table of Contents
- [About](#about)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Team Contributions](#team-contributions)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Integration](#api-integration)
- [Screenshots](#screenshots)
- [License](#license)

## About

MediaMate is a full-stack web application developed as a group project for **Vives Programmeren Graduaat**. The platform enables users to discover, rate, and discuss books, movies, and games while connecting with like-minded individuals through community chat rooms.

This project was built using **Agile methodology** with a team of 4 developers over multiple sprints, emphasizing collaborative development and iterative progress.

## Features

- **Content Discovery** - Browse thousands of books, movies, and games
- **Advanced Search** - Filter by genre, type, and custom queries with pagination
- **User Reviews** - Rate and review media with a 5-star system
- **Favorites System** - Bookmark favorite content and communities
- **Real-time Chat** - Join community rooms with Socket.io
- **Authentication** - Secure login/registration with session management
- **Admin Panel** - Moderate requests and manage content
- **Content Requests** - Users can suggest new additions
- **Responsive Design** - Mobile-friendly Bootstrap 5 interface

## Technology Stack

### Backend
- Node.js & Express.js
- MS SQL Server
- Socket.io
- bcrypt
- Multer
- Handlebars (HBS)
- express-session

### Frontend
- Handlebars
- Bootstrap 5
- Vanilla JavaScript
- Socket.io Client

### APIs
- RAWG API (Games)
- TMDB API (Movies)
- Google Books API (Books)

## Team Contributions

This project was developed by 4 students at Vives Programmeren Graduaat.

### Batu's Contributions

**Frontend Pages:**
- Category pages (Books, Movies, Games)
- User profile page with editing
- Homepage with content sliders
- FAQ page
- Chat and community pages
- Favorites page
- Contact form
- Login/Register pages

**Backend Modules:**
- Database configuration (db.js)
- Game API sync (sync-games.js)
- User authentication (login.js, register.js)
- User management (user.js)
- Search functionality (search.js)
- Category content (category.js)
- Homepage content (home.js)
- Detail pages (detail.js)
- Best-rated system (bestRated.js)

**Additional:**
- Image upload with Multer
- Session configuration
- CSS styling
- Database schema design

### Other Team Members
- **Sybren** - Backend API integration, database operations, admin features
- **Pavel** - Frontend components, detail pages, community features
- **Ke** - Chat functionality, Socket.io integration, community management

## Installation

### Prerequisites
- Node.js (v14+)
- MS SQL Server
- npm or yarn

### Steps

1. Clone the repository
```bash
git clone <repository-url>
cd mediamate
npm install
npm start
Open browser to http://localhost:3001

```
## Database Setup

### 1. Create Database
Run `newDbMediaMate.sql` in SQL Server Management Studio to create the MediaMate database.

### 2. Create Tables
Run `QueryMediaMate.sql` in the MediaMate database to create all tables and relationships.

### 3. Configure SQL Server
- Open SQL Server Configuration Manager
- Enable TCP/IP protocol
- Set TCP port to 1433
- Enable SQL Server Browser
- Restart SQL Server service

### 4. Populate Data (Optional)
```bash
node scripts/api/sync-books.js
node scripts/api/sync-movies.js
node scripts/api/sync-games.js
```

##Project Structure
      
      mediamate/
      ├── config/              # Configuration files
      │   ├── db.js
      │   ├── multer.js
      │   └── mapping.js
      ├── modules/             # Business logic
      │   ├── login.js
      │   ├── register.js
      │   ├── user.js
      │   ├── search.js
      │   └── ...
      ├── routes/              # Express routes
      │   ├── index.js
      │   └── community.js
      ├── views/               # Handlebars templates
      │   ├── layouts/
      │   ├── partials/
      │   └── *.hbs
      ├── public/              # Static files
      │   ├── stylesheets/
      │   ├── javascripts/
      │   └── images/
      ├── scripts/             # Utility scripts
      │   ├── api/
      │   └── database/
      ├── app.js               # Main application
      └── package.json

## API Integration

### RAWG API (Games)
- Rate limit: ~60 requests/minute
- Handles retries and delays
- Fetches game data with genres

### TMDB API (Movies)
- Standard rate limits
- Retry logic implemented
- Fetches movie metadata

### Google Books API (Books)
- No authentication required
- Public data access
- Book information retrieval

## Database Schema

Main tables:
- **Users** - Authentication and profiles
- **Books, Movies, Games** - Content tables
- **Content** - Unified reference
- **Genres** - Category system
- **Content_Genre** - Many-to-many relationships
- **Reviews** - Ratings and comments
- **Favorites** - User bookmarks
- **Communities** - Chat rooms
- **Messages** - Chat history
- **Requests** - User submissions

## Security

- bcrypt password hashing
- Parameterized SQL queries
- Session management
- File upload validation
- Input sanitization

## Development Methodology

Developed using Agile methodology:
- Sprint-based cycles
- Task tracking in Google Sheets
- Daily progress updates
- Iterative development
- Continuous integration

## Known Issues

- Chat message persistence optimization needed
- Some genre mappings require refinement
- Limited to English content

## Future Improvements

- Private messaging
- Recommendation system
- Social features
- Multi-language support
- Mobile app

## License

Educational project developed for Vives Programmeren Graduaat.

## Acknowledgments

- Vives University of Applied Sciences
- RAWG, TMDB, and Google Books APIs
- Project instructors
- Development team

## Contact

**Institution:** Vives Programmeren Graduaat  
**Team:** Batu, Sybren, Pavel, Ke

---

**Note:** This is an educational project for academic purposes.
