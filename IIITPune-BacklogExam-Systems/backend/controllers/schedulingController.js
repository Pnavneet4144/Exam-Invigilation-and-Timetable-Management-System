const { generatePDF, generateExcel } = require('../utils/exportGenerator');
/**
 * ============================================================================
 * Scheduling Controller (Phase 2)
 * ============================================================================
 * 
 * Handles all scheduling-related API operations:
 * 1. suggestPacing: calculates and upserts suggested papers_per_day (1 or 2)
 * 2. updatePacing: allows manual override of a student's pacing
 * 3. generateSchedule: runs pure schedulingEngine and saves draft exam_schedule
 * 4. previewSchedule: returns generated schedule grouped by date
 * 5. updateExam: manual override of an individual exam's date/slot/room with conflict checking
 */

const db = require('../db');
const { generateSchedule } = require('../utils/schedulingEngine');

/**
 * POST /api/scheduling/suggest-pacing
 * Body: { academic_year: '2026-2027' }
 * 
 * Logic:
 * - Finds all students who have pending backlog papers for the academic_year.
 * - Counts pending papers per student.
 * - If backlog count > 15, suggested pacing = 2, otherwise 1.
 * - Upserts into student_pacing table:
 *   If a row already has is_manual_override = true, keeps the existing papers_per_day.
 *   Otherwise updates or inserts the suggested value.
 * - Returns the list of students, pending count, papers_per_day, and is_manual_override.
 */
