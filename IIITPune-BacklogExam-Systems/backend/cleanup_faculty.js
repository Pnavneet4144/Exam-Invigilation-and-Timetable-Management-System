require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function isValidFacultyName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;
  if (/^\d+$/.test(trimmed)) return false;
  const alphaChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (alphaChars < 3) return false;
  if (trimmed.includes(':') || trimmed.includes('--')) return false;
  
  const lowerName = trimmed.toLowerCase();
  const blacklistedTerms = ['exam', 'sem', 'hon', 'duty', 'date', 'invig', 'room', 'total', 'floor', 'squad', 'academic', 'year', 'course', 'time', 'chart', 'classroom', 'declared'];
  for (const term of blacklistedTerms) {
    if (lowerName.includes(term)) return false;
  }
  
  const words = trimmed.split(/\s+/);
  const prefixes = ['dr', 'dr.', 'mr', 'mr.', 'ms', 'ms.', 'mrs', 'mrs.', 'prof', 'prof.'];
  const hasPrefix = prefixes.includes(words[0].toLowerCase());
  
  if (!hasPrefix && words.length < 2) return false;
  
  return true;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('SELECT id, name FROM faculty');
    let deletedCount = 0;
    
    console.log("--- BEFORE CLEANUP ---");
    for (const row of res.rows) {
      if (!isValidFacultyName(row.name)) {
        const dutiesRes = await client.query('SELECT count(*) FROM duties WHERE faculty_id = $1', [row.id]);
        const mainDutiesRes = await client.query('SELECT count(*) FROM main_exam_duty WHERE faculty_id = $1', [row.id]);
        // Note: regular_exam_duty also might have references, but it's legacy/deprecated.
        const reqDuties1Res = await client.query('SELECT count(*) FROM regular_exam_duty WHERE faculty_id_1 = $1 OR faculty_id_2 = $1', [row.id]);
        
        const dutiesCount = parseInt(dutiesRes.rows[0].count);
        const mainDutiesCount = parseInt(mainDutiesRes.rows[0].count);
        const reqDutiesCount = parseInt(reqDuties1Res.rows[0].count);
        
        if (dutiesCount === 0 && mainDutiesCount === 0 && reqDutiesCount === 0) {
          await client.query('DELETE FROM faculty WHERE id = $1', [row.id]);
          console.log(`DELETED: "${row.name}"`);
          deletedCount++;
        } else {
          console.log(`WARNING: "${row.name}" is garbage but has assignments. Skipping.`);
        }
      }
    }
    await client.query('COMMIT');
    console.log(`\nCleanup complete. Deleted ${deletedCount} garbage entries.`);
    
    const afterRes = await client.query('SELECT id, name FROM faculty ORDER BY id');
    console.log("\n--- AFTER CLEANUP ---");
    afterRes.rows.forEach(r => console.log(`${r.id} | ${r.name}`));
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error:", err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
