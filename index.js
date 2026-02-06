const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// === Constants ===
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LOGINS_FILE = path.join(DATA_DIR, 'logins.json');
const LEGACY_DB = path.join(__dirname, 'diet_app.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Migrate logins.json from old root location into data/ if needed
const LEGACY_LOGINS = path.join(__dirname, 'logins.json');
if (fs.existsSync(LEGACY_LOGINS) && !fs.existsSync(LOGINS_FILE)) {
    fs.copyFileSync(LEGACY_LOGINS, LOGINS_FILE);
    console.log('Migrated logins.json into data/ directory');
}

// Ensure logins.json exists
if (!fs.existsSync(LOGINS_FILE)) {
    fs.writeFileSync(LOGINS_FILE, '[]', 'utf8');
}

// === Promisified SQLite Helpers ===

const openDb = (dbPath) => new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) reject(err);
        else resolve(db);
    });
});

const dbRun = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const dbGet = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (db, sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// === Logins File Management ===

const readLogins = () => {
    try {
        return JSON.parse(fs.readFileSync(LOGINS_FILE, 'utf8'));
    } catch {
        return [];
    }
};

const writeLogins = (logins) => {
    fs.writeFileSync(LOGINS_FILE, JSON.stringify(logins, null, 2), 'utf8');
};

// === Session Management ===

const sessions = new Map();
const generateToken = () => crypto.randomBytes(32).toString('hex');

// === Per-User Database Management ===

const userDbs = new Map();
const getUserDbPath = (username) => path.join(DATA_DIR, `${username}.db`);

const initUserTables = async (db) => {
    const tables = [
        `CREATE TABLE IF NOT EXISTS meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            calories_per_serving REAL NOT NULL,
            ounces_per_serving REAL NOT NULL,
            unit_type TEXT DEFAULT 'piece',
            category TEXT DEFAULT 'Other'
        )`,
        `CREATE TABLE IF NOT EXISTS meal_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meal_name TEXT NOT NULL,
            calories REAL NOT NULL,
            date TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS quick_add_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            calories REAL NOT NULL,
            date TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS blood_pressure_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            systolic INTEGER NOT NULL,
            diastolic INTEGER NOT NULL,
            timestamp TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS weight_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            weight REAL NOT NULL,
            date TEXT NOT NULL UNIQUE
        )`,
        `CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS exercise_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exercise_name TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            calories_burned INTEGER,
            date TEXT NOT NULL,
            notes TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS meal_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#007bff',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS meal_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meal_name TEXT NOT NULL,
            planned_date TEXT NOT NULL,
            meal_type TEXT DEFAULT 'Other',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cooked_weight_oz REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS recipe_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id INTEGER NOT NULL,
            source_type TEXT NOT NULL DEFAULT 'custom',
            template_id INTEGER,
            name TEXT NOT NULL,
            calories_per_unit REAL NOT NULL,
            unit_type TEXT NOT NULL DEFAULT 'ounce',
            quantity REAL NOT NULL,
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
        )`
    ];
    await dbRun(db, 'PRAGMA foreign_keys = ON');
    for (const sql of tables) {
        await dbRun(db, sql);
    }
};

// === Default Food Templates (USDA-sourced raw calorie data) ===

const DEFAULT_FOOD_TEMPLATES = [
    // --- Beef (raw, per ounce) ---
    // USDA FoodData Central standard reference values
    { name: 'Ribeye Steak (Raw)', calories: 78, serving: 1, unit: 'ounce', category: 'Beef' },
    { name: 'Sirloin Steak (Raw)', calories: 46, serving: 1, unit: 'ounce', category: 'Beef' },
    { name: 'Flank Steak (Raw)', calories: 44, serving: 1, unit: 'ounce', category: 'Beef' },
    { name: 'Ground Beef 90/10 (Raw)', calories: 50, serving: 1, unit: 'ounce', category: 'Beef' },
    { name: 'Ground Beef 85/15 (Raw)', calories: 61, serving: 1, unit: 'ounce', category: 'Beef' },
    { name: 'Ground Beef 80/20 (Raw)', calories: 72, serving: 1, unit: 'ounce', category: 'Beef' },

    // --- Pork (raw, per ounce) ---
    { name: 'Pork Tenderloin (Raw)', calories: 39, serving: 1, unit: 'ounce', category: 'Pork' },
    { name: 'Pork Chop (Raw)', calories: 46, serving: 1, unit: 'ounce', category: 'Pork' },
    { name: 'Pork Loin Roast (Raw)', calories: 41, serving: 1, unit: 'ounce', category: 'Pork' },

    // --- Poultry (raw, per ounce) ---
    { name: 'Chicken Breast (Raw)', calories: 34, serving: 1, unit: 'ounce', category: 'Poultry' },
    { name: 'Chicken Thigh (Raw)', calories: 37, serving: 1, unit: 'ounce', category: 'Poultry' },
    { name: 'Chicken Wing (Raw)', calories: 54, serving: 1, unit: 'ounce', category: 'Poultry' },
    { name: 'Turkey Breast (Raw)', calories: 31, serving: 1, unit: 'ounce', category: 'Poultry' },

    // --- Seafood (raw, per ounce) ---
    { name: 'Salmon (Raw)', calories: 59, serving: 1, unit: 'ounce', category: 'Seafood' },
    { name: 'Tilapia (Raw)', calories: 27, serving: 1, unit: 'ounce', category: 'Seafood' },
    { name: 'Cod (Raw)', calories: 23, serving: 1, unit: 'ounce', category: 'Seafood' },
    { name: 'Haddock (Raw)', calories: 25, serving: 1, unit: 'ounce', category: 'Seafood' },
    { name: 'Shrimp (Raw)', calories: 24, serving: 1, unit: 'ounce', category: 'Seafood' },
    { name: 'Tuna (Raw)', calories: 31, serving: 1, unit: 'ounce', category: 'Seafood' },

    // --- Vegetables (raw, per ounce) ---
    { name: 'Broccoli (Raw)', calories: 10, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Cauliflower (Raw)', calories: 7, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Green Beans (Raw)', calories: 9, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Cabbage (Raw)', calories: 7, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Kale (Raw)', calories: 14, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Spinach (Raw)', calories: 7, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Sweet Potato (Raw)', calories: 24, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Celery (Raw)', calories: 4, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Cucumber (Raw)', calories: 4, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Zucchini (Raw)', calories: 5, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Asparagus (Raw)', calories: 6, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Mushrooms (Raw)', calories: 6, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Brussels Sprouts (Raw)', calories: 12, serving: 1, unit: 'ounce', category: 'Vegetables' },
    { name: 'Carrots (Raw)', calories: 12, serving: 1, unit: 'ounce', category: 'Vegetables' },

    // --- Vegetables (per piece) ---
    { name: 'Bell Pepper (Medium)', calories: 25, serving: 1, unit: 'piece', category: 'Vegetables' },
    { name: 'Onion (Medium)', calories: 45, serving: 1, unit: 'piece', category: 'Vegetables' },
    { name: 'Shallot', calories: 7, serving: 1, unit: 'piece', category: 'Vegetables' },
    { name: 'Tomato (Medium)', calories: 22, serving: 1, unit: 'piece', category: 'Vegetables' },

    // --- Sauces & Condiments (per ounce) ---
    { name: 'Tomato Paste', calories: 24, serving: 1, unit: 'ounce', category: 'Sauces' },
    { name: 'Tomato Sauce', calories: 9, serving: 1, unit: 'ounce', category: 'Sauces' },
    { name: 'Tomato Puree', calories: 11, serving: 1, unit: 'ounce', category: 'Sauces' },
    { name: 'Ketchup', calories: 19, serving: 1, unit: 'ounce', category: 'Sauces' },
    { name: 'Yellow Mustard', calories: 9, serving: 1, unit: 'ounce', category: 'Sauces' },
    { name: 'Brown Mustard', calories: 10, serving: 1, unit: 'ounce', category: 'Sauces' },
    { name: 'German Mustard', calories: 10, serving: 1, unit: 'ounce', category: 'Sauces' },
    { name: 'French Mustard (Dijon)', calories: 15, serving: 1, unit: 'ounce', category: 'Sauces' },
    { name: 'Mayonnaise', calories: 188, serving: 1, unit: 'ounce', category: 'Sauces' },

    // --- Oils & Condiments (per ounce) ---
    { name: 'Honey', calories: 86, serving: 1, unit: 'ounce', category: 'Oils & Condiments' },
    { name: 'Olive Oil', calories: 240, serving: 1, unit: 'ounce', category: 'Oils & Condiments' },
    { name: 'Avocado Oil', calories: 240, serving: 1, unit: 'ounce', category: 'Oils & Condiments' },
    { name: 'Peanut Butter', calories: 167, serving: 1, unit: 'ounce', category: 'Oils & Condiments' },

    // --- Grains (per gram) ---
    { name: 'White Rice (Cooked)', calories: 1.30, serving: 1, unit: 'gram', category: 'Grains' },
    { name: 'Brown Rice (Cooked)', calories: 1.12, serving: 1, unit: 'gram', category: 'Grains' },
    { name: 'Wild Rice (Cooked)', calories: 1.01, serving: 1, unit: 'gram', category: 'Grains' },
    { name: 'White Bread', calories: 2.65, serving: 1, unit: 'gram', category: 'Grains' },
    { name: 'Whole Wheat Bread', calories: 2.52, serving: 1, unit: 'gram', category: 'Grains' },
    { name: 'Quinoa (Cooked)', calories: 1.20, serving: 1, unit: 'gram', category: 'Grains' },
    { name: 'Oats (Dry)', calories: 3.89, serving: 1, unit: 'gram', category: 'Grains' },

    // --- Fruits ---
    { name: 'Banana (Medium)', calories: 105, serving: 1, unit: 'piece', category: 'Fruits' },
    { name: 'Apple (Medium)', calories: 95, serving: 1, unit: 'piece', category: 'Fruits' },
    { name: 'Avocado', calories: 45, serving: 1, unit: 'ounce', category: 'Fruits' },
    { name: 'Blueberries', calories: 16, serving: 1, unit: 'ounce', category: 'Fruits' },
    { name: 'Strawberries', calories: 9, serving: 1, unit: 'ounce', category: 'Fruits' },

    // --- Dairy & Eggs ---
    { name: 'Egg (Large)', calories: 72, serving: 1, unit: 'piece', category: 'Dairy & Eggs' },
    { name: 'Greek Yogurt (Plain, Nonfat)', calories: 17, serving: 1, unit: 'ounce', category: 'Dairy & Eggs' },
    { name: 'Cottage Cheese (Low Fat)', calories: 23, serving: 1, unit: 'ounce', category: 'Dairy & Eggs' },

    // --- Nuts & Seeds (per ounce) ---
    { name: 'Almonds', calories: 164, serving: 1, unit: 'ounce', category: 'Nuts & Seeds' },
    { name: 'Walnuts', calories: 185, serving: 1, unit: 'ounce', category: 'Nuts & Seeds' },

    // --- Legumes (per gram, cooked) ---
    { name: 'Lentils (Cooked)', calories: 1.16, serving: 1, unit: 'gram', category: 'Legumes' },
    { name: 'Black Beans (Cooked)', calories: 1.32, serving: 1, unit: 'gram', category: 'Legumes' },
    { name: 'Chickpeas (Cooked)', calories: 1.64, serving: 1, unit: 'gram', category: 'Legumes' },
];

const DEFAULT_CATEGORIES = [
    { name: 'Beef', color: '#DC2626' },
    { name: 'Pork', color: '#EA580C' },
    { name: 'Poultry', color: '#F59E0B' },
    { name: 'Seafood', color: '#0891B2' },
    { name: 'Vegetables', color: '#16A34A' },
    { name: 'Fruits', color: '#8B5CF6' },
    { name: 'Grains', color: '#D97706' },
    { name: 'Legumes', color: '#92400E' },
    { name: 'Oils & Condiments', color: '#854D0E' },
    { name: 'Sauces', color: '#B91C1C' },
    { name: 'Dairy & Eggs', color: '#2563EB' },
    { name: 'Nuts & Seeds', color: '#78716C' },
];

const seedDefaultMeals = async (db) => {
    const seeded = await dbGet(db, "SELECT value FROM user_preferences WHERE key = 'default_meals_seeded'");
    if (seeded) return;

    const insertMeal = 'INSERT INTO meals (name, calories_per_serving, ounces_per_serving, unit_type, category) VALUES (?, ?, ?, ?, ?)';
    for (const meal of DEFAULT_FOOD_TEMPLATES) {
        await dbRun(db, insertMeal, [meal.name, meal.calories, meal.serving, meal.unit, meal.category]);
    }

    for (const cat of DEFAULT_CATEGORIES) {
        await dbRun(db, 'INSERT OR IGNORE INTO meal_categories (name, color) VALUES (?, ?)', [cat.name, cat.color]);
    }

    await dbRun(db, "INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES ('default_meals_seeded', 'true', CURRENT_TIMESTAMP)");
    console.log('Seeded default food templates');
};

// === Default Demo Recipes ===

const DEFAULT_RECIPES = [
    {
        name: 'Simple Chili',
        cooked_weight_oz: 48,
        // Total raw calories: 1807, cal/oz cooked: ~37.6
        items: [
            { source_type: 'custom', name: 'Spanglish Asadero Birria Seasoning (1 oz)', calories_per_unit: 0, unit_type: 'piece', quantity: 1 },
            { source_type: 'custom', name: 'Ground Beef 80/20 (Raw)', calories_per_unit: 72, unit_type: 'ounce', quantity: 16 },
            { source_type: 'custom', name: 'Rotel Diced Tomatoes & Green Chilies (10 oz can)', calories_per_unit: 100, unit_type: 'piece', quantity: 1 },
            { source_type: 'custom', name: 'Tri-Bean Chili Mix (15 oz can)', calories_per_unit: 420, unit_type: 'piece', quantity: 1 },
            { source_type: 'custom', name: 'Onion (Medium)', calories_per_unit: 45, unit_type: 'piece', quantity: 1 },
            { source_type: 'custom', name: 'Frozen Sliced Bell Peppers (16 oz bag)', calories_per_unit: 90, unit_type: 'piece', quantity: 1 },
        ]
    }
];

const seedDefaultRecipes = async (db) => {
    const seeded = await dbGet(db, "SELECT value FROM user_preferences WHERE key = 'default_recipes_seeded'");
    if (seeded) return;

    for (const recipe of DEFAULT_RECIPES) {
        const result = await dbRun(db,
            'INSERT INTO recipes (name, cooked_weight_oz) VALUES (?, ?)',
            [recipe.name, recipe.cooked_weight_oz]
        );
        const recipeId = result.lastID;

        const insertItem = 'INSERT INTO recipe_items (recipe_id, source_type, template_id, name, calories_per_unit, unit_type, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)';
        for (const item of recipe.items) {
            await dbRun(db, insertItem, [
                recipeId,
                item.source_type,
                item.template_id || null,
                item.name,
                item.calories_per_unit,
                item.unit_type,
                item.quantity
            ]);
        }
    }

    await dbRun(db, "INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES ('default_recipes_seeded', 'true', CURRENT_TIMESTAMP)");
    console.log('Seeded default recipes');
};

const getUserDb = async (username) => {
    if (userDbs.has(username)) {
        return userDbs.get(username);
    }
    const dbPath = getUserDbPath(username);
    const db = await openDb(dbPath);
    await initUserTables(db);
    await seedDefaultMeals(db);
    await seedDefaultRecipes(db);
    userDbs.set(username, db);
    return db;
};

// === Input Sanitization ===

const sanitize = (value) => {
    if (typeof value === 'string') {
        return value.replace(/[^\w\s\-\.]/gi, '');
    }
    return value;
};

// === Auth Middleware ===

const requireAuth = async (req, res, next) => {
    const token = req.headers['x-auth-token'];
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    }
    const session = sessions.get(token);
    req.username = session.username;
    try {
        req.userDb = await getUserDb(session.username);
        next();
    } catch (err) {
        console.error('DB error for user', session.username, err);
        return res.status(500).json({ status: 'error', message: 'Database connection error' });
    }
};

