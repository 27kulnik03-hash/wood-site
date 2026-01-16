const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tree_encyclopedia',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL database');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error connecting to MySQL:', error.message);
        return false;
    }
}

// Initialize database and create tables
async function initializeDatabase() {
    try {
        console.log('📦 Creating database if not exists...');
        
        // Create database if it doesn't exist (connect without database name)
        const tempConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });

        await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`✅ Database '${dbConfig.database}' is ready`);
        await tempConnection.end();

        // Now create tables using the pool (which connects to the database)
        const connection = await pool.getConnection();
        
        console.log('📋 Creating users table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_username (username),
                INDEX idx_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('📋 Creating trees table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS trees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                scientific_name VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                habitat TEXT NOT NULL,
                image LONGTEXT NOT NULL,
                facts JSON,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_created_by (created_by),
                INDEX idx_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        connection.release();
        console.log('✅ Database tables initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        console.error('Full error:', error);
        return false;
    }
}

module.exports = {
    pool,
    testConnection,
    initializeDatabase
};
