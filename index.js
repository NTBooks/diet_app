const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// SQLite setup
const db = new sqlite3.Database('./diet_app.db', (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create tables if not exist (legacy tables for backward compatibility)
const createTables = () => {
    db.run(`CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    calories_per_serving REAL NOT NULL,
    ounces_per_serving REAL NOT NULL
  )`);
    db.run(`CREATE TABLE IF NOT EXISTS meal_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_name TEXT NOT NULL,
    calories REAL NOT NULL,
    date TEXT NOT NULL
  )`);
    db.run(`CREATE TABLE IF NOT EXISTS quick_add_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    calories REAL NOT NULL,
    date TEXT NOT NULL
  )`);
    db.run(`CREATE TABLE IF NOT EXISTS blood_pressure_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    systolic INTEGER NOT NULL,
    diastolic INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  )`);
    db.run(`CREATE TABLE IF NOT EXISTS weight_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        weight REAL NOT NULL,
        date TEXT NOT NULL UNIQUE
    )`);
};

createTables();

const sanitize = (value) => {
    if (typeof value === 'string') {
        return value.replace(/[^\w\s\-\.]/gi, '');
    }
    return value;
};

// Add a new meal
app.post('/api/meals', (req, res) => {
    const name = sanitize(req.body.name);
    const calories_per_serving = sanitize(req.body.calories_per_serving);
    const ounces_per_serving = sanitize(req.body.ounces_per_serving);
    const unit_type = sanitize(req.body.unit_type) || 'piece';
    if (!name || !calories_per_serving || !ounces_per_serving) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    db.run(
        'INSERT INTO meals (name, calories_per_serving, ounces_per_serving, unit_type) VALUES (?, ?, ?, ?)',
        [name, calories_per_serving, ounces_per_serving, unit_type],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Food metric added', meal_id: this.lastID });
        }
    );
});

// List all meals
app.get('/api/meals', (req, res) => {
    db.all('SELECT * FROM meals', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', meals: rows });
    });
});

// Delete a meal template
app.delete('/api/meals/:id', (req, res) => {
    const id = sanitize(req.params.id);
    if (!id) {
        return res.status(400).json({ status: 'error', message: 'Missing meal ID' });
    }

    db.run('DELETE FROM meals WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Meal template not found' });
        }
        res.json({ status: 'success', message: 'Meal template deleted' });
    });
});

// Log a meal eaten
app.post('/api/meal_log', (req, res) => {
    const meal_name = sanitize(req.body.meal_name);
    const date = sanitize(req.body.date);
    const calories = sanitize(req.body.calories);
    if (!meal_name || !date || !calories) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    db.run(
        'INSERT INTO meal_log (meal_name, date, calories) VALUES (?, ?, ?)',
        [meal_name, date, calories],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Meal logged', log_id: this.lastID });
        }
    );
});

// Get calories per day
app.get('/api/calories_per_day', (req, res) => {
    const date = sanitize(req.query.date);
    if (!date) {
        return res.status(400).json({ status: 'error', message: 'Missing date parameter' });
    }

    // Get calories from regular meals
    const mealSql = `
    SELECT SUM(calories) as meal_calories
    FROM meal_log
    WHERE date = ?
  `;

    // Get calories from quick add items
    const quickAddSql = `
    SELECT SUM(calories) as quick_add_calories
    FROM quick_add_log
    WHERE date = ?
  `;

    db.get(mealSql, [date], (err, mealRow) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }

        db.get(quickAddSql, [date], (err2, quickAddRow) => {
            if (err2) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }

            const mealCalories = mealRow.meal_calories || 0;
            const quickAddCalories = quickAddRow.quick_add_calories || 0;
            const totalCalories = mealCalories + quickAddCalories;

            res.json({ status: 'success', date, total_calories: totalCalories });
        });
    });
});

