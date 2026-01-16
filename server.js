const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Multer настройка для аватаров
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/avatars/');
    },
    filename: (req, file, cb) => {
        if (!req.session.user || !req.session.user.id) {
            return cb(new Error('Пользователь не авторизован'));
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${req.session.user.id}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Разрешены только изображения: jpeg, jpg, png, gif'));
    }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'tree-encyclopedia-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 }
}));

let dbReady = false;

async function testConnection() {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        console.log('✅ Connected to PostgreSQL');
        return true;
    } catch (err) {
        console.error('PostgreSQL connection error:', err);
        return false;
    }
}

async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                avatar VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS trees (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                scientific_name VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                habitat TEXT NOT NULL,
                image TEXT NOT NULL,
                facts JSONB DEFAULT '{}',
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Tables initialized');
        return true;
    } catch (err) {
        console.error('Table initialization error:', err);
        return false;
    }
}

async function startServer() {
    const connected = await testConnection();
    if (!connected) {
        console.error('Не удалось подключиться к PostgreSQL');
        process.exit(1);
    }

    const initialized = await initializeDatabase();
    if (!initialized) {
        console.error('Не удалось инициализировать таблицы');
        process.exit(1);
    }

    dbReady = true;
    console.log('✅ База данных готова');
}

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    next();
}

// ─── API ───────────────────────────────────────────────

app.get('/api/auth/check', (req, res) => {
    res.json({
        loggedIn: !!req.session.user,
        user: req.session.user ? {
            id: req.session.user.id,
            username: req.session.user.username,
            avatar: req.session.user.avatar || null,
            role: req.session.user.role || 'user'
        } : null
    });
});

app.post('/api/auth/register', async (req, res) => {
    if (!dbReady) return res.status(503).json({ error: 'База данных не готова' });

    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль минимум 6 символов' });
        }

        const existingRes = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $1',
            [username, email]
        );
        if (existingRes.rows.length > 0) {
            return res.status(400).json({ error: 'Имя пользователя или email уже занят' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [username, email, hashedPassword, 'user']
        );

        const insertId = result.rows[0].id;

        req.session.user = {
            id: insertId,
            username,
            avatar: null,
            role: 'user'
        };

        res.json({ success: true, message: 'Регистрация успешна' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    if (!dbReady) return res.status(503).json({ error: 'База данных не готова' });

    try {
        const { username, password } = req.body;
        const result = await pool.query(
            'SELECT id, username, password, avatar, role FROM users WHERE username = $1 OR email = $1',
            [username]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверные данные' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Неверные данные' });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            role: user.role
        };

        res.json({
            success: true,
            message: 'Вход выполнен'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// ─── Аватар ────────────────────────────────────────────

app.post('/api/user/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен или неверный формат' });
    }

    try {
        const avatarPath = `/uploads/avatars/${req.file.filename}`;

        await pool.query(
            'UPDATE users SET avatar = $1 WHERE id = $2',
            [avatarPath, req.session.user.id]
        );

        req.session.user.avatar = avatarPath;

        res.json({
            success: true,
            message: 'Аватар обновлён',
            avatar: avatarPath
        });
    } catch (err) {
        console.error('Ошибка сохранения аватара:', err);
        res.status(500).json({ error: 'Не удалось сохранить аватар' });
    }
});

app.get('/api/user/profile', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, avatar, role FROM users WHERE id = $1',
            [req.session.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ─── Деревья ───────────────────────────────────────────

app.get('/api/trees', async (req, res) => {
    console.log('GET /api/trees — запрос получен');
    try {
        const result = await pool.query(`
            SELECT t.*, u.username as creator_name
            FROM trees t
            LEFT JOIN users u ON t.created_by = u.id
            ORDER BY t.created_at DESC
        `);
        console.log('Деревьев найдено:', result.rows.length);
        res.json({ success: true, trees: result.rows });
    } catch (err) {
        console.error('Ошибка GET /api/trees:', err);
        res.status(500).json({ error: 'Не удалось загрузить деревья' });
    }
});

app.post('/api/trees', requireAuth, async (req, res) => {
    if (!dbReady) return res.status(503).json({ error: 'Database not ready' });

    try {
        const { name, scientificName, description, habitat, image, facts } = req.body;

        if (!name || !scientificName || !description || !habitat || !image) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const factsJson = typeof facts === 'object' ? facts : {};

        const result = await pool.query(
            `INSERT INTO trees (name, scientific_name, description, habitat, image, facts, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [name, scientificName, description, habitat, image, JSON.stringify(factsJson), req.session.user.id]
        );

        res.json({ success: true, message: 'Tree added', id: result.rows[0].id });
    } catch (err) {
        console.error('Error adding tree:', err);
        res.status(500).json({ error: 'Failed to add tree' });
    }
});

app.delete('/api/trees/:id', requireAuth, async (req, res) => {
    try {
        const treeId = req.params.id;

        const result = await pool.query(
            'SELECT created_by FROM trees WHERE id = $1',
            [treeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Дерево не найдено' });
        }

        const treeCreatorId = result.rows[0].created_by;

        const isAdmin = req.session.user.role === 'admin';
        const isOwner = treeCreatorId === req.session.user.id;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ error: 'У вас нет прав на удаление этого дерева' });
        }

        await pool.query('DELETE FROM trees WHERE id = $1', [treeId]);

        res.json({ success: true, message: 'Дерево удалено' });
    } catch (err) {
        console.error('Ошибка удаления дерева:', err);
        res.status(500).json({ error: 'Ошибка сервера при удалении' });
    }
});

// Страницы
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/add-tree', (req, res) => res.sendFile(path.join(__dirname, 'public', 'add-tree.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

startServer().then(() => {
    app.listen(PORT, () => {
        console.log(`Сервер запущен → http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Ошибка запуска сервера:', err);
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('Остановка сервера...');
    await pool.end();
    process.exit(0);
});