const sqlite3 = require('sqlite3').verbose();

// Connect to the database
const db = new sqlite3.Database('./diet_app.db', (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        process.exit(1);
    } else {
        console.log('Connected to SQLite database for migration');
    }
});

// Migration function
const migrateDatabase = () => {
    console.log('Starting database migration...');

    // Check if the old meal_log table exists with the old structure
    db.get("PRAGMA table_info(meal_log)", (err, rows) => {
        if (err) {
            console.error('Error checking table structure:', err);
            return;
        }

        db.all("PRAGMA table_info(meal_log)", (err, columns) => {
            if (err) {
                console.error('Error getting table info:', err);
                return;
            }

            // Check if we have the old structure (meal_id, ounces) or new structure (meal_name, calories)
            const hasMealId = columns.some(col => col.name === 'meal_id');
            const hasMealName = columns.some(col => col.name === 'meal_name');

            if (hasMealId && !hasMealName) {
                console.log('Detected old database structure. Starting migration...');

                // Create a backup of the old meal_log table
                db.run("CREATE TABLE meal_log_backup AS SELECT * FROM meal_log", (err) => {
                    if (err) {
                        console.error('Error creating backup:', err);
                        return;
                    }
                    console.log('Created backup table: meal_log_backup');

                    // Drop the old meal_log table
                    db.run("DROP TABLE meal_log", (err) => {
                        if (err) {
                            console.error('Error dropping old table:', err);
                            return;
                        }
                        console.log('Dropped old meal_log table');

                        // Create the new meal_log table
                        db.run(`CREATE TABLE meal_log (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            meal_name TEXT NOT NULL,
                            calories REAL NOT NULL,
                            date TEXT NOT NULL
                        )`, (err) => {
                            if (err) {
                                console.error('Error creating new table:', err);
                                return;
                            }
                            console.log('Created new meal_log table');

                            // Migrate data from backup to new structure
                            db.all("SELECT * FROM meal_log_backup", (err, oldLogs) => {
                                if (err) {
                                    console.error('Error reading backup data:', err);
                                    return;
                                }

                                console.log(`Found ${oldLogs.length} old meal log entries to migrate`);

                                // For each old log entry, get the meal details and calculate calories
                                let migratedCount = 0;
                                let errorCount = 0;

                                oldLogs.forEach((oldLog, index) => {
                                    db.get("SELECT name, calories_per_serving, ounces_per_serving FROM meals WHERE id = ?",
                                        [oldLog.meal_id], (err, meal) => {
                                            if (err) {
                                                console.error('Error getting meal details:', err);
                                                errorCount++;
                                                return;
                                            }

                                            if (!meal) {
                                                console.log(`Warning: Meal with ID ${oldLog.meal_id} not found, skipping`);
                                                errorCount++;
                                                return;
                                            }

                                            // Calculate calories
                                            const calories = Math.round((oldLog.ounces * meal.calories_per_serving) / meal.ounces_per_serving);

                                            // Insert into new table
                                            db.run("INSERT INTO meal_log (meal_name, calories, date) VALUES (?, ?, ?)",
                                                [meal.name, calories, oldLog.date], function (err) {
                                                    if (err) {
                                                        console.error('Error inserting migrated data:', err);
                                                        errorCount++;
                                                    } else {
                                                        migratedCount++;
                                                    }

                                                    // Check if this was the last migration
                                                    if (migratedCount + errorCount === oldLogs.length) {
                                                        console.log(`Migration complete! Migrated ${migratedCount} entries, ${errorCount} errors`);

                                                        // Optionally drop the backup table
                                                        db.run("DROP TABLE meal_log_backup", (err) => {
                                                            if (err) {
                                                                console.error('Error dropping backup table:', err);
                                                            } else {
                                                                console.log('Dropped backup table');
                                                            }
                                                            console.log('Migration finished successfully!');
                                                            process.exit(0);
                                                        });
                                                    }
                                                });
                                        });
                                });

                                if (oldLogs.length === 0) {
                                    console.log('No old data to migrate');
                                    db.run("DROP TABLE meal_log_backup", (err) => {
                                        if (err) {
                                            console.error('Error dropping backup table:', err);
                                        } else {
                                            console.log('Dropped backup table');
                                        }
                                        console.log('Migration finished successfully!');
                                        process.exit(0);
                                    });
                                }
                            });
                        });
                    });
                });
            } else if (hasMealName) {
                console.log('Database already has the new structure. No migration needed.');
                process.exit(0);
            } else {
                console.log('meal_log table not found or has unexpected structure.');
                process.exit(1);
            }
        });
    });
};

// Run the migration
migrateDatabase(); 