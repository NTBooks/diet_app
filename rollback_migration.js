const DatabaseMigration = require('./migration_system');

async function rollbackMigration() {
    const version = process.argv[2];

    if (!version) {
        console.error('❌ Please specify a migration version to rollback');
        console.log('Usage: node rollback_migration.js <version>');
        console.log('Example: node rollback_migration.js 003');
        process.exit(1);
    }

    console.log(`=== Rolling back migration ${version} ===\n`);

    const migration = new DatabaseMigration();

    try {
        await migration.rollback(version);
        console.log(`\n✅ Successfully rolled back to before migration ${version}`);
        console.log('Your database has been restored to its previous state.');

    } catch (error) {
        console.error(`\n❌ Rollback failed:`, error.message);
        console.log('\nYour database remains unchanged.');
        process.exit(1);
    }
}

// Run rollback
rollbackMigration(); 