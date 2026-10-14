const { Pool, types } = require('pg');
require('dotenv').config();

// Ensure PostgreSQL DATE (OID 1082) is returned as literal 'YYYY-MM-DD' string
// without automatic UTC/local timezone conversions that cause date shifts.
types.setTypeParser(1082, str => str);

// Create a new Pool using environment variables
// This allows the connection to be reused, preventing the overhead
// of opening and closing database connections for every query.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Export a query function that uses the pool internally
module.exports = {
  query: (text, params) => pool.query(text, params),
};
