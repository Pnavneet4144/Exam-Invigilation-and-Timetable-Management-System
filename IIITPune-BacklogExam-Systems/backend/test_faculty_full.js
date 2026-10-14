const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const txClient = await pool.connect();
  try {
    await txClient.query('BEGIN');
    let inserted = 0;
    const preview = { newFaculty: ['New Faculty A'], existingMatches: [] };
    
    for (const name of preview.newFaculty) {
      await txClient.query(
        "INSERT INTO faculty (name, designation, max_duty_load, is_available) VALUES ($1, 'Assistant Professor', 5, true) ON CONFLICT DO NOTHING",
        [name]
      );
      inserted++;
    }
    await txClient.query('COMMIT');
    console.log("SUCCESS:", inserted);
  } catch (err) {
    await txClient.query('ROLLBACK');
    console.error("ERROR:", err);
  } finally {
    txClient.release();
    pool.end();
  }
}
run();
