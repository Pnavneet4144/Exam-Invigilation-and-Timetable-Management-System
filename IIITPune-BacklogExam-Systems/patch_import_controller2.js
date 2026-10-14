const fs = require('fs');
let content = fs.readFileSync('backend/controllers/importController.js', 'utf8');

// Pass req.body into commitSeatingPlan
content = content.replace(
  "result = await commitSeatingPlan(txClient, preview);",
  "result = await commitSeatingPlan(txClient, preview, req.body);"
);

// Update commitSeatingPlan signature and add exam_periods logic
const oldCommit = "async function commitSeatingPlan(client, preview) {";
const newCommit = `async function commitSeatingPlan(client, preview, body = {}) {
  const academicYear = preview.academicYear;
  let sDate = preview.start_date;
  let eDate = preview.end_date;
  let source = 'seating_plan_header';

  if (!preview.exam_period_found) {
    if (!body.manual_start_date || !body.manual_end_date) {
      throw new Error("Exam start and end dates are required because they could not be found in the header.");
    }
    sDate = body.manual_start_date;
    eDate = body.manual_end_date;
    source = 'manual_entry';
  }

  // Upsert into exam_periods
  await client.query(
    \`INSERT INTO exam_periods (academic_year, start_date, end_date, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (academic_year) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, source = EXCLUDED.source\`,
    [academicYear, sDate, eDate, source]
  );
`;

content = content.replace(oldCommit, newCommit);

fs.writeFileSync('backend/controllers/importController.js', content);