// ==============================================
//  PUBLIC AUTH ROUTES (no auth required)
// ==============================================

app.post('/api/auth/signup', async (req, res) => {
    try {
        const username = sanitize(req.body.username);
        const password = req.body.password;

        if (!username || !password) {
            return res.status(400).json({ status: 'error', message: 'Username and password are required' });
        }
        if (username.length < 2 || username.length > 30) {
            return res.status(400).json({ status: 'error', message: 'Username must be 2-30 characters' });
        }
        if (password.length < 3) {
            return res.status(400).json({ status: 'error', message: 'Password must be at least 3 characters' });
        }

        const logins = readLogins();
        if (logins.some(l => l.username.toLowerCase() === username.toLowerCase())) {
            return res.status(400).json({ status: 'error', message: 'Username already taken' });
        }

        const isFirstUser = logins.length === 0;
        const legacyDbExists = fs.existsSync(LEGACY_DB);

        logins.push({ username, password });
        writeLogins(logins);

        // If first user and legacy DB exists, copy it for seamless data migration
        if (isFirstUser && legacyDbExists) {
            fs.copyFileSync(LEGACY_DB, getUserDbPath(username));
            console.log(`Migrated legacy diet_app.db to data/${username}.db`);
        }

        const token = generateToken();
        sessions.set(token, { username, createdAt: Date.now() });
        await getUserDb(username);

        return res.json({
            status: 'success',
            message: isFirstUser && legacyDbExists
                ? 'Account created with your existing data'
                : 'Account created',
            token,
            username,
            migratedData: isFirstUser && legacyDbExists
        });
    } catch (err) {
        console.error('Signup error:', err);
        return res.status(500).json({ status: 'error', message: 'Server error during signup' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const username = sanitize(req.body.username);
        const password = req.body.password;

        if (!username || !password) {
            return res.status(400).json({ status: 'error', message: 'Username and password are required' });
        }

        const logins = readLogins();
        const user = logins.find(l =>
            l.username.toLowerCase() === username.toLowerCase() && l.password === password
        );

        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Invalid username or password' });
        }

        const token = generateToken();
        sessions.set(token, { username: user.username, createdAt: Date.now() });
        await getUserDb(user.username);

        return res.json({ status: 'success', message: 'Logged in', token, username: user.username });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ status: 'error', message: 'Server error during login' });
    }
});

