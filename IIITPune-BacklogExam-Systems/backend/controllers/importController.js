/**
 * Import Controller
 * 
 * Handles the two-step preview/confirm import flow for three advanced file types:
 *   1. Faculty Roster — extract faculty names
 *   2. Seating Plan — matrix of room×branch-semester roll ranges
 *   3. Backlog Matrix — wide pivot of student×subject backlog flags
 * 
 * Flow:
 *   POST /preview → parse file, build preview, store in memory, return preview_id
 *   POST /confirm/:previewId → commit the stored preview to DB in a transaction
 *   POST /cancel/:previewId → discard a stored preview
 * 
 * Previews are stored in an in-memory Map with a 30-minute TTL.
 */

const db = require('../db');
const crypto = require('crypto');
const { parseFacultyRoster } = require('../utils/facultyRosterParser');
const { parseSeatingPlan } = require('../utils/seatingPlanParser');
const { parseBacklogMatrix, generateSubjectCode } = require('../utils/backlogMatrixParser');

// ── In-memory preview store ──────────────────────────────────────────────
const previewStore = new Map();
const PREVIEW_TTL_MS = 30 * 60 * 1000; // 30 minutes

function storePreview(data) {
  const id = crypto.randomBytes(12).toString('hex');
  const entry = { ...data, createdAt: Date.now() };
  previewStore.set(id, entry);
  // Schedule cleanup
  setTimeout(() => previewStore.delete(id), PREVIEW_TTL_MS);
  return id;
}

function getPreview(id) {
  const entry = previewStore.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > PREVIEW_TTL_MS) {
    previewStore.delete(id);
    return null;
  }
  return entry;
}

// ── FACULTY ROSTER PREVIEW ───────────────────────────────────────────────
const facultyRosterPreview = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const { faculty, warnings } = parseFacultyRoster(req.file.buffer, req.file.originalname);

    // Check which names already exist in the faculty table
    const existingRes = await db.query('SELECT name FROM faculty');
    const existingNames = new Set(existingRes.rows.map(r => r.name.toLowerCase().trim()));

    const newFaculty = [];
    const existingMatches = [];

    for (const name of faculty) {
      if (existingNames.has(name.toLowerCase().trim())) {
        existingMatches.push(name);
      } else {
        newFaculty.push(name);
      }
    }

    const previewId = storePreview({
      type: 'faculty_roster',
      newFaculty,
      existingMatches,
      warnings
    });

    res.json({
      preview_id: previewId,
      new_faculty: newFaculty,
      existing_matches: existingMatches,
      warnings,
      total_extracted: faculty.length
    });
  } catch (err) {
    console.error('Faculty roster preview error:', err);
    res.status(400).json({ error: err.message });
  }
};

