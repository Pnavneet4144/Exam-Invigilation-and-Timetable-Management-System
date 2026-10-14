const fs = require('fs');

let content = fs.readFileSync('backend/controllers/approvalsController.js', 'utf8');

content = content.replace(
  "if (type === 'schedule') return 'exam_schedule';",
  "if (type === 'schedule') return 'exam_schedule';\n  if (type === 'main_duty') return 'main_exam_duty';"
);

content = content.replace(
  "if (table === 'exam_schedule' || table === 'regular_exam_duty') {",
  "if (table === 'exam_schedule' || table === 'regular_exam_duty' || table === 'main_exam_duty') {"
);

content = content.replace(
  "    } else if (type === 'regular_duty') {",
  `    } else if (type === 'main_duty') {
      result = await db.query(
        \`SELECT m.id, m.exam_date, m.academic_year,
                m.status, m.is_manual_override,
                m.rejection_notes,
                r.room_no, r.building,
                f.name AS faculty_name, f.designation AS faculty_desig,
                u.name AS created_by_name
         FROM main_exam_duty m
         JOIN rooms r ON m.room_id = r.id
         LEFT JOIN faculty f ON m.faculty_id = f.id
         LEFT JOIN users u ON m.approved_by = u.id
         WHERE m.status = 'pending_approval'
         ORDER BY m.exam_date, r.room_no\`
      );
    } else if (type === 'regular_duty') {`
);

fs.writeFileSync('backend/controllers/approvalsController.js', content);
