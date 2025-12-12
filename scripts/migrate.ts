/**
 * Database Migration Script
 *
 * Run: npm run db:migrate
 *
 * This script initializes the database schema.
 * Make sure PostgreSQL is running (docker-compose up -d)
 */

import { initializeDatabase, testConnection, closePool } from '../src/db/client.js';

async function main() {
  console.log('Testing database connection...');

  const connected = await testConnection();
  if (!connected) {
    console.error('Failed to connect to database. Is PostgreSQL running?');
    console.log('Run: docker-compose up -d');
    process.exit(1);
  }

  console.log('Connected to database');
  console.log('Running migrations...');

  await initializeDatabase();

  console.log('Migrations complete!');

  await closePool();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
