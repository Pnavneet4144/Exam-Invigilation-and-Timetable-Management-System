const fs = require('fs');
let code = fs.readFileSync('backend/controllers/approvalsController.js', 'utf8');

// Remove duplicate blocks:
code = code.replace(/\n\s*\} else if \(type === 'regular_duty'\) \{[\s\S]*?(?=\n\n|\nconst |\nmodule)/g, '');

const regularDutyQueryCode = `
    } else if (type === 'regular_duty') {
      result = await db.query(
        \`SELECT red.id, red.exam_date, red.time_slot, red.academic_year,
                red.status, red.is_manual_override,
                red.rejection_notes,
                r.room_no, r.building,
                sec.class_name, sec.section_name,
                sub.subject_code, sub.subject_name,
                f1.name AS f1_name, f1.designation AS f1_desig,
                f2.name AS f2_name, f2.designation AS f2_desig,
                u.name AS created_by_name
         FROM regular_exam_duty red
         JOIN rooms r ON red.room_id = r.id
         JOIN sections sec ON red.section_id = sec.id
         JOIN subjects sub ON red.subject_id = sub.id
         LEFT JOIN faculty f1 ON red.faculty_id_1 = f1.id
         LEFT JOIN faculty f2 ON red.faculty_id_2 = f2.id
         LEFT JOIN users u ON red.created_by = u.id
         WHERE red.status = 'pending_approval'
         ORDER BY red.exam_date, red.time_slot\`
      );
    }
`;

code = code.replace(/ORDER BY es\.exam_date, es\.time_slot\`\s+\);\s+\}\s+return res\.json/g, "ORDER BY es.exam_date, es.time_slot`\n      );\n" + regularDutyQueryCode + "\n    return res.json");

fs.writeFileSync('backend/controllers/approvalsController.js', code);