// ── SEATING PLAN PREVIEW ─────────────────────────────────────────────────
const seatingPlanPreview = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const academicYear = req.body.academic_year;

    const { blocks, warnings, branch_semester_columns, exam_period_found, start_date, end_date } = parseSeatingPlan(req.file.buffer, req.file.originalname);

    // Match room codes against the rooms table
    const roomsRes = await db.query('SELECT id, room_no FROM rooms');
    const roomMap = {};
    for (const r of roomsRes.rows) {
      roomMap[r.room_no.toLowerCase()] = r.id;
    }

    const blocksToCreate = [];
    const roomsToCreateMap = new Map();

    for (const block of blocks) {
      let roomId = null;
      let matchedRoomNo = block.room_code_raw;

      if (roomMap[block.room_code_raw.toLowerCase()]) {
        roomId = roomMap[block.room_code_raw.toLowerCase()];
        matchedRoomNo = block.room_code_raw;
      } else {
        const lastHyphen = block.room_code_raw.lastIndexOf('-');
        if (lastHyphen > 0) {
          const baseRoom = block.room_code_raw.substring(0, lastHyphen);
          if (roomMap[baseRoom.toLowerCase()]) {
            roomId = roomMap[baseRoom.toLowerCase()];
            matchedRoomNo = baseRoom;
          }
        }
      }

      if (!roomId) {
        if (!roomsToCreateMap.has(block.room_code_raw)) {
           let rtype = null;
           let ppb = 2; // Default 2
           const codeUpper = block.room_code_raw.toUpperCase();
           if (codeUpper.startsWith('LH')) { rtype = 'LH'; ppb = 3; }
           else if (codeUpper.startsWith('CR')) { rtype = 'CR'; ppb = 2; }
           else { warnings.push(`Room "${block.room_code_raw}" does not start with LH or CR. Auto-create will leave room_type null.`); }
           
           roomsToCreateMap.set(block.room_code_raw, {
             room_no: block.room_code_raw,
             building: block.floor,
             capacity: block.desks ? parseInt(block.desks, 10) : 0,
             room_type: rtype,
             people_per_bench: ppb,
             seating_pattern: block.seating
           });
        }
      }

      blocksToCreate.push({
        room_code_raw: block.room_code_raw,
        room_id: roomId,
        matched_room_no: matchedRoomNo,
        branch: block.branch,
        semester: block.semester,
        count: block.count,
        roll_no_start: block.roll_no_start,
        roll_no_end: block.roll_no_end
      });
    }

    const roomsToCreate = Array.from(roomsToCreateMap.values());

    const previewId = storePreview({
      type: 'seating_plan',
      blocksToCreate,
      roomsToCreate,
      warnings,
      academicYear,
      exam_period_found,
      start_date,
      end_date
    });

    res.json({
      preview_id: previewId,
      blocks_to_create: blocksToCreate,
      warnings,
      branch_semester_columns,
      total_blocks: blocksToCreate.length,
      rooms_to_create: roomsToCreate,
      exam_period_found,
      start_date,
      end_date
    });
  } catch (err) {
    console.error('Seating plan preview error:', err);
    res.status(400).json({ error: err.message });
  }
};

// ── BACKLOG MATRIX PREVIEW ───────────────────────────────────────────────
const backlogMatrixPreview = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const academicYear = req.body.academic_year;
    if (!academicYear) return res.status(400).json({ error: 'academic_year is required.' });

    const parsed = parseBacklogMatrix(req.file.buffer, req.file.originalname);

    // Match students against existing table
    const existingStudentsRes = await db.query('SELECT id, roll_no, name, department, semester FROM students');
    const studentByRoll = {};
    for (const s of existingStudentsRes.rows) {
      studentByRoll[s.roll_no.toLowerCase().trim()] = s;
    }

    const studentsToCreate = [];
    const studentsMatched = [];
    const studentRollToStatus = {}; // roll → 'new' | 'existing'

    for (const s of parsed.students) {
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
    }

    // Match subjects against existing table
    const existingSubjectsRes = await db.query('SELECT id, subject_code, subject_name, semester FROM subjects');
    const subjectByName = {};
    const subjectByCode = {};
    for (const sub of existingSubjectsRes.rows) {
      subjectByName[sub.subject_name.toLowerCase().trim()] = sub;
      subjectByCode[sub.subject_code.toLowerCase().trim()] = sub;
    }

    const subjectsToCreate = [];
    const subjectsMatched = [];
    const subjectHeaderToStatus = {}; // header → { status, code, semester }

    for (const sub of parsed.subjects) {
      const headerLower = sub.header.toLowerCase().trim();
      const generatedCode = generateSubjectCode(sub.header);

      if (subjectByName[headerLower]) {
        subjectsMatched.push({
          header: sub.header,
          matched_code: subjectByName[headerLower].subject_code,
          matched_name: subjectByName[headerLower].subject_name,
          semester: sub.semester
        });
        subjectHeaderToStatus[headerLower] = {
          status: 'existing',
          id: subjectByName[headerLower].id
        };
      } else if (subjectByCode[generatedCode.toLowerCase()]) {
        subjectsMatched.push({
          header: sub.header,
          matched_code: subjectByCode[generatedCode.toLowerCase()].subject_code,
          matched_name: subjectByCode[generatedCode.toLowerCase()].subject_name,
          semester: sub.semester
        });
        subjectHeaderToStatus[headerLower] = {
          status: 'existing',
          id: subjectByCode[generatedCode.toLowerCase()].id
        };
      } else {
        subjectsToCreate.push({
          header: sub.header,
          generated_code: generatedCode,
          semester: sub.semester || 0
        });
        subjectHeaderToStatus[headerLower] = {
          status: 'new',
          generatedCode,
          semester: sub.semester || 0
        };
      }
    }

    const previewId = storePreview({
      type: 'backlog_matrix',
      studentsToCreate,
      studentsMatched,
      subjectsToCreate,
      subjectsMatched,
      backlogs: parsed.backlogs,
      warnings: parsed.warnings,
      academicYear,
      studentByRoll,    // for confirm step
      subjectByName,    // for confirm step
      subjectByCode,    // for confirm step
      subjectHeaderToStatus
    });

    res.json({
      preview_id: previewId,
      students_to_create: studentsToCreate,
      students_matched: studentsMatched,
      subjects_to_create: subjectsToCreate,
      subjects_matched: subjectsMatched,
      backlog_papers_to_create: parsed.backlogs.length,
      warnings: parsed.warnings,
      subject_columns_detected: parsed.subjectColumnsDetected,
      semester_markers_found: parsed.semesterMarkersFound
    });
  } catch (err) {
    console.error('Backlog matrix preview error:', err);
    res.status(400).json({ error: err.message });
  }
};

