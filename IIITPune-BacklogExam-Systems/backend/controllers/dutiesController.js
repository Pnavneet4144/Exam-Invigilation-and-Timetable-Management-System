const { generatePDF, generateExcel } = require('../utils/exportGenerator');
/**
 * Duties Controller
 * 
 * Handles faculty invigilation duty allocation for backlog exams.
 * Uses the dutyAllocationEngine (pure function) for auto-assignment,
 * then persists results to the duties table.
 * 
 * Endpoints:
 *   POST /api/duties/generate  — Auto-assign faculty to exam slots
 *   GET  /api/duties/preview   — View all duty assignments
 *   PUT  /api/duties/:dutyId   — Manually reassign a duty
 */

const db = require('../db');
const { allocateDuties } = require('../utils/dutyAllocationEngine');

/**
 * POST /api/duties/generate
 * Body: { academic_year: '2026-2027' }
 * 
 * Generates duty assignments for all draft exam_schedule rows that
 * don't already have a duty assigned. Calls the allocation engine
 * and inserts results into the duties table.
 * 
 * Idempotent: Re-running will only assign duties to NEW unassigned slots.
 * Approved duties are never overwritten.
 */
const generateDuties = async (req, res) => {
  try {
    const { academic_year } = req.body;

    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year is required' });
    }

    // 1. Fetch all exam_schedule rows for this academic year that don't
    //    already have a duty assigned (avoid duplicates on re-generation)
    const examRes = await db.query(
      `SELECT es.id, es.exam_date, es.time_slot, es.room_id,
              sub.subject_code, sub.subject_name
       FROM exam_schedule es
       JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
       JOIN subjects sub ON bp.subject_id = sub.id
       WHERE es.academic_year = $1
         AND es.id NOT IN (SELECT exam_schedule_id FROM duties WHERE exam_schedule_id IS NOT NULL)
       ORDER BY es.exam_date, es.time_slot`,
      [academic_year]
    );

    const examSlots = examRes.rows;

    if (examSlots.length === 0) {
      return res.json({
        message: 'No unassigned exam slots found for this academic year',
        assigned: 0,
        warnings: []
      });
    }

    // 2. Fetch all faculty
    const facultyRes = await db.query(
      `SELECT id, name, department, designation, max_duty_load, is_available
       FROM faculty
       ORDER BY id`
    );

    const faculty = facultyRes.rows;

    if (faculty.length === 0) {
      return res.status(400).json({
        error: 'No faculty found in the database. Please upload faculty data first.',
        warnings: examSlots.map(s => ({
          exam_schedule_id: s.id,
          exam_date: s.exam_date,
          time_slot: s.time_slot,
          reason: 'No faculty in database'
        }))
      });
    }

    // 3. Fetch existing duties (to track current load and bookings)
    //    We join with exam_schedule to get date and time_slot for booking checks
    const existingDutiesRes = await db.query(
      `SELECT d.faculty_id, es.exam_date, es.time_slot
       FROM duties d
       JOIN exam_schedule es ON d.exam_schedule_id = es.id`
    );

    const existingDuties = existingDutiesRes.rows;

    // 4. Run the allocation engine (pure function — no side effects)
    const { assignments, warnings } = allocateDuties({
      examSlots,
      faculty,
      existingDuties
    });

    // 5. Insert assignments into the duties table
    let insertedCount = 0;
    for (const assignment of assignments) {
      await db.query(
        `INSERT INTO duties (faculty_id, exam_schedule_id, is_manual_override, status, created_by)
         VALUES ($1, $2, false, 'draft', $3)`,
        [assignment.faculty_id, assignment.exam_schedule_id, req.user.id]
      );
      insertedCount++;
    }

    return res.json({
      message: `Duty allocation complete for ${academic_year}`,
      assigned: insertedCount,
      total_slots: examSlots.length,
      unassigned: warnings.length,
      warnings
    });

  } catch (err) {
    console.error('Error in generateDuties:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * GET /api/duties/preview
 * Query: ?academic_year=2026-2027
 * 
 * Returns all duty assignments for the given academic year,
 * joined with faculty and exam schedule details.
 * Grouped by date for the frontend table display.
 */
const previewDuties = async (req, res) => {
  try {
    const { academic_year } = req.query;

    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year query param is required' });
    }

    const result = await db.query(
      `SELECT d.id AS duty_id,
              d.faculty_id,
              d.is_manual_override,
              d.status AS duty_status,
              d.rejection_notes AS duty_rejection_notes,
              f.name AS faculty_name,
              f.designation AS faculty_designation,
              f.department AS faculty_department,
              es.id AS exam_schedule_id,
              es.exam_date,
              es.time_slot,
              es.status AS schedule_status,
              r.room_no,
              r.building,
              sub.subject_code,
              sub.subject_name,
              st.name AS student_name,
              st.roll_no
       FROM duties d
       JOIN faculty f ON d.faculty_id = f.id
       JOIN exam_schedule es ON d.exam_schedule_id = es.id
       JOIN rooms r ON es.room_id = r.id
       JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
       JOIN subjects sub ON bp.subject_id = sub.id
       JOIN students st ON bp.student_id = st.id
       WHERE es.academic_year = $1
       ORDER BY es.exam_date, es.time_slot, r.room_no`,
      [academic_year]
    );

    // Group by date for frontend display
    const groupedByDate = {};
    for (const row of result.rows) {
      const date = row.exam_date;
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(row);
    }

    // Also fetch any exam slots that have NO duty assigned (for warnings display)
    const unassignedRes = await db.query(
      `SELECT es.id, es.exam_date, es.time_slot, r.room_no,
              sub.subject_code, sub.subject_name
       FROM exam_schedule es
       JOIN rooms r ON es.room_id = r.id
       JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
       JOIN subjects sub ON bp.subject_id = sub.id
       WHERE es.academic_year = $1
         AND es.id NOT IN (SELECT exam_schedule_id FROM duties WHERE exam_schedule_id IS NOT NULL)
       ORDER BY es.exam_date, es.time_slot`,
      [academic_year]
    );

    // Fetch available faculty for the edit modal dropdown
    const facultyRes = await db.query(
      `SELECT id, name, designation, department, max_duty_load, is_available
       FROM faculty
       ORDER BY name`
    );

    return res.json({
      duties: groupedByDate,
      totalDuties: result.rows.length,
      unassignedSlots: unassignedRes.rows,
      faculty: facultyRes.rows
    });

  } catch (err) {
    console.error('Error in previewDuties:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * PUT /api/duties/:dutyId
 * Body: { faculty_id: 5 }
 * 
 * Manually reassign a duty to a different faculty member.
 * Validates:
 *   - Duty exists and is not approved (403 if approved)
 *   - New faculty exists, is available, and hasn't hit max_duty_load
 *   - New faculty isn't double-booked on the same date+time_slot
 * Sets is_manual_override = true on the updated duty.
 */
const updateDuty = async (req, res) => {
  try {
    const dutyId = parseInt(req.params.dutyId, 10);
    const new_faculty_id = parseInt(req.body.faculty_id, 10);

    if (!dutyId || isNaN(dutyId)) {
      return res.status(400).json({ error: 'Valid dutyId is required' });
    }
    if (!new_faculty_id || isNaN(new_faculty_id)) {
      return res.status(400).json({ error: 'Valid integer faculty_id is required' });
    }

    // 1. Fetch the duty and its linked exam schedule
    const dutyRes = await db.query(
      `SELECT d.id, d.faculty_id, d.status, d.exam_schedule_id, es.room_id,
              es.exam_date, es.time_slot, es.academic_year
       FROM duties d
       JOIN exam_schedule es ON d.exam_schedule_id = es.id
       WHERE d.id = $1`,
      [dutyId]
    );

    if (dutyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Duty not found' });
    }

    const duty = dutyRes.rows[0];

    // 2. Reject edits to approved duties
    if (duty.status === 'approved') {
      return res.status(403).json({ error: 'Cannot edit approved duty assignments. Request unlock from the superadmin first.' });
    }

    // 3. Fetch the new faculty
    const facultyRes = await db.query(
      `SELECT id, name, designation, max_duty_load, is_available
       FROM faculty WHERE id = $1`,
      [new_faculty_id]
    );

    if (facultyRes.rows.length === 0) {
      return res.status(404).json({ error: `Faculty with ID ${new_faculty_id} not found` });
    }

    const newFaculty = facultyRes.rows[0];

    // 4. Check availability
    if (!newFaculty.is_available) {
      return res.status(400).json({ error: `Faculty ${newFaculty.name} is currently marked as unavailable` });
    }

    // 5. Check max_duty_load (count distinct room_id/date/slot groups they are assigned to)
    const loadRes = await db.query(
      `SELECT COUNT(DISTINCT (es.room_id, es.exam_date, es.time_slot))::int AS count 
       FROM duties d 
       JOIN exam_schedule es ON d.exam_schedule_id = es.id 
       WHERE d.faculty_id = $1 AND d.faculty_id != $2`,
      [new_faculty_id, duty.faculty_id]
    );
    if (loadRes.rows[0].count >= newFaculty.max_duty_load) {
      return res.status(400).json({
        error: `Faculty ${newFaculty.name} is already at max duty load (${newFaculty.max_duty_load})`
      });
    }

    // 6. Check double-booking on same date + time_slot (but different room)
    const conflictRes = await db.query(
      `SELECT d.id FROM duties d
       JOIN exam_schedule es ON d.exam_schedule_id = es.id
       WHERE d.faculty_id = $1
         AND es.exam_date = $2
         AND es.time_slot = $3
         AND es.room_id != $4`,
      [new_faculty_id, duty.exam_date, duty.time_slot, duty.room_id]
    );

    if (conflictRes.rows.length > 0) {
      return res.status(409).json({
        error: `Faculty ${newFaculty.name} is already assigned to another duty on ${duty.exam_date} during ${duty.time_slot}`
      });
    }

    // 7. Update the duty (and all others in the same group assigned to the old faculty)
    const updateRes = await db.query(
      `UPDATE duties 
       SET faculty_id = $1, is_manual_override = true 
       WHERE faculty_id = $2 AND exam_schedule_id IN (
         SELECT id FROM exam_schedule 
         WHERE room_id = $3 AND exam_date = $4 AND time_slot = $5 AND academic_year = $6
       ) RETURNING *`,
      [new_faculty_id, duty.faculty_id, duty.room_id, duty.exam_date, duty.time_slot, duty.academic_year]
    );

    return res.json({
      message: 'Duty reassigned successfully with manual override',
      duty: updateRes.rows[0]
    });

  } catch (err) {
    console.error('Error in updateDuty:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};


const exportPDF = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const payload = await module.exports.previewDuties(req, mockRes);
    const data = payload?.duties || {};
    const title = `Duty Allocation - ${academic_year}`;
    const cols = ['Date', 'Time Slot', 'Room', 'Faculty'];
    const rows = [];
    if(data && typeof data === 'object') {
      Object.values(data).flat().forEach(s => {
        rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, s.room_no, s.faculty_name || 'Unassigned']);
      });
    }
    const buffer = await generatePDF(title, cols, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="duties_${academic_year}.pdf"`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};

const exportExcel = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const payload = await module.exports.previewDuties(req, mockRes);
    const data = payload?.duties || {};
    const cols = ['Date', 'Time Slot', 'Room', 'Faculty Name', 'Designation'];
    const rows = [];
    if(data && typeof data === 'object') {
      Object.values(data).flat().forEach(s => {
        rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, s.room_no, s.faculty_name || 'Unassigned', s.faculty_designation || '']);
      });
    }
    const buffer = await generateExcel('Duties', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="duties_${academic_year}.xlsx"`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};

module.exports = { generateDuties, previewDuties, updateDuty , exportPDF, exportExcel};
