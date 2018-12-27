/**
 * Database Service
 *
 * Manages database connections
 */

const { Pool } = require('pg');

const config = require.main.require('./config');
const pool = new Pool(config.database);

// Catch pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
