const fs = require('fs');

let content = fs.readFileSync('backend/controllers/importController.js', 'utf8');

// Update preview students mapping to pass department and semester
content = content.replace(
  "const existingStudentsRes = await db.query('SELECT id, roll_no, name FROM students');",
  "const existingStudentsRes = await db.query('SELECT id, roll_no, name, department, semester FROM students');"
);

content = content.replace(
  `for (const s of parsed.students) {
      const key = s.roll_no.toLowerCase().trim();
      if (studentByRoll[key]) {
        studentsMatched.push({ roll_no: s.roll_no, name: s.name, existing_name: studentByRoll[key].name });
        studentRollToStatus[key] = 'existing';
      } else {
        studentsToCreate.push({ roll_no: s.roll_no, name: s.name });
        studentRollToStatus[key] = 'new';
      }
    }`,
  `for (const s of parsed.students) {
      const key = s.roll_no.toLowerCase().trim();
      if (studentByRoll[key]) {
        studentsMatched.push({ 
          roll_no: s.roll_no, 
          name: s.name, 
          existing_name: studentByRoll[key].name,
          department: s.department,
          semester: s.semester,
          existing_department: studentByRoll[key].department,
          existing_semester: studentByRoll[key].semester
        });
        studentRollToStatus[key] = 'existing';
      } else {
        studentsToCreate.push({ 
          roll_no: s.roll_no, 
          name: s.name,
          department: s.department,
          semester: s.semester
        });
        studentRollToStatus[key] = 'new';
      }
    }`
);

// Update commit logic to insert dept/sem for new, and backfill for existing
content = content.replace(
  `for (const s of studentsToCreate) {
    const r = await client.query(
      \`INSERT INTO students (roll_no, name)
       VALUES ($1, $2)
       ON CONFLICT (roll_no) DO UPDATE SET name = EXCLUDED.name
       RETURNING id\`,
      [s.roll_no, s.name]
    );
    newStudentIds[s.roll_no.toLowerCase().trim()] = r.rows[0].id;
    studentsInserted++;
  }`,
  `for (const s of studentsToCreate) {
    const r = await client.query(
      \`INSERT INTO students (roll_no, name, department, semester)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (roll_no) DO UPDATE SET name = EXCLUDED.name
       RETURNING id\`,
      [s.roll_no, s.name, s.department, s.semester]
    );
    newStudentIds[s.roll_no.toLowerCase().trim()] = r.rows[0].id;
    studentsInserted++;
  }

  // 1b. Backfill existing students if missing dept/sem
  for (const s of preview.studentsMatched) {
    if ((s.department && !s.existing_department) || (s.semester && !s.existing_semester)) {
      await client.query(
        \`UPDATE students 
         SET department = COALESCE(department, $1),
             semester = COALESCE(semester, $2)
         WHERE roll_no = $3\`,
        [s.department, s.semester, s.roll_no]
      );
    }
  }`
);

fs.writeFileSync('backend/controllers/importController.js', content);
