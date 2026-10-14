/**
 * Test Seed Script for Phase 2 Scheduling Engine Verification
 * 
 * Inserts test data ONLY if the target tables are currently empty:
 * - 3 rooms: 2 CR (capacity 60), 1 LH (capacity 120)
 * - 5 subjects across different semesters
 * - 5 students (A, B, C, D, E)
 * - Backlogs for academic_year "2026-2027":
 *   - Student A: 20 backlogs
 *   - Student B: 3 backlogs
 *   - Student C: 1 backlog
 *   - Student D: 1 backlog
 *   - Student E: 1 backlog
 * - 2 holidays within the next 30 days
 */

const db = require('./index');

async function seedTestData() {
  try {
    console.log('--- Checking table counts before seeding test data ---');
    const countCheck = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM rooms) AS rooms_count,
        (SELECT COUNT(*) FROM subjects) AS subjects_count,
        (SELECT COUNT(*) FROM students) AS students_count,
        (SELECT COUNT(*) FROM backlog_papers) AS backlogs_count,
        (SELECT COUNT(*) FROM holidays) AS holidays_count
    `);

    const { rooms_count, subjects_count, students_count, backlogs_count, holidays_count } = countCheck.rows[0];

    if (
      parseInt(rooms_count, 10) > 0 ||
      parseInt(subjects_count, 10) > 0 ||
      parseInt(students_count, 10) > 0 ||
      parseInt(backlogs_count, 10) > 0 ||
      parseInt(holidays_count, 10) > 0
    ) {
      console.log('Tables are not empty. Skipping test seed to prevent data overwrite.');
      return;
    }

    console.log('Tables are empty. Seeding Phase 2 verification data...');

    // 1. Insert 3 rooms
    const roomInserts = await db.query(`
      INSERT INTO rooms (room_no, building, capacity, room_type, people_per_bench) VALUES
      ('CR-101', 'Academic Block A', 60, 'CR', 2),
      ('CR-102', 'Academic Block A', 60, 'CR', 2),
      ('LH-01', 'Lecture Hall Complex', 120, 'LH', 2)
      RETURNING id, room_no, capacity, room_type;
    `);
    console.log(`Inserted ${roomInserts.rows.length} rooms:`, roomInserts.rows.map(r => `${r.room_no} (${r.room_type}, cap: ${r.capacity})`).join(', '));

    // 2. Insert 5 subjects across different semesters
    const subjectInserts = await db.query(`
      INSERT INTO subjects (subject_code, subject_name, semester, department) VALUES
      ('CS101', 'Introduction to Programming', 1, 'CSE'),
      ('CS201', 'Data Structures and Algorithms', 2, 'CSE'),
      ('CS301', 'Database Management Systems', 3, 'CSE'),
      ('CS401', 'Computer Networks', 4, 'CSE'),
      ('CS501', 'Operating Systems', 5, 'CSE')
      RETURNING id, subject_code, semester;
    `);
    console.log(`Inserted ${subjectInserts.rows.length} subjects.`);
    const subjects = subjectInserts.rows;

    // 3. Insert 5 students
    const studentInserts = await db.query(`
      INSERT INTO students (roll_no, name, department, semester, email) VALUES
      ('CS2023001', 'Student A', 'CSE', 6, 'studentA@iiitpune.ac.in'),
      ('CS2023002', 'Student B', 'CSE', 6, 'studentB@iiitpune.ac.in'),
      ('CS2023003', 'Student C', 'CSE', 6, 'studentC@iiitpune.ac.in'),
      ('CS2023004', 'Student D', 'CSE', 6, 'studentD@iiitpune.ac.in'),
      ('CS2023005', 'Student E', 'CSE', 6, 'studentE@iiitpune.ac.in')
      RETURNING id, roll_no, name;
    `);
    console.log(`Inserted ${studentInserts.rows.length} students.`);
    const [stA, stB, stC, stD, stE] = studentInserts.rows;

    // 4. Insert backlog papers for academic_year "2026-2027"
    const academicYear = '2026-2027';

    // Student A: 20 backlogs
    for (let i = 0; i < 20; i++) {
      const sub = subjects[i % subjects.length];
      await db.query(
        `INSERT INTO backlog_papers (student_id, subject_id, academic_year, status) VALUES ($1, $2, $3, 'pending')`,
        [stA.id, sub.id, academicYear]
      );
    }
    console.log(`Inserted 20 backlog papers for Student A (${stA.roll_no}).`);

    // Student B: 3 backlogs
    for (let i = 0; i < 3; i++) {
      const sub = subjects[i % subjects.length];
      await db.query(
        `INSERT INTO backlog_papers (student_id, subject_id, academic_year, status) VALUES ($1, $2, $3, 'pending')`,
        [stB.id, sub.id, academicYear]
      );
    }
    console.log(`Inserted 3 backlog papers for Student B (${stB.roll_no}).`);

    // Students C, D, E: 1 backlog each
    await db.query(
      `INSERT INTO backlog_papers (student_id, subject_id, academic_year, status) VALUES ($1, $2, $3, 'pending')`,
      [stC.id, subjects[0].id, academicYear]
    );
    await db.query(
      `INSERT INTO backlog_papers (student_id, subject_id, academic_year, status) VALUES ($1, $2, $3, 'pending')`,
      [stD.id, subjects[1].id, academicYear]
    );
    await db.query(
      `INSERT INTO backlog_papers (student_id, subject_id, academic_year, status) VALUES ($1, $2, $3, 'pending')`,
      [stE.id, subjects[2].id, academicYear]
    );
    console.log('Inserted 1 backlog paper each for Students C, D, and E.');

    // 4.5 Insert Faculty for Phase 3 testing
    const facultyInserts = await db.query(`
      INSERT INTO faculty (name, department, designation, email, max_duty_load, is_available) VALUES
      ('Dr. Admin HOD', 'Computer Science & Engineering', 'HOD', 'hod@iiitpune.ac.in', 5, true),
      ('Dr. Alice AsstProf', 'Computer Science & Engineering', 'Assistant Professor', 'alice@iiitpune.ac.in', 5, true),
      ('Dr. Bob AssocProf', 'Computer Science & Engineering', 'Associate Professor', 'bob@iiitpune.ac.in', 5, true),
      ('Dr. Charlie Prof', 'Computer Science & Engineering', 'Professor', 'charlie@iiitpune.ac.in', 5, true),
      ('Dr. Eve OnLeave', 'Computer Science & Engineering', 'Assistant Professor', 'eve@iiitpune.ac.in', 5, false)
      RETURNING id, name, designation;
    `);
    console.log(`Inserted ${facultyInserts.rows.length} faculty for testing.`);

    // 5. Insert 2 holidays within next 30 days
    // Pick two future weekday dates
    const now = new Date();
    
    // Holiday 1: 7 days from now (or adjusted if weekend)
    const h1 = new Date(now);
    h1.setDate(now.getDate() + 7);
    if (h1.getDay() === 0) h1.setDate(h1.getDate() + 1); // if Sunday, make Monday
    if (h1.getDay() === 6) h1.setDate(h1.getDate() + 2); // if Saturday, make Monday

    // Holiday 2: 15 days from now (or adjusted if weekend)
    const h2 = new Date(now);
    h2.setDate(now.getDate() + 15);
    if (h2.getDay() === 0) h2.setDate(h2.getDate() + 1);
    if (h2.getDay() === 6) h2.setDate(h2.getDate() + 2);

    const h1Str = h1.toISOString().split('T')[0];
    const h2Str = h2.toISOString().split('T')[0];

    await db.query(`
      INSERT INTO holidays (holiday_date, description) VALUES
      ($1, 'Test Mid-Semester Holiday'),
      ($2, 'Test Festival Holiday')
    `, [h1Str, h2Str]);
    console.log(`Inserted 2 test holidays: ${h1Str}, ${h2Str}`);

    console.log('=== Test Seed Completed Successfully ===');
  } catch (err) {
    console.error('Error seeding test data:', err);
    throw err;
  }
}

if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedTestData };
