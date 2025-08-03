const DatabaseMigration = require('./migration_system');

async function runMigrations() {
    console.log('=== Diet App Database Migration Tool ===\n');

    const migration = new DatabaseMigration();

    try {
        // Check current migration status
        await migration.connect();
        await migration.createMigrationsTable();
        const appliedMigrations = await migration.getAppliedMigrations();
        await migration.close();

        console.log('Current migration status:');
        if (appliedMigrations.length === 0) {
            console.log('  No migrations applied yet');
        } else {
            appliedMigrations.forEach(version => {
                console.log(`  ✓ Migration ${version} applied`);
            });
        }

        console.log('\nThis will safely migrate your database with the following changes:');
        console.log('  1. Add user preferences table (daily calorie goals, weight units, theme)');
        console.log('  2. Add exercise tracking table');
        console.log('  3. Add meal categories and improve meals table');
        console.log('  4. Add meal planning table');
        console.log('\n⚠️  IMPORTANT: A backup will be created before each migration');
        console.log('   Your existing data will be preserved and enhanced\n');

        // In a real scenario, you might want to prompt for confirmation
        // For now, we'll proceed automatically
        console.log('Starting migrations...\n');

        await migration.migrate();

        console.log('\n✅ All migrations completed successfully!');
        console.log('Your database has been safely updated with new features.');
        console.log('\nNew features available:');
        console.log('  • User preferences (daily calorie goals, weight units, theme)');
        console.log('  • Exercise tracking');
        console.log('  • Meal categories (Breakfast, Lunch, Dinner, Snack)');
        console.log('  • Meal planning');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.log('\nYour database has not been modified.');
        console.log('If you need to rollback, use: node rollback_migration.js <version>');
        process.exit(1);
    }
}

// Run migrations
runMigrations(); 