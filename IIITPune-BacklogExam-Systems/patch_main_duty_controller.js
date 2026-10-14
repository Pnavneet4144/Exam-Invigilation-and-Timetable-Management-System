const fs = require('fs');
let content = fs.readFileSync('backend/controllers/mainExamDutyController.js', 'utf8');

const oldGenerate = `exports.generate = async (req, res) => {
  try {
    const { academic_year, start_date, end_date } = req.body;
    if (!academic_year || !start_date || !end_date) {
      return res.status(400).json({ error: 'academic_year, start_date, and end_date are required' });
    }

    const workingDates = await getWorkingDates(start_date, end_date);`;

const newGenerate = `exports.generate = async (req, res) => {
  try {
    const { academic_year } = req.body;
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year is required' });
    }

    const periodRes = await db.query('SELECT start_date, end_date FROM exam_periods WHERE academic_year = $1', [academic_year]);
    if (periodRes.rows.length === 0) {
      return res.status(404).json({ error: 'No exam period found for this academic year — import the seating plan first' });
    }

    const { start_date, end_date } = periodRes.rows[0];

    const workingDates = await getWorkingDates(start_date, end_date);`;

content = content.replace(oldGenerate, newGenerate);

content = content.replace(
  "        assigned: inserted,\n        warnings,\n        rotation_repeats: repeatCount\n      });",
  "        assigned: inserted,\n        warnings,\n        rotation_repeats: repeatCount,\n        exam_date_range: { start_date, end_date }\n      });"
);

fs.writeFileSync('backend/controllers/mainExamDutyController.js', content);
