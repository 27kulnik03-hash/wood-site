# MySQL 8.0.44 Setup Guide

## Quick Setup

### 1. Install MySQL 8.0.44

**Windows:**
- Download MySQL Installer from: https://dev.mysql.com/downloads/installer/
- Choose "MySQL Server 8.0.44" during installation
- Remember the root password you set

**macOS:**
```bash
brew install mysql@8.0
brew services start mysql@8.0
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install mysql-server-8.0
sudo systemctl start mysql
sudo systemctl enable mysql
```

### 2. Create Database and User

Open MySQL command line or MySQL Workbench and run:

```sql
-- Create database
CREATE DATABASE IF NOT EXISTS tree_encyclopedia;

-- Create user (optional, or use root)
CREATE USER IF NOT EXISTS 'tree_user'@'localhost' IDENTIFIED BY 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON tree_encyclopedia.* TO 'tree_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and update with your MySQL credentials:
   ```
   DB_HOST=localhost
   DB_USER=tree_user
   DB_PASSWORD=your_secure_password
   DB_NAME=tree_encyclopedia
   ```

   Or if using root:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_root_password
   DB_NAME=tree_encyclopedia
   ```

### 4. Install Dependencies and Start

```bash
npm install
npm start
```

## Verify Installation

1. Check MySQL is running:
   ```bash
   mysql --version
   ```

2. Test connection:
   ```bash
   mysql -u tree_user -p tree_encyclopedia
   ```

3. Check tables:
   ```sql
   SHOW TABLES;
   SELECT * FROM users;
   ```

## Troubleshooting

### Connection Refused
- Make sure MySQL service is running
- Check if MySQL is listening on port 3306 (default)
- Verify firewall settings

### Access Denied
- Double-check username and password in `.env`
- Verify user has proper privileges
- Try using root user for testing

### Database Not Found
- The application will create the database automatically
- Or manually run: `CREATE DATABASE tree_encyclopedia;`

## Migration from SQLite

If you have existing data in SQLite (`trees.db`), you'll need to:

1. Export data from SQLite
2. Import into MySQL
3. Update the application to use MySQL

The application will automatically create the MySQL schema on first run.
