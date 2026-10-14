const db = require('../db');
const { Pool } = require('pg');

const getPool = () => new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

exports.getResetInfo = async (req, res) => {
  try {
    const tables = [
      'backlog_papers', 'exam_schedule', 'duties', 'main_exam_duty',
      'regular_exam_duty', 'seating_blocks', 'exam_periods', 'student_pacing',
      'students', 'subjects', 'faculty', 'rooms'
    ];

    const academicYears = new Set();

    // Collect distinct academic years
    const sbRes = await db.query('SELECT DISTINCT academic_year FROM seating_blocks WHERE academic_year IS NOT NULL');
    sbRes.rows.forEach(r => academicYears.add(r.academic_year));

    const epRes = await db.query('SELECT DISTINCT academic_year FROM exam_periods WHERE academic_year IS NOT NULL');
    epRes.rows.forEach(r => academicYears.add(r.academic_year));

    const medRes = await db.query('SELECT DISTINCT academic_year FROM main_exam_duty WHERE academic_year IS NOT NULL');
    medRes.rows.forEach(r => academicYears.add(r.academic_year));

    const esRes = await db.query('SELECT DISTINCT academic_year FROM exam_schedule WHERE academic_year IS NOT NULL');
    esRes.rows.forEach(r => academicYears.add(r.academic_year));

    res.json({
      tables,
      academicYears: Array.from(academicYears).sort()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resetFull = async (req, res) => {
  const { confirmation } = req.body;
  if (confirmation !== 'RESET ALL DATA') {
    return res.status(400).json({ error: 'Invalid confirmation phrase' });
  }

  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const counts = {};
    const tables = [
      'backlog_papers', 'exam_schedule', 'duties', 'main_exam_duty', 'regular_exam_duty',
      'seating_blocks', 'exam_periods', 'student_pacing',
      'students', 'subjects', 'faculty', 'rooms'
    ];
    
    for (const table of tables) {
      const res = await client.query(`DELETE FROM ${table}`);
      counts[table] = res.rowCount;
    }
    
    await client.query('COMMIT');
    res.json({ message: 'All operational data reset successfully', counts });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset full error:', err);
    res.status(500).json({ error: 'Reset failed and rolled back' });
  } finally {
    client.release();
    pool.end();
  }
};

exports.resetYear = async (req, res) => {
  const { academic_year, confirmation } = req.body;
  if (!academic_year) {
    return res.status(400).json({ error: 'Academic year is required' });
  }
  if (confirmation !== `RESET ${academic_year}`) {
    return res.status(400).json({ error: 'Invalid confirmation phrase' });
  }

  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const counts = {};
    const tablesWithYear = ['main_exam_duty', 'exam_periods', 'seating_blocks', 'exam_schedule', 'duties'];
    
    // For duties, it might not have academic_year directly but links through exam_schedule.
    // Let's check schema.
    for (const table of ['main_exam_duty', 'exam_periods', 'seating_blocks', 'exam_schedule', 'duties']) {
      // Safely check if column exists
      const colCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name=$1 AND column_name='academic_year'`, [table]);
      if (colCheck.rowCount > 0) {
        const result = await client.query(`DELETE FROM ${table} WHERE academic_year = $1`, [academic_year]);
        counts[table] = result.rowCount;
      } else if (table === 'duties') {
        // duties uses exam_schedule_id which belongs to academic_year
        const result = await client.query(`
          DELETE FROM duties 
          WHERE exam_schedule_id IN (
            SELECT id FROM exam_schedule WHERE academic_year = $1
          )
        `, [academic_year]);
        counts[table] = result.rowCount;
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: `Data for ${academic_year} reset successfully`, counts });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset year error:', err);
    res.status(500).json({ error: 'Reset failed and rolled back' });
  } finally {
    client.release();
    pool.end();
  }
};