// ── CONFIRM ──────────────────────────────────────────────────────────────
const confirmImport = async (req, res) => {
  const { previewId } = req.params;
  const preview = getPreview(previewId);

  if (!preview) {
    return res.status(404).json({ error: 'Preview not found or expired. Please upload the file again.' });
  }

  const client = await db.query('SELECT 1').then(() => null); // test connection
  // Use a real transaction via pool.connect()
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const txClient = await pool.connect();

  try {
    await txClient.query('BEGIN');

    let result = {};

    if (preview.type === 'faculty_roster') {
      result = await commitFacultyRoster(txClient, preview);
    } else if (preview.type === 'seating_plan') {
      result = await commitSeatingPlan(txClient, preview, req.body);
    } else if (preview.type === 'backlog_matrix') {
      result = await commitBacklogMatrix(txClient, preview);
    } else {
      await txClient.query('ROLLBACK');
      return res.status(400).json({ error: `Unknown preview type: ${preview.type}` });
    }

    await txClient.query('COMMIT');
    previewStore.delete(previewId);

    res.json({ message: 'Import committed successfully', ...result });
  } catch (err) {
    await txClient.query('ROLLBACK');
    console.error('Import commit error:', err);
    res.status(500).json({ error: `Import failed and was rolled back: ${err.message}` });
  } finally {
    txClient.release();
    pool.end();
  }
};

// ── COMMIT HELPERS ───────────────────────────────────────────────────────

async function commitFacultyRoster(client, preview) {
  let inserted = 0;
  for (const name of preview.newFaculty) {
    await client.query(
      `INSERT INTO faculty (name, designation, max_duty_load, is_available)
       VALUES ($1, 'Assistant Professor', 5, true)
       ON CONFLICT DO NOTHING`,
      [name]
    );
    inserted++;
  }
  return { faculty_inserted: inserted, already_existed: preview.existingMatches.length };
}

