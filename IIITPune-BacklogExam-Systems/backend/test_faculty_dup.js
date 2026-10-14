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
    await txClient.query("INSERT INTO faculty (name) VALUES ('Test Dup')");
    await txClient.query("INSERT INTO faculty (name) VALUES ('Test Dup') ON CONFLICT DO NOTHING");
    console.log("SUCCESS");
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    txClient.release();
    pool.end();
  }
}
run();
