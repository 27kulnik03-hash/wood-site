# Tree Encyclopedia

A beautiful web application for exploring information about different types of trees, featuring user registration and authentication.

## Features

- 🌳 Browse tree cards with photos and names
- 📖 View detailed information in modal windows
- 👤 User registration and login system
- 🔐 Secure password hashing with bcrypt
- 💾 MySQL 8.0.44 database for user storage
- 🎨 Modern, responsive design

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- MySQL 8.0.44 (or compatible version)

### Installation

1. **Install MySQL 8.0.44** (if not already installed)
   - Download from: https://dev.mysql.com/downloads/mysql/
   - Or use a package manager: `brew install mysql@8.0` (macOS) or `apt-get install mysql-server` (Linux)

2. **Create MySQL database and user:**
   ```sql
   CREATE DATABASE tree_encyclopedia;
   CREATE USER 'tree_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON tree_encyclopedia.* TO 'tree_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. **Configure database connection:**
   - Copy `.env.example` to `.env`
   - Update the database credentials in `.env`:
   ```
   DB_HOST=localhost
   DB_USER=tree_user
   DB_PASSWORD=your_password
   DB_NAME=tree_encyclopedia
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

6. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

## Usage

### Registration

1. Click the "Register" button in the header
2. Fill in your username, email, and password (minimum 6 characters)
3. Click "Register"
4. You'll be automatically logged in and redirected to the home page

### Login

1. Click the "Login" button in the header
2. Enter your username (or email) and password
3. Click "Login"
4. You'll be redirected to the home page

### Exploring Trees

- Click on any tree card to view detailed information in a modal window
- The modal displays the tree's description, habitat, and key facts
- Close the modal by clicking the X, clicking outside, or pressing Escape

## Project Structure

```
├── server.js          # Express server and API routes
├── package.json       # Dependencies and scripts
├── config/           # Configuration files
│   └── database.js   # MySQL database configuration
├── database/         # Database files
│   └── schema.sql    # MySQL schema
├── .env              # Environment variables (create from .env.example)
└── public/           # Frontend files
    ├── index.html    # Main page
    ├── register.html # Registration page
    ├── login.html    # Login page
    ├── styles.css    # Stylesheet
    ├── script.js     # Main page JavaScript
    └── auth.js       # Authentication JavaScript
```

## API Endpoints

- `GET /api/auth/check` - Check if user is logged in
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

## Database

The application uses **MySQL 8.0.44** with a `users` table that stores:
- id (INT, primary key, auto-increment)
- username (VARCHAR(255), unique)
- email (VARCHAR(255), unique)
- password (VARCHAR(255), hashed with bcrypt)
- created_at (TIMESTAMP, default CURRENT_TIMESTAMP)

The database schema is automatically created on first run. You can also manually run `database/schema.sql` to create the database structure.

## Technologies Used

- **Backend**: Node.js, Express
- **Database**: MySQL 8.0.44 (mysql2)
- **Authentication**: bcrypt, express-session
- **Frontend**: HTML, CSS, JavaScript

## Notes

- The database and tables will be created automatically on first run
- Make sure MySQL is running before starting the server
- Session cookies are used for authentication
- Passwords are hashed using bcrypt with 10 salt rounds
- The application runs on port 3000 by default
- Connection pooling is used for better performance