// ==============================================
//  AUTH MIDDLEWARE (everything below requires auth)
// ==============================================

app.use('/api', requireAuth);

// ==============================================
//  PROTECTED AUTH ROUTES
// ==============================================

app.get('/api/auth/me', (req, res) => {
    return res.json({ status: 'success', username: req.username });
});

app.post('/api/auth/logout', (req, res) => {
    const token = req.headers['x-auth-token'];
    sessions.delete(token);
    return res.json({ status: 'success', message: 'Logged out' });
});

app.post('/api/auth/change-password', (req, res) => {
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ status: 'error', message: 'Current and new password are required' });
    }
    if (newPassword.length < 3) {
        return res.status(400).json({ status: 'error', message: 'New password must be at least 3 characters' });
    }

    const logins = readLogins();
    const idx = logins.findIndex(l => l.username === req.username);

    if (idx === -1 || logins[idx].password !== currentPassword) {
        return res.status(400).json({ status: 'error', message: 'Current password is incorrect' });
    }

    logins[idx].password = newPassword;
    writeLogins(logins);
    return res.json({ status: 'success', message: 'Password changed successfully' });
});

// ==============================================
//  PROTECTED DATA ROUTES
// ==============================================

// --- Meals (Templates) ---

app.post('/api/meals', async (req, res) => {
    try {
        const name = sanitize(req.body.name);
        const calories_per_serving = sanitize(req.body.calories_per_serving);
        const ounces_per_serving = sanitize(req.body.ounces_per_serving);
        const unit_type = sanitize(req.body.unit_type) || 'piece';
        const category = sanitize(req.body.category) || 'Other';

        if (!name || !calories_per_serving || !ounces_per_serving) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const result = await dbRun(req.userDb,
            'INSERT INTO meals (name, calories_per_serving, ounces_per_serving, unit_type, category) VALUES (?, ?, ?, ?, ?)',
            [name, calories_per_serving, ounces_per_serving, unit_type, category]
        );
        return res.json({ status: 'success', message: 'Food metric added', meal_id: result.lastID });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/meals', async (req, res) => {
    try {
        const rows = await dbAll(req.userDb, 'SELECT * FROM meals', []);
        return res.json({ status: 'success', meals: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.delete('/api/meals/:id', async (req, res) => {
    try {
        const id = sanitize(req.params.id);
        if (!id) return res.status(400).json({ status: 'error', message: 'Missing meal ID' });

        const result = await dbRun(req.userDb, 'DELETE FROM meals WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Meal template not found' });
        }
        return res.json({ status: 'success', message: 'Meal template deleted' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Meal Log ---

app.post('/api/meal_log', async (req, res) => {
    try {
        const meal_name = sanitize(req.body.meal_name);
        const date = sanitize(req.body.date);
        const calories = sanitize(req.body.calories);

        if (!meal_name || !date || !calories) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const result = await dbRun(req.userDb,
            'INSERT INTO meal_log (meal_name, date, calories) VALUES (?, ?, ?)',
            [meal_name, date, calories]
        );
        return res.json({ status: 'success', message: 'Meal logged', log_id: result.lastID });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/meal_log_for_day', async (req, res) => {
    try {
        const date = sanitize(req.query.date);
        if (!date) return res.status(400).json({ status: 'error', message: 'Missing date parameter' });

        const rows = await dbAll(req.userDb,
            'SELECT id, meal_name, calories FROM meal_log WHERE date = ? ORDER BY id ASC',
            [date]
        );
        return res.json({ status: 'success', logs: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.delete('/api/meal_log/:id', async (req, res) => {
    try {
        const id = sanitize(req.params.id);
        if (!id) return res.status(400).json({ status: 'error', message: 'Missing meal log ID' });

        const result = await dbRun(req.userDb, 'DELETE FROM meal_log WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Meal log entry not found' });
        }
        return res.json({ status: 'success', message: 'Meal log entry deleted' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Quick Add ---

app.post('/api/quick_add', async (req, res) => {
    try {
        const name = sanitize(req.body.name);
        const calories = sanitize(req.body.calories);
        const date = sanitize(req.body.date);

        if (!name || !calories || !date) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const result = await dbRun(req.userDb,
            'INSERT INTO quick_add_log (name, calories, date) VALUES (?, ?, ?)',
            [name, calories, date]
        );
        return res.json({ status: 'success', message: 'Quick add logged', log_id: result.lastID });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/quick_add_for_day', async (req, res) => {
    try {
        const date = sanitize(req.query.date);
        if (!date) return res.status(400).json({ status: 'error', message: 'Missing date parameter' });

        const rows = await dbAll(req.userDb,
            'SELECT id, name, calories FROM quick_add_log WHERE date = ? ORDER BY id ASC',
            [date]
        );
        return res.json({ status: 'success', logs: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.delete('/api/quick_add/:id', async (req, res) => {
    try {
        const id = sanitize(req.params.id);
        if (!id) return res.status(400).json({ status: 'error', message: 'Missing quick add ID' });

        const result = await dbRun(req.userDb, 'DELETE FROM quick_add_log WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Quick add entry not found' });
        }
        return res.json({ status: 'success', message: 'Quick add entry deleted' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Calories ---

app.get('/api/calories_per_day', async (req, res) => {
    try {
        const date = sanitize(req.query.date);
        if (!date) return res.status(400).json({ status: 'error', message: 'Missing date parameter' });

        const [mealRow, quickAddRow] = await Promise.all([
            dbGet(req.userDb, 'SELECT SUM(calories) as meal_calories FROM meal_log WHERE date = ?', [date]),
            dbGet(req.userDb, 'SELECT SUM(calories) as quick_add_calories FROM quick_add_log WHERE date = ?', [date])
        ]);

        const mealCalories = (mealRow && mealRow.meal_calories) || 0;
        const quickAddCalories = (quickAddRow && quickAddRow.quick_add_calories) || 0;
        return res.json({ status: 'success', date, total_calories: mealCalories + quickAddCalories });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/calories_range', async (req, res) => {
    try {
        const start = sanitize(req.query.start);
        const end = sanitize(req.query.end);
        if (!start || !end) return res.status(400).json({ status: 'error', message: 'Missing start or end parameter' });

        const [mealRows, quickAddRows] = await Promise.all([
            dbAll(req.userDb, 'SELECT date, SUM(calories) as meal_calories FROM meal_log WHERE date BETWEEN ? AND ? GROUP BY date', [start, end]),
            dbAll(req.userDb, 'SELECT date, SUM(calories) as quick_add_calories FROM quick_add_log WHERE date BETWEEN ? AND ? GROUP BY date', [start, end])
        ]);

        const calorieMap = {};
        mealRows.forEach(row => { calorieMap[row.date] = (calorieMap[row.date] || 0) + (row.meal_calories || 0); });
        quickAddRows.forEach(row => { calorieMap[row.date] = (calorieMap[row.date] || 0) + (row.quick_add_calories || 0); });

        const result = Object.keys(calorieMap)
            .map(date => ({ date, total_calories: calorieMap[date] }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return res.json({ status: 'success', data: result });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/calories_all', async (req, res) => {
    try {
        const [mealRows, quickAddRows] = await Promise.all([
            dbAll(req.userDb, 'SELECT date, SUM(calories) as meal_calories FROM meal_log GROUP BY date', []),
            dbAll(req.userDb, 'SELECT date, SUM(calories) as quick_add_calories FROM quick_add_log GROUP BY date', [])
        ]);

        const calorieMap = {};
        mealRows.forEach(row => { calorieMap[row.date] = (calorieMap[row.date] || 0) + (row.meal_calories || 0); });
        quickAddRows.forEach(row => { calorieMap[row.date] = (calorieMap[row.date] || 0) + (row.quick_add_calories || 0); });

        const result = Object.keys(calorieMap)
            .map(date => ({ date, total_calories: calorieMap[date] }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return res.json({ status: 'success', data: result });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Blood Pressure ---

app.post('/api/blood_pressure', async (req, res) => {
    try {
        const systolic = sanitize(req.body.systolic);
        const diastolic = sanitize(req.body.diastolic);

        if (!systolic || !diastolic) {
            return res.status(400).json({ status: 'error', message: 'Missing systolic or diastolic values' });
        }
        if (systolic < 70 || systolic > 200) {
            return res.status(400).json({ status: 'error', message: 'Systolic pressure should be between 70-200' });
        }
        if (diastolic < 40 || diastolic > 130) {
            return res.status(400).json({ status: 'error', message: 'Diastolic pressure should be between 40-130' });
        }

        const timestamp = new Date().toISOString();
        const result = await dbRun(req.userDb,
            'INSERT INTO blood_pressure_log (systolic, diastolic, timestamp) VALUES (?, ?, ?)',
            [systolic, diastolic, timestamp]
        );
        return res.json({ status: 'success', message: 'Blood pressure logged', log_id: result.lastID });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/blood_pressure_range', async (req, res) => {
    try {
        const start = sanitize(req.query.start);
        const end = sanitize(req.query.end);
        if (!start || !end) return res.status(400).json({ status: 'error', message: 'Missing start or end parameter' });

        const rows = await dbAll(req.userDb,
            'SELECT id, systolic, diastolic, timestamp FROM blood_pressure_log WHERE DATE(timestamp) BETWEEN ? AND ? ORDER BY timestamp DESC',
            [start, end]
        );
        return res.json({ status: 'success', readings: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/blood_pressure_latest', async (req, res) => {
    try {
        const row = await dbGet(req.userDb,
            'SELECT id, systolic, diastolic, timestamp FROM blood_pressure_log ORDER BY timestamp DESC LIMIT 1',
            []
        );
        return res.json({ status: 'success', reading: row || null });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/blood_pressure_all', async (req, res) => {
    try {
        const rows = await dbAll(req.userDb,
            'SELECT id, systolic, diastolic, timestamp FROM blood_pressure_log ORDER BY timestamp ASC',
            []
        );
        return res.json({ status: 'success', readings: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Weight ---

app.post('/api/weight_log', async (req, res) => {
    try {
        const weight = sanitize(req.body.weight);
        const date = sanitize(req.body.date);
        if (!weight || !date) return res.status(400).json({ status: 'error', message: 'Missing weight or date' });

        const result = await dbRun(req.userDb,
            'INSERT INTO weight_log (weight, date) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET weight=excluded.weight',
            [weight, date]
        );
        return res.json({ status: 'success', message: 'Weight logged', log_id: result.lastID });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/weight_log_for_day', async (req, res) => {
    try {
        const date = sanitize(req.query.date);
        if (!date) return res.status(400).json({ status: 'error', message: 'Missing date parameter' });

        const row = await dbGet(req.userDb, 'SELECT weight FROM weight_log WHERE date = ?', [date]);
        return res.json({ status: 'success', weight: row ? row.weight : null });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/weight_log_range', async (req, res) => {
    try {
        const start = sanitize(req.query.start);
        const end = sanitize(req.query.end);
        if (!start || !end) return res.status(400).json({ status: 'error', message: 'Missing start or end parameter' });

        const rows = await dbAll(req.userDb,
            'SELECT date, weight FROM weight_log WHERE date BETWEEN ? AND ? ORDER BY date ASC',
            [start, end]
        );
        return res.json({ status: 'success', weights: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/weight_log_all', async (req, res) => {
    try {
        const rows = await dbAll(req.userDb, 'SELECT date, weight FROM weight_log ORDER BY date ASC', []);
        return res.json({ status: 'success', weights: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Preferences ---

app.get('/api/preferences', async (req, res) => {
    try {
        const rows = await dbAll(req.userDb, 'SELECT key, value FROM user_preferences', []);
        const preferences = {};
        rows.forEach(row => { preferences[row.key] = row.value; });
        return res.json({ status: 'success', preferences });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.post('/api/preferences', async (req, res) => {
    try {
        const key = sanitize(req.body.key);
        const value = sanitize(req.body.value);
        if (!key || value === undefined) return res.status(400).json({ status: 'error', message: 'Missing key or value' });

        await dbRun(req.userDb,
            'INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [key, value]
        );
        return res.json({ status: 'success', message: 'Preference updated' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Exercise ---

app.post('/api/exercise_log', async (req, res) => {
    try {
        const exercise_name = sanitize(req.body.exercise_name);
        const duration_minutes = sanitize(req.body.duration_minutes);
        const calories_burned = sanitize(req.body.calories_burned);
        const date = sanitize(req.body.date);
        const notes = sanitize(req.body.notes);

        if (!exercise_name || !duration_minutes || !date) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const result = await dbRun(req.userDb,
            'INSERT INTO exercise_log (exercise_name, duration_minutes, calories_burned, date, notes) VALUES (?, ?, ?, ?, ?)',
            [exercise_name, duration_minutes, calories_burned, date, notes]
        );
        return res.json({ status: 'success', message: 'Exercise logged', log_id: result.lastID });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/exercise_log_for_day', async (req, res) => {
    try {
        const date = sanitize(req.query.date);
        if (!date) return res.status(400).json({ status: 'error', message: 'Missing date parameter' });

        const rows = await dbAll(req.userDb, 'SELECT * FROM exercise_log WHERE date = ? ORDER BY id ASC', [date]);
        return res.json({ status: 'success', exercises: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.delete('/api/exercise_log/:id', async (req, res) => {
    try {
        const id = sanitize(req.params.id);
        if (!id) return res.status(400).json({ status: 'error', message: 'Missing exercise log ID' });

        const result = await dbRun(req.userDb, 'DELETE FROM exercise_log WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Exercise log entry not found' });
        }
        return res.json({ status: 'success', message: 'Exercise log entry deleted' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Meal Categories ---

app.get('/api/meal_categories', async (req, res) => {
    try {
        const rows = await dbAll(req.userDb, 'SELECT * FROM meal_categories ORDER BY name', []);
        return res.json({ status: 'success', categories: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.post('/api/meal_categories', async (req, res) => {
    try {
        const name = sanitize(req.body.name);
        const color = sanitize(req.body.color) || '#007bff';
        if (!name) return res.status(400).json({ status: 'error', message: 'Missing category name' });

        const result = await dbRun(req.userDb, 'INSERT INTO meal_categories (name, color) VALUES (?, ?)', [name, color]);
        return res.json({ status: 'success', message: 'Category added', category_id: result.lastID });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ status: 'error', message: 'Category already exists' });
        }
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Recipes ---

app.post('/api/recipes', async (req, res) => {
    try {
        const name = sanitize(req.body.name);
        const cooked_weight_oz = parseFloat(req.body.cooked_weight_oz);
        const items = req.body.items;

        if (!name || !cooked_weight_oz || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Name, cooked weight, and at least one item are required' });
        }

        const result = await dbRun(req.userDb,
            'INSERT INTO recipes (name, cooked_weight_oz) VALUES (?, ?)',
            [name, cooked_weight_oz]
        );
        const recipeId = result.lastID;

        const insertItem = 'INSERT INTO recipe_items (recipe_id, source_type, template_id, name, calories_per_unit, unit_type, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)';
        for (const item of items) {
            await dbRun(req.userDb, insertItem, [
                recipeId,
                sanitize(item.source_type) || 'custom',
                item.template_id || null,
                sanitize(item.name),
                parseFloat(item.calories_per_unit),
                sanitize(item.unit_type) || 'ounce',
                parseFloat(item.quantity)
            ]);
        }

        return res.json({ status: 'success', message: 'Recipe saved', recipe_id: recipeId });
    } catch (err) {
        console.error('Recipe create error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/recipes', async (req, res) => {
    try {
        const recipes = await dbAll(req.userDb, 'SELECT * FROM recipes ORDER BY name ASC', []);
        const result = [];
        for (const recipe of recipes) {
            const items = await dbAll(req.userDb, 'SELECT * FROM recipe_items WHERE recipe_id = ?', [recipe.id]);
            const total_calories = items.reduce((sum, item) => sum + (item.calories_per_unit * item.quantity), 0);
            const cal_per_oz = recipe.cooked_weight_oz > 0 ? total_calories / recipe.cooked_weight_oz : 0;
            result.push({
                ...recipe,
                items,
                total_calories: Math.round(total_calories * 100) / 100,
                cal_per_oz: Math.round(cal_per_oz * 100) / 100
            });
        }
        return res.json({ status: 'success', recipes: result });
    } catch (err) {
        console.error('Recipe list error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/recipes/:id', async (req, res) => {
    try {
        const id = sanitize(req.params.id);
        const recipe = await dbGet(req.userDb, 'SELECT * FROM recipes WHERE id = ?', [id]);
        if (!recipe) {
            return res.status(404).json({ status: 'error', message: 'Recipe not found' });
        }
        const items = await dbAll(req.userDb, 'SELECT * FROM recipe_items WHERE recipe_id = ?', [id]);
        const total_calories = items.reduce((sum, item) => sum + (item.calories_per_unit * item.quantity), 0);
        const cal_per_oz = recipe.cooked_weight_oz > 0 ? total_calories / recipe.cooked_weight_oz : 0;
        return res.json({
            status: 'success',
            recipe: {
                ...recipe,
                items,
                total_calories: Math.round(total_calories * 100) / 100,
                cal_per_oz: Math.round(cal_per_oz * 100) / 100
            }
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.put('/api/recipes/:id', async (req, res) => {
    try {
        const id = sanitize(req.params.id);
        const name = sanitize(req.body.name);
        const cooked_weight_oz = parseFloat(req.body.cooked_weight_oz);
        const items = req.body.items;

        if (!name || !cooked_weight_oz || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Name, cooked weight, and at least one item are required' });
        }

        const existing = await dbGet(req.userDb, 'SELECT id FROM recipes WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ status: 'error', message: 'Recipe not found' });
        }

        await dbRun(req.userDb, 'UPDATE recipes SET name = ?, cooked_weight_oz = ? WHERE id = ?', [name, cooked_weight_oz, id]);
        await dbRun(req.userDb, 'DELETE FROM recipe_items WHERE recipe_id = ?', [id]);

        const insertItem = 'INSERT INTO recipe_items (recipe_id, source_type, template_id, name, calories_per_unit, unit_type, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)';
        for (const item of items) {
            await dbRun(req.userDb, insertItem, [
                id,
                sanitize(item.source_type) || 'custom',
                item.template_id || null,
                sanitize(item.name),
                parseFloat(item.calories_per_unit),
                sanitize(item.unit_type) || 'ounce',
                parseFloat(item.quantity)
            ]);
        }

        return res.json({ status: 'success', message: 'Recipe updated' });
    } catch (err) {
        console.error('Recipe update error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.delete('/api/recipes/:id', async (req, res) => {
    try {
        const id = sanitize(req.params.id);
        if (!id) return res.status(400).json({ status: 'error', message: 'Missing recipe ID' });

        await dbRun(req.userDb, 'PRAGMA foreign_keys = ON');
        const result = await dbRun(req.userDb, 'DELETE FROM recipes WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Recipe not found' });
        }
        return res.json({ status: 'success', message: 'Recipe deleted' });
    } catch (err) {
        console.error('Recipe delete error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- Meal Plans ---

app.post('/api/meal_plans', async (req, res) => {
    try {
        const meal_name = sanitize(req.body.meal_name);
        const planned_date = sanitize(req.body.planned_date);
        const meal_type = sanitize(req.body.meal_type) || 'Other';
        const notes = sanitize(req.body.notes);

        if (!meal_name || !planned_date) {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const result = await dbRun(req.userDb,
            'INSERT INTO meal_plans (meal_name, planned_date, meal_type, notes) VALUES (?, ?, ?, ?)',
            [meal_name, planned_date, meal_type, notes]
        );
        return res.json({ status: 'success', message: 'Meal planned', plan_id: result.lastID });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.get('/api/meal_plans_for_day', async (req, res) => {
    try {
        const date = sanitize(req.query.date);
        if (!date) return res.status(400).json({ status: 'error', message: 'Missing date parameter' });

        const rows = await dbAll(req.userDb,
            'SELECT * FROM meal_plans WHERE planned_date = ? ORDER BY meal_type, id ASC',
            [date]
        );
        return res.json({ status: 'success', plans: rows });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

app.delete('/api/meal_plans/:id', async (req, res) => {
    try {
        const id = sanitize(req.params.id);
        if (!id) return res.status(400).json({ status: 'error', message: 'Missing meal plan ID' });

        const result = await dbRun(req.userDb, 'DELETE FROM meal_plans WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Meal plan not found' });
        }
        return res.json({ status: 'success', message: 'Meal plan deleted' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
    }
});

// --- AI Calorie Lookup ---

app.post('/api/lookup_calories', async (req, res) => {
    const foodName = sanitize(req.body.foodName);
    const portionSize = sanitize(req.body.portionSize);

    if (!foodName || !portionSize) {
        return res.status(400).json({ status: 'error', message: 'Missing food name or portion size' });
    }

    try {
        const prompt = `You are a nutrition expert. Estimate the calories for ${portionSize} of ${foodName}.

Based on standard nutritional databases, provide:
- calories: the estimated calorie count (number only)
- servingSizeOunces: the standard serving size in ounces (number only)
- reasoning: brief explanation of the estimate

Respond in this exact JSON format:
{
  "calories": [number],
  "servingSizeOunces": [number],
  "reasoning": "[brief explanation]"
}

For reference, common estimates:
- Hot dog: ~150 calories for 1.6 oz
- Apple: ~95 calories for 6.3 oz
- Chicken breast: ~165 calories for 3.5 oz
- Rice: ~205 calories for 6 oz cooked`;

        const ollamaResponse = await axios.post('https://ollama.nicktantillo.com/api/generate', {
            model: 'llama3.2',
            prompt: prompt,
            stream: false
        });

        const response = ollamaResponse.data.response;
        let result;
        try {
            result = JSON.parse(response);
        } catch (parseError) {
            const calorieMatch = response.match(/(\d+(?:\.\d+)?)\s*calories?/i);
            const ounceMatch = response.match(/(\d+(?:\.\d+)?)\s*ounces?/i);
            result = {
                calories: calorieMatch ? parseFloat(calorieMatch[1]) : null,
                servingSizeOunces: ounceMatch ? parseFloat(ounceMatch[1]) : null,
                reasoning: response
            };
        }

        return res.json({ status: 'success', data: result, originalResponse: response });
    } catch (error) {
        console.error('Ollama error:', error);

        if (error.response) {
            const status = error.response.status;
            const errorData = error.response.data;

            if (status === 403 && errorData && typeof errorData === 'string') {
                const ipv6Match = errorData.match(/([0-9a-fA-F:]+:+[0-9a-fA-F:]+)/);
                if (ipv6Match) {
                    return res.status(403).json({
                        status: 'error',
                        message: `Need to add ${ipv6Match[1]} to Cloudflare allowlist`,
                        statusCode: 403,
                        details: 'Cloudflare proxy error - IPv6 address needs to be whitelisted'
                    });
                }
            }

            const errorMessage = errorData.error || errorData.message || 'Unknown error';
            return res.status(status).json({
                status: 'error',
                message: errorMessage,
                statusCode: status,
                details: errorData
            });
        }

        return res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to lookup calories',
            details: error.toString()
        });
    }
});

// === Start Server ===

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