// Get calories for a range of dates (calendar view)
app.get('/api/calories_range', (req, res) => {
    const start = sanitize(req.query.start);
    const end = sanitize(req.query.end);
    if (!start || !end) {
        return res.status(400).json({ status: 'error', message: 'Missing start or end parameter' });
    }

    // Get calories from regular meals
    const mealSql = `
    SELECT date, SUM(calories) as meal_calories
    FROM meal_log
    WHERE date BETWEEN ? AND ?
    GROUP BY date
  `;

    // Get calories from quick add items
    const quickAddSql = `
    SELECT date, SUM(calories) as quick_add_calories
    FROM quick_add_log
    WHERE date BETWEEN ? AND ?
    GROUP BY date
  `;

    db.all(mealSql, [start, end], (err, mealRows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }

        db.all(quickAddSql, [start, end], (err2, quickAddRows) => {
            if (err2) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }

            // Create a map of dates to calories
            const calorieMap = {};

            // Add meal calories
            mealRows.forEach(row => {
                calorieMap[row.date] = (calorieMap[row.date] || 0) + (row.meal_calories || 0);
            });

            // Add quick add calories
            quickAddRows.forEach(row => {
                calorieMap[row.date] = (calorieMap[row.date] || 0) + (row.quick_add_calories || 0);
            });

            // Convert to array format
            const result = Object.keys(calorieMap).map(date => ({
                date: date,
                total_calories: calorieMap[date]
            })).sort((a, b) => a.date.localeCompare(b.date));

            res.json({ status: 'success', data: result });
        });
    });
});

// Lookup calories using Ollama
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

        // Try to parse the response as JSON
        let result;
        try {
            result = JSON.parse(response);
        } catch (parseError) {
            // If JSON parsing fails, extract numbers from the response
            const calorieMatch = response.match(/(\d+(?:\.\d+)?)\s*calories?/i);
            const ounceMatch = response.match(/(\d+(?:\.\d+)?)\s*ounces?/i);

            result = {
                calories: calorieMatch ? parseFloat(calorieMatch[1]) : null,
                servingSizeOunces: ounceMatch ? parseFloat(ounceMatch[1]) : null,
                reasoning: response
            };
        }

        res.json({
            status: 'success',
            data: result,
            originalResponse: response
        });
    } catch (error) {
        console.error('Ollama error:', error);

        // Check if it's an axios error with response data
        if (error.response) {
            const status = error.response.status;
            const errorData = error.response.data;

            // Handle Cloudflare 403 errors (proxy error)
            if (status === 403 && errorData && typeof errorData === 'string') {
                // Try to extract IPv6 address from the error response
                const ipv6Match = errorData.match(/([0-9a-fA-F:]+:+[0-9a-fA-F:]+)/);
                if (ipv6Match) {
                    const ipv6Address = ipv6Match[1];
                    res.status(403).json({
                        status: 'error',
                        message: `Need to add ${ipv6Address} to Cloudflare allowlist`,
                        statusCode: 403,
                        details: 'Cloudflare proxy error - IPv6 address needs to be whitelisted'
                    });
                    return;
                }
            }

            const errorMessage = errorData.error || errorData.message || 'Unknown error';

            res.status(status).json({
                status: 'error',
                message: errorMessage,
                statusCode: status,
                details: errorData
            });
        } else {
            res.status(500).json({
                status: 'error',
                message: error.message || 'Failed to lookup calories',
                details: error.toString()
            });
        }
    }
});

// Get all meals logged for a given day with meal info
app.get('/api/meal_log_for_day', (req, res) => {
    const date = sanitize(req.query.date);
    if (!date) {
        return res.status(400).json({ status: 'error', message: 'Missing date parameter' });
    }
    const sql = `
    SELECT id, meal_name, calories
    FROM meal_log
    WHERE date = ?
    ORDER BY id ASC
  `;
    db.all(sql, [date], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', logs: rows });
    });
});

// Quick add a food item (one-time entry)
app.post('/api/quick_add', (req, res) => {
    const name = sanitize(req.body.name);
    const calories = sanitize(req.body.calories);
    const date = sanitize(req.body.date);
    if (!name || !calories || !date) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    db.run(
        'INSERT INTO quick_add_log (name, calories, date) VALUES (?, ?, ?)',
        [name, calories, date],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Quick add logged', log_id: this.lastID });
        }
    );
});

// Get all quick add items for a given day
app.get('/api/quick_add_for_day', (req, res) => {
    const date = sanitize(req.query.date);
    if (!date) {
        return res.status(400).json({ status: 'error', message: 'Missing date parameter' });
    }
    const sql = `
    SELECT id, name, calories
    FROM quick_add_log
    WHERE date = ?
    ORDER BY id ASC
  `;
    db.all(sql, [date], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', logs: rows });
    });
});

