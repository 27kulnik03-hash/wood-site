require('dotenv').config(); // Загружаем переменные окружения

const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── PostgreSQL ───────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ─── Проверка подключения ─────────────────────────────
pool.query('SELECT NOW()')
    .then(res => console.log('✅ PostgreSQL подключен, время:', res.rows[0].now))
    .catch(err => console.error('❌ Ошибка подключения:', err));

// ─── Папка для аватаров ──────────────────────────────
const avatarDir = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

// ─── Multer для аватаров ─────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
        if (!req.session.user || !req.session.user.id) return cb(new Error('Пользователь не авторизован'));
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${req.session.user.id}-${uniqueSuffix}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Разрешены только изображения: jpeg, jpg, png, gif'));
    }
});

// ─── Middleware ───────────────────────────────────────
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));

const isProduction = process.env.NODE_ENV === 'production';

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProduction ? 'none' : 'lax'
    }
}));

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Доступ запрещён');
    }
    next();
}

// ─── Проверка авторизации и готовности БД ────────────
let dbReady = false;

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Требуется авторизация' });
    next();
}

function checkDbReady(req, res, next) {
    if (!dbReady) return res.status(503).json({ error: 'База данных не готова' });
    next();
}

// ─── Инициализация БД ────────────────────────────────
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

        console.log('✅ Таблицы инициализированы');
        dbReady = true;
    } catch (err) {
        console.error('❌ Ошибка инициализации таблиц:', err);
        process.exit(1);
    }
}

// ─── Auth API ────────────────────────────────────────

app.delete('/api/admin/users/:id', requireAdmin, checkDbReady, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

        // Защита: админ не может удалить сам себя
        if (userId === req.session.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API для админки
app.get('/api/admin/users', requireAdmin, checkDbReady, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.email, u.role, u.created_at,
                   COUNT(t.id) AS trees_count
            FROM users u
            LEFT JOIN trees t ON t.created_by = u.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        res.json({ success: true, users: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

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

app.post('/api/auth/register', checkDbReady, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ error: 'Все поля обязательны' });
        if (password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символов' });

        const existingRes = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (existingRes.rows.length > 0) return res.status(400).json({ error: 'Имя пользователя или email уже занят' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [username, email, hashedPassword, 'user']
        );

        req.session.user = {
            id: result.rows[0].id,
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

app.post('/api/auth/login', checkDbReady, async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query(
            'SELECT id, username, password, avatar, role FROM users WHERE username = $1 OR email = $2',
            [username, username]
        );
        if (result.rows.length === 0) return res.status(401).json({ error: 'Неверные данные' });

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Неверные данные' });

        req.session.user = {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            role: user.role
        };

        res.json({ success: true, message: 'Вход выполнен' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// ─── Аватар ─────────────────────────────────────────
app.post('/api/user/avatar', requireAuth, checkDbReady, (req, res, next) => {
    upload.single('avatar')(req, res, function(err) {
        if (err) return res.status(400).json({ error: err.message });
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен или неверный формат' });
        const avatarPath = `/uploads/avatars/${req.file.filename}`;

        await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatarPath, req.session.user.id]);
        req.session.user.avatar = avatarPath;

        res.json({ success: true, message: 'Аватар обновлён', avatar: avatarPath });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не удалось сохранить аватар' });
    }
});

app.get('/api/user/profile', requireAuth, checkDbReady, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, avatar, role FROM users WHERE id = $1',
            [req.session.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ─── Деревья ───────────────────────────────────────
app.get('/api/trees', checkDbReady, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, u.username as creator_name
            FROM trees t
            LEFT JOIN users u ON t.created_by = u.id
            ORDER BY t.created_at DESC
        `);

        res.json({
            success: true,
            trees: result.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Не удалось загрузить деревья' });
    }
});

// Новый эндпоинт: получение одного дерева
app.get('/api/trees/:id', checkDbReady, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT t.*, u.username as creator_name
            FROM trees t
            LEFT JOIN users u ON t.created_by = u.id
            WHERE t.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Дерево не найдено' });
        }

        res.json({
            success: true,
            tree: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/trees/:id', requireAuth, checkDbReady, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, scientificName, description, habitat, image, facts } = req.body;

        if (!name || !scientificName || !description || !habitat || !image) {
            return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
        }

        // Проверка прав
        const ownerRes = await pool.query('SELECT created_by FROM trees WHERE id = $1', [id]);
        if (ownerRes.rows.length === 0) return res.status(404).json({ error: 'Дерево не найдено' });

        const isOwner = ownerRes.rows[0].created_by === req.session.user.id;
        const isAdmin = req.session.user.role === 'admin';
        if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Нет прав на редактирование' });

        const factsJson = facts && typeof facts === 'object' ? JSON.stringify(facts) : '{}';

        await pool.query(`
            UPDATE trees
            SET name = $1, scientific_name = $2, description = $3, habitat = $4,
                image = $5, facts = $6
            WHERE id = $7
        `, [name, scientificName, description, habitat, image, factsJson, id]);

        res.json({ success: true, message: 'Дерево обновлено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при обновлении' });
    }
});

app.post('/api/trees', requireAuth, checkDbReady, async (req, res) => {
    try {
        const { name, scientificName, description, habitat, image, facts } = req.body;
        if (!name || !scientificName || !description || !habitat || !image) return res.status(400).json({ error: 'Missing required fields' });

        const factsJson = facts && typeof facts === 'object' ? JSON.stringify(facts) : '{}';

        const result = await pool.query(
            `INSERT INTO trees (name, scientific_name, description, habitat, image, facts, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [name, scientificName, description, habitat, image, factsJson, req.session.user.id]
        );

        res.json({ success: true, message: 'Tree added', id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add tree' });
    }
});

app.delete('/api/trees/:id', requireAuth, checkDbReady, async (req, res) => {
    try {
        const treeId = req.params.id;
        const result = await pool.query('SELECT created_by FROM trees WHERE id = $1', [treeId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Дерево не найдено' });

        const treeCreatorId = result.rows[0].created_by;
        const isAdmin = req.session.user.role === 'admin';
        const isOwner = treeCreatorId === req.session.user.id;

        if (!isAdmin && !isOwner) return res.status(403).json({ error: 'У вас нет прав на удаление этого дерева' });

        await pool.query('DELETE FROM trees WHERE id = $1', [treeId]);
        res.json({ success: true, message: 'Дерево удалено' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при удалении' });
    }
});

// ─── Страницы ───────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/add-tree', (req, res) => res.sendFile(path.join(__dirname, 'public', 'add-tree.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ─── Запуск сервера ───────────────────────────────
initializeDatabase().then(() => {
    app.listen(PORT, () => console.log(`✅ Сервер запущен → http://localhost:${PORT}`));
});

// ─── Завершение сервера ───────────────────────────
process.on('SIGINT', async () => {
    console.log('Остановка сервера...');
    await pool.end();
    process.exit(0);
});