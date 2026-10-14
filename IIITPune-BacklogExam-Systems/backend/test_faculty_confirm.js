const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  const client = await pool.connect();
  try {
    let inserted = 0;
    const names = ['Faculty A', 'Faculty B'];
    for (const name of names) {
      await client.query(
        "INSERT INTO faculty (name, designation, max_duty_load, is_available) VALUES ($1, 'Assistant Professor', 5, true) ON CONFLICT DO NOTHING",
        [name]
      );
      inserted++;
    }
    console.log("SUCCESS");
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    client.release();
    pool.end();
  }
}
run();
