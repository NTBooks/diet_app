const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseMigration {
    constructor(dbPath = './diet_app.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.migrationsTable = 'schema_migrations';
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database for migration');
                    resolve();
                }
            });
        });
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    async runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async getQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async allQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async createMigrationsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL UNIQUE,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )
        `;
        await this.runQuery(query);
    }

    async getAppliedMigrations() {
        const query = `SELECT version FROM ${this.migrationsTable} ORDER BY version`;
        const rows = await this.allQuery(query);
        return rows.map(row => row.version);
    }

    async markMigrationApplied(version, description = '') {
        const query = `INSERT INTO ${this.migrationsTable} (version, description) VALUES (?, ?)`;
        await this.runQuery(query, [version, description]);
    }

    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${this.dbPath}.backup.${timestamp}`;

        return new Promise((resolve, reject) => {
            // Use file system copy instead of SQLite backup
            const fs = require('fs');
            try {
                fs.copyFileSync(this.dbPath, backupPath);
                console.log(`Database backup created: ${backupPath}`);
                resolve(backupPath);
            } catch (err) {
                reject(err);
            }
        });
    }

    async runMigration(version, description, migrationFunction) {
        try {
            console.log(`Running migration ${version}: ${description}`);

            // Create backup before migration
            const backupPath = await this.createBackup();

            // Run the migration
            await migrationFunction();

            // Mark migration as applied
            await this.markMigrationApplied(version, description);

            console.log(`Migration ${version} completed successfully`);
            return backupPath;
        } catch (error) {
            console.error(`Migration ${version} failed:`, error);
            throw error;
        }
    }

    async migrate() {
        try {
            await this.connect();
            await this.createMigrationsTable();

            const appliedMigrations = await this.getAppliedMigrations();
            console.log('Applied migrations:', appliedMigrations);

            // Define all migrations
            const migrations = [
                {
                    version: '001',
                    description: 'Add user preferences table',
                    run: async () => {
                        await this.runQuery(`
                            CREATE TABLE IF NOT EXISTS user_preferences (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                key TEXT NOT NULL UNIQUE,
                                value TEXT,
                                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `);

                        // Insert default preferences
                        await this.runQuery(`
                            INSERT OR IGNORE INTO user_preferences (key, value) VALUES 
                            ('daily_calorie_goal', '2000'),
                            ('weight_unit', 'lbs'),
                            ('theme', 'light')
                        `);
                    }
                },
                {
                    version: '002',
                    description: 'Add exercise tracking table',
                    run: async () => {
                        await this.runQuery(`
                            CREATE TABLE IF NOT EXISTS exercise_log (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                exercise_name TEXT NOT NULL,
                                duration_minutes INTEGER NOT NULL,
                                calories_burned INTEGER,
                                date TEXT NOT NULL,
                                notes TEXT
                            )
                        `);
                    }
                },
                {
                    version: '003',
                    description: 'Add meal categories and improve meals table',
                    run: async () => {
                        // Add category column to meals table
                        await this.runQuery(`
                            ALTER TABLE meals ADD COLUMN category TEXT DEFAULT 'Other'
                        `);

                        // Create categories table
                        await this.runQuery(`
                            CREATE TABLE IF NOT EXISTS meal_categories (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT NOT NULL UNIQUE,
                                color TEXT DEFAULT '#007bff',
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `);

                        // Insert default categories
                        await this.runQuery(`
                            INSERT OR IGNORE INTO meal_categories (name, color) VALUES 
                            ('Breakfast', '#ffc107'),
                            ('Lunch', '#28a745'),
                            ('Dinner', '#dc3545'),
                            ('Snack', '#6f42c1'),
                            ('Other', '#6c757d')
                        `);
                    }
                },
                {
                    version: '004',
                    description: 'Add meal planning table',
                    run: async () => {
                        await this.runQuery(`
                            CREATE TABLE IF NOT EXISTS meal_plans (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                meal_name TEXT NOT NULL,
                                planned_date TEXT NOT NULL,
                                meal_type TEXT DEFAULT 'Other',
                                notes TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `);
                    }
                },
                {
                    version: '005',
                    description: 'Add unit type to meals table for food metrics',
                    run: async () => {
                        // Add unit_type column to meals table
                        await this.runQuery(`
                            ALTER TABLE meals ADD COLUMN unit_type TEXT DEFAULT 'piece'
                        `);

                        // Update existing meals to have a default unit type
                        await this.runQuery(`
                            UPDATE meals SET unit_type = 'piece' WHERE unit_type IS NULL
                        `);
                    }
                },
                {
                    version: '006',
                    description: 'Add recipes and recipe items tables',
                    run: async () => {
                        await this.runQuery(`
                            CREATE TABLE IF NOT EXISTS recipes (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT NOT NULL,
                                cooked_weight_oz REAL NOT NULL,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `);
                        await this.runQuery(`
                            CREATE TABLE IF NOT EXISTS recipe_items (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                recipe_id INTEGER NOT NULL,
                                source_type TEXT NOT NULL DEFAULT 'custom',
                                template_id INTEGER,
                                name TEXT NOT NULL,
                                calories_per_unit REAL NOT NULL,
                                unit_type TEXT NOT NULL DEFAULT 'ounce',
                                quantity REAL NOT NULL,
                                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
                            )
                        `);
                    }
                }
            ];

            // Run pending migrations
            for (const migration of migrations) {
                if (!appliedMigrations.includes(migration.version)) {
                    await this.runMigration(migration.version, migration.description, migration.run);
                }
            }

            console.log('All migrations completed successfully!');

        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        } finally {
            await this.close();
        }
    }

    async rollback(version) {
        try {
            await this.connect();

            // Find backup file for this version
            const backupFiles = fs.readdirSync('.').filter(file =>
                file.startsWith('diet_app.db.backup.') && file.includes(version)
            );

            if (backupFiles.length === 0) {
                throw new Error(`No backup found for version ${version}`);
            }

            const backupFile = backupFiles[0];
            console.log(`Rolling back to backup: ${backupFile}`);

            // Close current connection
            await this.close();

            // Restore from backup
            fs.copyFileSync(backupFile, this.dbPath);

            // Remove migration record
            await this.connect();
            await this.runQuery(`DELETE FROM ${this.migrationsTable} WHERE version = ?`, [version]);

            console.log(`Successfully rolled back to version ${version}`);

        } catch (error) {
            console.error('Rollback failed:', error);
            throw error;
        } finally {
            await this.close();
        }
    }
}

// Export for use in other files
module.exports = DatabaseMigration;

// Run migrations if this file is executed directly
if (require.main === module) {
    const migration = new DatabaseMigration();
    migration.migrate()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
} 