// Log blood pressure reading
app.post('/api/blood_pressure', (req, res) => {
    const systolic = sanitize(req.body.systolic);
    const diastolic = sanitize(req.body.diastolic);

    if (!systolic || !diastolic) {
        return res.status(400).json({ status: 'error', message: 'Missing systolic or diastolic values' });
    }

    // Validate blood pressure ranges
    if (systolic < 70 || systolic > 200) {
        return res.status(400).json({ status: 'error', message: 'Systolic pressure should be between 70-200' });
    }

    if (diastolic < 40 || diastolic > 130) {
        return res.status(400).json({ status: 'error', message: 'Diastolic pressure should be between 40-130' });
    }

    const timestamp = new Date().toISOString();

    db.run(
        'INSERT INTO blood_pressure_log (systolic, diastolic, timestamp) VALUES (?, ?, ?)',
        [systolic, diastolic, timestamp],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Blood pressure logged', log_id: this.lastID });
        }
    );
});

// Get blood pressure readings for a date range
app.get('/api/blood_pressure_range', (req, res) => {
    const start = sanitize(req.query.start);
    const end = sanitize(req.query.end);

    if (!start || !end) {
        return res.status(400).json({ status: 'error', message: 'Missing start or end parameter' });
    }

    const sql = `
    SELECT id, systolic, diastolic, timestamp
    FROM blood_pressure_log
    WHERE DATE(timestamp) BETWEEN ? AND ?
    ORDER BY timestamp DESC
  `;

    db.all(sql, [start, end], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', readings: rows });
    });
});

// Get latest blood pressure reading
app.get('/api/blood_pressure_latest', (req, res) => {
    const sql = `
    SELECT id, systolic, diastolic, timestamp
    FROM blood_pressure_log
    ORDER BY timestamp DESC
    LIMIT 1
  `;

    db.get(sql, [], (err, row) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', reading: row });
    });
});

// Log or update weight for a day
app.post('/api/weight_log', (req, res) => {
    const weight = sanitize(req.body.weight);
    const date = sanitize(req.body.date);
    if (!weight || !date) {
        return res.status(400).json({ status: 'error', message: 'Missing weight or date' });
    }
    db.run(
        `INSERT INTO weight_log (weight, date) VALUES (?, ?)
         ON CONFLICT(date) DO UPDATE SET weight=excluded.weight`,
        [weight, date],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Weight logged', log_id: this.lastID });
        }
    );
});

// Get weight for a specific day
app.get('/api/weight_log_for_day', (req, res) => {
    const date = sanitize(req.query.date);
    if (!date) {
        return res.status(400).json({ status: 'error', message: 'Missing date parameter' });
    }
    db.get('SELECT weight FROM weight_log WHERE date = ?', [date], (err, row) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', weight: row ? row.weight : null });
    });
});

// Get weights for a date range
app.get('/api/weight_log_range', (req, res) => {
    const start = sanitize(req.query.start);
    const end = sanitize(req.query.end);
    if (!start || !end) {
        return res.status(400).json({ status: 'error', message: 'Missing start or end parameter' });
    }
    db.all('SELECT date, weight FROM weight_log WHERE date BETWEEN ? AND ? ORDER BY date ASC', [start, end], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', weights: rows });
    });
});

// Get all weight data for trend analysis
app.get('/api/weight_log_all', (req, res) => {
    db.all('SELECT date, weight FROM weight_log ORDER BY date ASC', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', weights: rows });
    });
});

// Delete meal log entry
app.delete('/api/meal_log/:id', (req, res) => {
    const id = sanitize(req.params.id);
    if (!id) {
        return res.status(400).json({ status: 'error', message: 'Missing meal log ID' });
    }

    db.run('DELETE FROM meal_log WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Meal log entry not found' });
        }
        res.json({ status: 'success', message: 'Meal log entry deleted' });
    });
});

// Delete quick add entry
app.delete('/api/quick_add/:id', (req, res) => {
    const id = sanitize(req.params.id);
    if (!id) {
        return res.status(400).json({ status: 'error', message: 'Missing quick add ID' });
    }

    db.run('DELETE FROM quick_add_log WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Quick add entry not found' });
        }
        res.json({ status: 'success', message: 'Quick add entry deleted' });
    });
});

// === NEW ENHANCED FEATURES ===

// User Preferences API
app.get('/api/preferences', (req, res) => {
    db.all('SELECT key, value FROM user_preferences', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        const preferences = {};
        rows.forEach(row => {
            preferences[row.key] = row.value;
        });
        res.json({ status: 'success', preferences });
    });
});

app.post('/api/preferences', (req, res) => {
    const key = sanitize(req.body.key);
    const value = sanitize(req.body.value);

    if (!key || value === undefined) {
        return res.status(400).json({ status: 'error', message: 'Missing key or value' });
    }

    db.run(
        'INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [key, value],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Preference updated' });
        }
    );
});

