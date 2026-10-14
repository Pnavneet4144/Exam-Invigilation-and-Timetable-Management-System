require('dotenv').config({ path: 'backend/.env' });
const { generate } = require('./backend/controllers/mainExamDutyController');
const db = require('./backend/db');

async function test() {
  try {
    // 1. insert mock exam period
    await db.query(\`
      INSERT INTO exam_periods (academic_year, start_date, end_date, source)
      VALUES ('2026-2027', '2026-05-14', '2026-05-25', 'test')
      ON CONFLICT (academic_year) DO NOTHING;
    \`);
    
    // 2. generate
    const req = { body: { academic_year: '2026-2027' } };
    const res = {
      status: (code) => ({ json: (d) => console.log(code, d) }),
      json: (d) => console.log('SUCCESS:', d)
    };
    await generate(req, res);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();
