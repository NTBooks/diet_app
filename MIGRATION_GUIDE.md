# Database Migration Guide

This guide explains how to safely update your diet app database without losing any existing data.

## 🛡️ Safety Features

- **Automatic Backups**: Every migration creates a timestamped backup before making changes
- **Version Tracking**: All migrations are tracked in a `schema_migrations` table
- **Rollback Support**: You can rollback to any previous version if needed
- **Non-Destructive**: Existing data is preserved and enhanced, never deleted

## 📋 Available Migrations

The migration system includes these enhancements:

1. **User Preferences** (`001`)

   - Daily calorie goals
   - Weight units (lbs/kg)
   - Theme preferences

2. **Exercise Tracking** (`002`)

   - Log exercise activities
   - Track calories burned
   - Duration and notes

3. **Meal Categories** (`003`)

   - Organize meals by type (Breakfast, Lunch, Dinner, Snack)
   - Color-coded categories
   - Enhanced meal management

4. **Meal Planning** (`004`)
   - Plan meals in advance
   - Schedule meals by date and type
   - Add notes to planned meals

## 🚀 Running Migrations

### Option 1: Using npm scripts (Recommended)

```bash
# Run all pending migrations
npm run migrate

# Create a manual backup
npm run db:backup

# Rollback a specific migration
npm run migrate:rollback 003
```

### Option 2: Direct node commands

```bash
# Run migrations
node run_migrations.js

# Rollback migration
node rollback_migration.js 003
```

## 📊 Migration Status

Check which migrations have been applied:

```bash
node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./diet_app.db');
db.all('SELECT version, description, applied_at FROM schema_migrations ORDER BY version', (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);
    db.close();
});
"
```

## 🔄 Rollback Process

If you need to rollback a migration:

1. **Identify the version** you want to rollback to
2. **Run the rollback command**:
   ```bash
   npm run migrate:rollback 003
   ```
3. **Verify the rollback** by checking migration status

**Note**: Rolling back will restore your database to the state before that migration was applied.

## 📁 Backup Files

Backup files are automatically created with the format:

```
diet_app.db.backup.2024-01-15T10-30-45-123Z
```

These files contain your complete database state before each migration.

## 🆕 New API Endpoints

After running migrations, these new endpoints are available:

### User Preferences

- `GET /api/preferences` - Get all user preferences
- `POST /api/preferences` - Update a preference

### Exercise Tracking

- `POST /api/exercise_log` - Log an exercise
- `GET /api/exercise_log_for_day` - Get exercises for a day
- `DELETE /api/exercise_log/:id` - Delete exercise log

### Meal Categories

- `GET /api/meal_categories` - Get all categories
- `POST /api/meal_categories` - Add new category

### Meal Planning

- `POST /api/meal_plans` - Plan a meal
- `GET /api/meal_plans_for_day` - Get planned meals for a day
- `DELETE /api/meal_plans/:id` - Delete meal plan

## ⚠️ Important Notes

1. **Always backup** before running migrations (automatic, but you can create manual backups too)
2. **Test in development** before running on production data
3. **Keep backup files** until you're confident the migrations work correctly
4. **Don't delete** the `schema_migrations` table - it tracks which migrations have been applied

## 🆘 Troubleshooting

### Migration Fails

If a migration fails:

1. Check the error message
2. Your database is unchanged (the migration system is transactional)
3. Fix the issue and try again
4. If needed, rollback to a previous version

### Database Corruption

If your database becomes corrupted:

1. Find the most recent backup file
2. Copy it to replace your current database:
   ```bash
   cp diet_app.db.backup.2024-01-15T10-30-45-123Z diet_app.db
   ```
3. Restart your application

### Missing Migration Records

If the `schema_migrations` table is missing:

1. The migration system will recreate it
2. You may need to manually mark some migrations as applied
3. Contact support if you're unsure about the state

## 🔧 Advanced Usage

### Custom Migrations

To add your own migrations, edit `migration_system.js` and add to the migrations array:

```javascript
{
    version: '005',
    description: 'Your custom migration',
    run: async () => {
        await this.runQuery('YOUR SQL HERE');
    }
}
```

### Database Inspection

Inspect your database structure:

```bash
node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./diet_app.db');
db.all(\"SELECT name FROM sqlite_master WHERE type='table'\", (err, tables) => {
    if (err) console.error(err);
    else console.log('Tables:', tables.map(t => t.name));
    db.close();
});
"
```

## 📞 Support

If you encounter issues:

1. Check the error messages carefully
2. Verify your database file exists and is not corrupted
3. Check that you have write permissions in the directory
4. Ensure no other processes are using the database file