// Exercise Tracking API
app.post('/api/exercise_log', (req, res) => {
    const exercise_name = sanitize(req.body.exercise_name);
    const duration_minutes = sanitize(req.body.duration_minutes);
    const calories_burned = sanitize(req.body.calories_burned);
    const date = sanitize(req.body.date);
    const notes = sanitize(req.body.notes);

    if (!exercise_name || !duration_minutes || !date) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    db.run(
        'INSERT INTO exercise_log (exercise_name, duration_minutes, calories_burned, date, notes) VALUES (?, ?, ?, ?, ?)',
        [exercise_name, duration_minutes, calories_burned, date, notes],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Exercise logged', log_id: this.lastID });
        }
    );
});

app.get('/api/exercise_log_for_day', (req, res) => {
    const date = sanitize(req.query.date);
    if (!date) {
        return res.status(400).json({ status: 'error', message: 'Missing date parameter' });
    }

    db.all('SELECT * FROM exercise_log WHERE date = ? ORDER BY id ASC', [date], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', exercises: rows });
    });
});

app.delete('/api/exercise_log/:id', (req, res) => {
    const id = sanitize(req.params.id);
    if (!id) {
        return res.status(400).json({ status: 'error', message: 'Missing exercise log ID' });
    }

    db.run('DELETE FROM exercise_log WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Exercise log entry not found' });
        }
        res.json({ status: 'success', message: 'Exercise log entry deleted' });
    });
});

// Meal Categories API
app.get('/api/meal_categories', (req, res) => {
    db.all('SELECT * FROM meal_categories ORDER BY name', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', categories: rows });
    });
});

app.post('/api/meal_categories', (req, res) => {
    const name = sanitize(req.body.name);
    const color = sanitize(req.body.color) || '#007bff';

    if (!name) {
        return res.status(400).json({ status: 'error', message: 'Missing category name' });
    }

    db.run(
        'INSERT INTO meal_categories (name, color) VALUES (?, ?)',
        [name, color],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ status: 'error', message: 'Category already exists' });
                }
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Category added', category_id: this.lastID });
        }
    );
});

// Enhanced Meals API with categories
app.post('/api/meals', (req, res) => {
    const name = sanitize(req.body.name);
    const calories_per_serving = sanitize(req.body.calories_per_serving);
    const ounces_per_serving = sanitize(req.body.ounces_per_serving);
    const category = sanitize(req.body.category) || 'Other';

    if (!name || !calories_per_serving || !ounces_per_serving) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    db.run(
        'INSERT INTO meals (name, calories_per_serving, ounces_per_serving, category) VALUES (?, ?, ?, ?)',
        [name, calories_per_serving, ounces_per_serving, category],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Meal added', meal_id: this.lastID });
        }
    );
});

// Meal Planning API
app.post('/api/meal_plans', (req, res) => {
    const meal_name = sanitize(req.body.meal_name);
    const planned_date = sanitize(req.body.planned_date);
    const meal_type = sanitize(req.body.meal_type) || 'Other';
    const notes = sanitize(req.body.notes);

    if (!meal_name || !planned_date) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    db.run(
        'INSERT INTO meal_plans (meal_name, planned_date, meal_type, notes) VALUES (?, ?, ?, ?)',
        [meal_name, planned_date, meal_type, notes],
        function (err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: 'Database error' });
            }
            res.json({ status: 'success', message: 'Meal planned', plan_id: this.lastID });
        }
    );
});

app.get('/api/meal_plans_for_day', (req, res) => {
    const date = sanitize(req.query.date);
    if (!date) {
        return res.status(400).json({ status: 'error', message: 'Missing date parameter' });
    }

    db.all('SELECT * FROM meal_plans WHERE planned_date = ? ORDER BY meal_type, id ASC', [date], (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        res.json({ status: 'success', plans: rows });
    });
});

app.delete('/api/meal_plans/:id', (req, res) => {
    const id = sanitize(req.params.id);
    if (!id) {
        return res.status(400).json({ status: 'error', message: 'Missing meal plan ID' });
    }

    db.run('DELETE FROM meal_plans WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ status: 'error', message: 'Meal plan not found' });
        }
        res.json({ status: 'success', message: 'Meal plan deleted' });
    });
});

app.get('/', (req, res) => {
    res.send('Diet App API running');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 