const suggestPacing = async (req, res) => {
  try {
    const { academic_year } = req.body;
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year is required' });
    }

    // 1. Query students with pending backlog papers count for this academic_year
    const studentBacklogQuery = `
      SELECT 
        s.id AS student_id,
        s.roll_no,
        s.name,
        s.department,
        COUNT(bp.id)::int AS pending_count
      FROM students s
      JOIN backlog_papers bp ON bp.student_id = s.id
      WHERE bp.academic_year = $1 AND bp.status = 'pending'
      GROUP BY s.id, s.roll_no, s.name, s.department
      ORDER BY pending_count DESC, s.roll_no ASC
    `;
    const backlogRes = await db.query(studentBacklogQuery, [academic_year]);
    const studentsWithBacklogs = backlogRes.rows;

    if (studentsWithBacklogs.length === 0) {
      return res.json({
        message: 'No pending backlog papers found for this academic year.',
        students: []
      });
    }

    // 2. Fetch existing student_pacing records for this academic_year
    const pacingQuery = `
      SELECT student_id, papers_per_day, is_manual_override
      FROM student_pacing
      WHERE academic_year = $1
    `;
    const pacingRes = await db.query(pacingQuery, [academic_year]);
    const existingPacingMap = {};
    for (const row of pacingRes.rows) {
      existingPacingMap[row.student_id] = row;
    }

    // 3. Calculate suggested pacing and upsert into student_pacing
    const resultList = [];
    for (const student of studentsWithBacklogs) {
      const existing = existingPacingMap[student.student_id];
      const suggested = student.pending_count > 15 ? 2 : 1;
      
      let finalPapersPerDay = suggested;
      let isManual = false;

      if (existing) {
        if (existing.is_manual_override) {
          finalPapersPerDay = existing.papers_per_day;
          isManual = true;
        } else {
          // Update to newly suggested value
          await db.query(
            `UPDATE student_pacing 
             SET papers_per_day = $1 
             WHERE student_id = $2 AND academic_year = $3`,
            [suggested, student.student_id, academic_year]
          );
        }
      } else {
        // Insert new pacing suggestion
        await db.query(
          `INSERT INTO student_pacing (student_id, academic_year, papers_per_day, is_manual_override)
           VALUES ($1, $2, $3, false)`,
          [student.student_id, academic_year, suggested]
        );
      }

      resultList.push({
        student_id: student.student_id,
        roll_no: student.roll_no,
        name: student.name,
        department: student.department,
        pending_count: student.pending_count,
        papers_per_day: finalPapersPerDay,
        is_manual_override: isManual
      });
    }

    return res.json({
      academic_year,
      total_students: resultList.length,
      students: resultList
    });
  } catch (err) {
    console.error('Error in suggestPacing:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * PUT /api/scheduling/pacing/:studentId
 * Body: { academic_year: '2026-2027', papers_per_day: 2 }
 * 
 * Logic:
 * - Upserts student_pacing with is_manual_override = true.
 */
const updatePacing = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const { academic_year, papers_per_day } = req.body;

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ error: 'Valid studentId param is required' });
    }
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year is required' });
    }
    const pacingVal = parseInt(papers_per_day, 10);
    if (!pacingVal || pacingVal < 1 || pacingVal > 10) {
      return res.status(400).json({ error: 'papers_per_day must be an integer between 1 and 10' });
    }

    const upsertQuery = `
      INSERT INTO student_pacing (student_id, academic_year, papers_per_day, is_manual_override)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (student_id, academic_year)
      DO UPDATE SET papers_per_day = EXCLUDED.papers_per_day, is_manual_override = true
      RETURNING *
    `;
    const result = await db.query(upsertQuery, [studentId, academic_year, pacingVal]);

    return res.json({
      message: 'Student pacing updated successfully',
      pacing: result.rows[0]
    });
  } catch (err) {
    console.error('Error in updatePacing:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * POST /api/scheduling/generate
 * Body: { academic_year: '2026-2027', start_date: '2026-10-01' }
 * 
 * Logic:
 * 1. Fetch pending backlog papers for academic_year.
 * 2. Fetch students, student_pacing, rooms, and holidays.
 * 3. Call generateSchedule() pure function.
 * 4. Idempotently remove existing 'draft' schedules for this academic_year (leave 'approved' intact).
 * 5. Insert new scheduled records with status = 'draft'.
 */
const generate = async (req, res) => {
  try {
    const { academic_year, start_date } = req.body;
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year is required' });
    }

    // Default start_date: tomorrow
    let examStartDate = start_date;
    if (!examStartDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      examStartDate = tomorrow.toISOString().split('T')[0];
    }

    // 1. Fetch pending backlog papers that do not already have an approved schedule
    const papersRes = await db.query(
      `SELECT bp.id, bp.student_id, bp.subject_id, bp.academic_year 
       FROM backlog_papers bp
       WHERE bp.academic_year = $1 
         AND bp.status = 'pending'
         AND bp.id NOT IN (
           SELECT backlog_paper_id 
           FROM exam_schedule 
           WHERE status = 'approved' AND backlog_paper_id IS NOT NULL
         )`,
      [academic_year]
    );
    const backlogPapers = papersRes.rows;

    if (backlogPapers.length === 0) {
      return res.status(400).json({
        error: `No unapproved pending backlog papers found for academic year ${academic_year}.`
      });
    }

    // 2. Fetch students
    const studentsRes = await db.query(
      `SELECT DISTINCT s.id, s.roll_no, s.name 
       FROM students s 
       JOIN backlog_papers bp ON bp.student_id = s.id 
       WHERE bp.academic_year = $1 AND bp.status = 'pending'`,
      [academic_year]
    );
    const students = studentsRes.rows;

    // 3. Fetch student_pacing
    const pacingRes = await db.query(
      `SELECT student_id, academic_year, papers_per_day, is_manual_override 
       FROM student_pacing 
       WHERE academic_year = $1`,
      [academic_year]
    );
    const studentPacing = pacingRes.rows;

    // 4. Fetch rooms
    const roomsRes = await db.query(
      `SELECT id, room_no, building, capacity, room_type, people_per_bench 
       FROM rooms 
       ORDER BY capacity DESC`
    );
    const rooms = roomsRes.rows;

    if (rooms.length === 0) {
      return res.status(400).json({
        error: 'No rooms configured in the system. Please upload room data first.'
      });
    }

    // 5. Fetch holidays
    const holidaysRes = await db.query(`SELECT holiday_date::text AS holiday_date FROM holidays`);
    const holidays = holidaysRes.rows.map(h => typeof h.holiday_date === 'string' ? h.holiday_date : h.holiday_date.toISOString().split('T')[0]);

    // 5.5 Fetch time slots for backlog exams
    const timeSlotsRes = await db.query(
      `SELECT start_time, end_time FROM exam_time_slots WHERE academic_year = $1 AND exam_type = 'backlog' ORDER BY start_time`,
      [academic_year]
    );
    const timeSlots = timeSlotsRes.rows.map(r => `${r.start_time.substring(0,5)}-${r.end_time.substring(0,5)}`);
    
    if (timeSlots.length === 0) {
      return res.status(400).json({
        error: `No time slots configured for backlog exams in academic year ${academic_year}. Please configure time slots first.`
      });
    }

    // 6. Run pure scheduling engine
    const scheduleOutput = generateSchedule(
      backlogPapers,
      students,
      studentPacing,
      rooms,
      holidays,
      examStartDate,
      timeSlots
    );

    const { scheduled, unscheduled, summary } = scheduleOutput;

    // 7. DB Transaction: Clear previous draft entries for this academic_year, then insert new ones
    await db.query('BEGIN');
    try {
      // Delete draft records for this academic_year (don't touch approved)
      await db.query(
        `DELETE FROM exam_schedule 
         WHERE academic_year = $1 AND status = 'draft'`,
        [academic_year]
      );

      // Insert new scheduled rows
      const createdBy = req.user ? req.user.id : null;
      for (const item of scheduled) {
        await db.query(
          `INSERT INTO exam_schedule (
             backlog_paper_id, room_id, exam_date, time_slot, academic_year,
             is_manual_override, status, created_by
           ) VALUES ($1, $2, $3, $4, $5, false, 'draft', $6)`,
          [
            item.backlog_paper_id,
            item.room_id,
            item.exam_date,
            item.time_slot,
            academic_year,
            createdBy
          ]
        );
      }

      await db.query('COMMIT');
    } catch (txErr) {
      await db.query('ROLLBACK');
      throw txErr;
    }

    return res.json({
      message: 'Draft exam schedule generated successfully',
      academic_year,
      summary,
      unscheduled_count: unscheduled.length,
      unscheduled
    });

  } catch (err) {
    console.error('Error in generateSchedule:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * GET /api/scheduling/preview?academic_year=X
 * 
 * Logic:
 * - Retrieves all exam_schedule rows for academic_year with student, subject, room info.
 * - Groups entries by exam_date for calendar/table viewing.
 */
const previewSchedule = async (req, res) => {
  try {
    const { academic_year } = req.query;
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year query parameter is required' });
    }

    const scheduleQuery = `
      SELECT 
        es.id AS exam_schedule_id,
        es.exam_date,
        es.time_slot,
        es.academic_year,
        es.is_manual_override,
        es.status,
        es.rejection_notes,
        r.id AS room_id,
        r.room_no,
        r.building,
        r.capacity AS room_capacity,
        st.id AS student_id,
        st.roll_no,
        st.name AS student_name,
        st.department AS student_dept,
        sub.id AS subject_id,
        sub.subject_code,
        sub.subject_name,
        sub.semester AS subject_semester
      FROM exam_schedule es
      JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
      JOIN students st ON bp.student_id = st.id
      JOIN subjects sub ON bp.subject_id = sub.id
      JOIN rooms r ON es.room_id = r.id
      WHERE es.academic_year = $1
      ORDER BY es.exam_date ASC, es.time_slot ASC, r.room_no ASC, st.roll_no ASC
    `;
    const result = await db.query(scheduleQuery, [academic_year]);

    // Group items by date
    const groupedByDate = {};
    for (const row of result.rows) {
      const dateStr = typeof row.exam_date === 'string' ? row.exam_date : new Date(row.exam_date).toISOString().split('T')[0];
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = [];
      }
      groupedByDate[dateStr].push({
        ...row,
        exam_date: dateStr
      });
    }

    return res.json({
      academic_year,
      total_exams: result.rows.length,
      dates_count: Object.keys(groupedByDate).length,
      grouped_schedule: groupedByDate,
      flat_schedule: result.rows.map(r => ({
        ...r,
        exam_date: typeof r.exam_date === 'string' ? r.exam_date : new Date(r.exam_date).toISOString().split('T')[0]
      }))
    });
  } catch (err) {
    console.error('Error in previewSchedule:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * PUT /api/scheduling/exam/:examScheduleId
 * Body: { exam_date: 'YYYY-MM-DD', time_slot: '09:00-12:00', room_id: 1 }
 * 
 * Logic:
 * - Validates exam exists and belongs to a draft (or allowed status).
 * - Validates input date, time_slot, room_id.
 * - Checks conflict 1: Student cannot have another exam in the exact same date + time_slot.
 * - Checks conflict 2: Room cannot exceed capacity on that date + time_slot.
 * - Updates exam_schedule and sets is_manual_override = true.
 */
const updateExam = async (req, res) => {
  try {
    const examScheduleId = parseInt(req.params.examScheduleId, 10);
    const { exam_date, time_slot, room_id } = req.body;

    if (!examScheduleId || isNaN(examScheduleId)) {
      return res.status(400).json({ error: 'Valid examScheduleId is required' });
    }
    if (!exam_date || !time_slot || !room_id) {
      return res.status(400).json({ error: 'exam_date, time_slot, and room_id are required' });
    }

    // 1. Fetch the target exam schedule
    const examRes = await db.query(
      `SELECT es.id, es.backlog_paper_id, es.academic_year, es.status,
              bp.student_id, st.name AS student_name, st.roll_no
       FROM exam_schedule es
       JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
       JOIN students st ON bp.student_id = st.id
       WHERE es.id = $1`,
      [examScheduleId]
    );

    if (examRes.rows.length === 0) {
      return res.status(404).json({ error: 'Exam schedule entry not found' });
    }

    const currentExam = examRes.rows[0];

    // Reject edits to approved exam schedules
    if (currentExam.status === 'approved') {
      return res.status(403).json({ error: 'Cannot edit approved exam schedules. Request unlock from the superadmin first.' });
    }

    // 2. Fetch room details to check capacity
    const roomRes = await db.query(`SELECT id, room_no, capacity FROM rooms WHERE id = $1`, [room_id]);
    if (roomRes.rows.length === 0) {
      return res.status(404).json({ error: `Room with ID ${room_id} not found` });
    }
    const targetRoom = roomRes.rows[0];

    // 3. Conflict check 1: Does this student have another exam in the same date and time slot?
    const studentConflictRes = await db.query(
      `SELECT es.id, sub.subject_code, sub.subject_name
       FROM exam_schedule es
       JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
       JOIN subjects sub ON bp.subject_id = sub.id
       WHERE bp.student_id = $1
         AND es.exam_date = $2
         AND es.time_slot = $3
         AND es.id != $4`,
      [currentExam.student_id, exam_date, time_slot, examScheduleId]
    );

    if (studentConflictRes.rows.length > 0) {
      const conflict = studentConflictRes.rows[0];
      return res.status(409).json({
        error: `Student conflict: ${currentExam.student_name} (${currentExam.roll_no}) is already scheduled for subject ${conflict.subject_code} (${conflict.subject_name}) on ${exam_date} during ${time_slot}.`
      });
    }

    // 4. Conflict check 2: Is the room capacity exceeded for this date and time slot?
    const roomOccupancyRes = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM exam_schedule
       WHERE room_id = $1
         AND exam_date = $2
         AND time_slot = $3
         AND id != $4`,
      [room_id, exam_date, time_slot, examScheduleId]
    );

    const currentRoomCount = roomOccupancyRes.rows[0].count;
    if (currentRoomCount >= targetRoom.capacity) {
      return res.status(409).json({
        error: `Room capacity exceeded: Room ${targetRoom.room_no} has a capacity of ${targetRoom.capacity}, but already has ${currentRoomCount} exams scheduled on ${exam_date} in slot ${time_slot}.`
      });
    }

    // 5. Update the exam_schedule record
    const updateRes = await db.query(
      `UPDATE exam_schedule
       SET exam_date = $1, time_slot = $2, room_id = $3, is_manual_override = true
       WHERE id = $4
       RETURNING *`,
      [exam_date, time_slot, room_id, examScheduleId]
    );

    return res.json({
      message: 'Exam schedule updated successfully with manual override',
      exam: updateRes.rows[0]
    });

  } catch (err) {
    console.error('Error in updateExam:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};


const exportPDF = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const data = await module.exports.preview(req, mockRes);
    const title = `Backlog Exam Schedule - ${academic_year}`;
    const cols = ['Date', 'Time Slot', 'Room', 'Subject', 'Student'];
    const rows = [];
    if(data && typeof data === 'object') {
      Object.values(data).forEach(day => {
        if(Array.isArray(day)) {
          day.forEach(s => {
            rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, `${s.room_no} (${s.building})`, `${s.subject_code} - ${s.subject_name}`, `${s.student_name} (${s.roll_no})`]);
          });
        }
      });
    }
    const buffer = await generatePDF(title, cols, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="schedule_${academic_year}.pdf"`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};

const exportExcel = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const data = await module.exports.preview(req, mockRes);
    const cols = ['Date', 'Time Slot', 'Room', 'Subject Code', 'Subject Name', 'Student Name', 'Roll No'];
    const rows = [];
    if(data && typeof data === 'object') {
      Object.values(data).flat().forEach(s => {
        rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, s.room_no, s.subject_code, s.subject_name, s.student_name, s.roll_no]);
      });
    }
    const buffer = await generateExcel('Schedule', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="schedule_${academic_year}.xlsx"`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};

module.exports = {
  suggestPacing,
  updatePacing,
  generate,
  previewSchedule,
  updateExam
, exportPDF, exportExcel};

// --- Time Slots API ---

const getTimeSlots = async (req, res) => {
  try {
    const { academic_year, exam_type } = req.query;
    if (!academic_year || !exam_type) return res.status(400).json({ error: 'Missing academic_year or exam_type' });
    const result = await db.query(
      `SELECT * FROM exam_time_slots WHERE academic_year = $1 AND exam_type = $2 ORDER BY start_time`,
      [academic_year, exam_type]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
};

const addTimeSlot = async (req, res) => {
  try {
    const { academic_year, exam_type, slot_label, start_time, end_time } = req.body;
    if (!academic_year || !exam_type || !slot_label || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = await db.query(
      `INSERT INTO exam_time_slots (academic_year, exam_type, slot_label, start_time, end_time) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [academic_year, exam_type, slot_label, start_time, end_time]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add time slot' });
  }
};

const deleteTimeSlot = async (req, res) => {
  try {
    await db.query(`DELETE FROM exam_time_slots WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete time slot' });
  }
};

module.exports = { ...module.exports, getTimeSlots, addTimeSlot, deleteTimeSlot };