async function commitSeatingPlan(client, preview, body = {}) {
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
    `INSERT INTO exam_periods (academic_year, start_date, end_date, source)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (academic_year) DO UPDATE SET start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, source = EXCLUDED.source`,
    [academicYear, sDate, eDate, source]
  );

  let roomsInserted = 0;
  const newRoomIds = {};
  
  if (preview.roomsToCreate) {
    for (const r of preview.roomsToCreate) {
      const res = await client.query(
        `INSERT INTO rooms (room_no, building, capacity, room_type, people_per_bench, seating_pattern)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (room_no) DO UPDATE SET room_no = EXCLUDED.room_no
         RETURNING id`,
        [r.room_no, r.building, r.capacity || 0, r.room_type, r.people_per_bench || 2, r.seating_pattern]
      );
      newRoomIds[r.room_no] = res.rows[0].id;
      roomsInserted++;
    }
  }

  let inserted = 0;
  let skipped = 0;
  for (const block of preview.blocksToCreate) {
    const finalRoomId = block.room_id || newRoomIds[block.room_code_raw];
    if (!finalRoomId) {
      skipped++;
      continue;
    }
    await client.query(
      `INSERT INTO seating_blocks (room_id, semester, branch, roll_no_start, roll_no_end, student_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [finalRoomId, block.semester, block.branch, block.roll_no_start, block.roll_no_end, block.count]
    );
    inserted++;
  }
  return { rooms_auto_created: roomsInserted, blocks_inserted: inserted, blocks_skipped_no_room: skipped };
}

async function commitBacklogMatrix(client, preview) {
  const { studentsToCreate, backlogs, subjectsToCreate, academicYear } = preview;

  // 1. Create new students
  const newStudentIds = {}; // roll_no → id
  let studentsInserted = 0;
  for (const s of studentsToCreate) {
    const r = await client.query(
      `INSERT INTO students (roll_no, name, department, semester)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (roll_no) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [s.roll_no, s.name, s.department, s.semester]
    );
    newStudentIds[s.roll_no.toLowerCase().trim()] = r.rows[0].id;
    studentsInserted++;
  }

  // 1b. Backfill existing students if missing dept/sem
  for (const s of preview.studentsMatched) {
    if ((s.department && !s.existing_department) || (s.semester && !s.existing_semester)) {
      await client.query(
        `UPDATE students 
         SET department = COALESCE(department, $1),
             semester = COALESCE(semester, $2)
         WHERE roll_no = $3`,
        [s.department, s.semester, s.roll_no]
      );
    }
  }

  // 2. Create new subjects
  const newSubjectIds = {}; // headerLower → id
  let subjectsInserted = 0;
  for (const sub of subjectsToCreate) {
    // Check if code already exists (race condition safety)
    const existing = await client.query(
      'SELECT id FROM subjects WHERE subject_code = $1',
      [sub.generated_code]
    );
    if (existing.rows.length > 0) {
      newSubjectIds[sub.header.toLowerCase().trim()] = existing.rows[0].id;
    } else {
      const r = await client.query(
        `INSERT INTO subjects (subject_code, subject_name, semester)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [sub.generated_code, sub.header, sub.semester]
      );
      newSubjectIds[sub.header.toLowerCase().trim()] = r.rows[0].id;
      subjectsInserted++;
    }
  }

  // 3. Resolve IDs for existing students and subjects
  // Re-query to get fresh IDs (in case of concurrent changes)
  const allStudentsRes = await client.query('SELECT id, roll_no FROM students');
  const rollToId = {};
  for (const s of allStudentsRes.rows) {
    rollToId[s.roll_no.toLowerCase().trim()] = s.id;
  }

  const allSubjectsRes = await client.query('SELECT id, subject_code, subject_name FROM subjects');
  const subNameToId = {};
  for (const sub of allSubjectsRes.rows) {
    subNameToId[sub.subject_name.toLowerCase().trim()] = sub.id;
  }
  // Also map generated codes
  for (const [headerLower, id] of Object.entries(newSubjectIds)) {
    subNameToId[headerLower] = id;
  }

  // 4. Create backlog_papers
  let backlogsInserted = 0;
  let backlogsSkipped = 0;
  for (const b of backlogs) {
    const studentId = rollToId[b.roll_no.toLowerCase().trim()];
    const subjectId = subNameToId[b.subject_header.toLowerCase().trim()];

    if (!studentId || !subjectId) {
      backlogsSkipped++;
      continue;
    }

    // Check for duplicates
    const dup = await client.query(
      `SELECT id FROM backlog_papers
       WHERE student_id = $1 AND subject_id = $2 AND academic_year = $3`,
      [studentId, subjectId, academicYear]
    );
    if (dup.rows.length > 0) {
      backlogsSkipped++;
      continue;
    }

    await client.query(
      `INSERT INTO backlog_papers (student_id, subject_id, academic_year, status)
       VALUES ($1, $2, $3, 'pending')`,
      [studentId, subjectId, academicYear]
    );
    backlogsInserted++;
  }

  return {
    students_inserted: studentsInserted,
    subjects_inserted: subjectsInserted,
    backlog_papers_inserted: backlogsInserted,
    backlog_papers_skipped_duplicates: backlogsSkipped
  };
}

// ── CANCEL ───────────────────────────────────────────────────────────────
const cancelImport = (req, res) => {
  const { previewId } = req.params;
  const existed = previewStore.delete(previewId);
  res.json({ message: existed ? 'Preview discarded.' : 'Preview not found (may have already expired).' });
};

module.exports = {
  facultyRosterPreview,
  seatingPlanPreview,
  backlogMatrixPreview,
  confirmImport,
  cancelImport
};
