/**
 * Approvals Controller
 * 
 * Manages the approval workflow for both exam schedules and duty assignments.
 * Flow: draft → pending_approval → approved (or back to draft on rejection/unlock)
 * 
 * Roles:
 *   - Editors (staff): Can submit drafts for approval
 *   - Superadmin: Can approve, reject (with reason), or unlock approved items
 * 
 * Endpoints:
 *   POST /api/approvals/submit   — Editor submits draft → pending_approval
 *   GET  /api/approvals/pending  — View all pending_approval items
 *   POST /api/approvals/approve  — Superadmin approves pending items
 *   POST /api/approvals/reject   — Superadmin rejects pending items (with reason)
 *   POST /api/approvals/unlock   — Superadmin unlocks approved items back to draft
 */

const db = require('../db');

/**
 * Resolve the target table name from the type parameter.
 * Only 'schedule' and 'duty' are valid.
 * 
 * @param {string} type - 'schedule' or 'duty'
 * @returns {string|null} The table name, or null if invalid
 */
function resolveTable(type) {
  if (type === 'schedule') return 'exam_schedule';
  if (type === 'main_duty') return 'main_exam_duty';
  if (type === 'regular_duty') return 'regular_exam_duty';
  if (type === 'duty') return 'duties';
  return null;
}

/**
 * POST /api/approvals/submit
 * Body: { type: 'schedule'|'duty', ids: [1,2,3], academic_year: '2026-2027' }
 * 
 * If ids is provided, only those specific rows are submitted.
 * If ids is omitted but academic_year is provided, ALL draft rows
 * for that academic year are submitted.
 * 
 * Only rows currently in 'draft' status are updated.
 */
const submitForApproval = async (req, res) => {
  try {
    const { type, ids, academic_year } = req.body;

    const table = resolveTable(type);
    if (!table) {
      return res.status(400).json({ error: "type must be 'schedule' or 'duty'" });
    }

    let result;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Submit specific rows by ID
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      result = await db.query(
        `UPDATE ${table} SET status = 'pending_approval'
         WHERE id IN (${placeholders}) AND status = 'draft'
         RETURNING id`,
        ids
      );
    } else if (academic_year) {
      // Submit ALL draft rows for the academic year
      if (table === 'exam_schedule' || table === 'regular_exam_duty' || table === 'main_exam_duty') {
        result = await db.query(
          `UPDATE ${table} SET status = 'pending_approval'
           WHERE academic_year = $1 AND status = 'draft'
           RETURNING id`,
          [academic_year]
        );
      } else {
        // For duties, join through exam_schedule to filter by academic year
        result = await db.query(
          `UPDATE duties SET status = 'pending_approval'
           WHERE status = 'draft'
             AND exam_schedule_id IN (
               SELECT id FROM exam_schedule WHERE academic_year = $1
             )
           RETURNING id`,
          [academic_year]
        );
      }
    } else {
      return res.status(400).json({ error: 'Provide either ids array or academic_year' });
    }

    return res.json({
      message: `${result.rows.length} ${type} item(s) submitted for approval`,
      updatedIds: result.rows.map(r => r.id)
    });

  } catch (err) {
    console.error('Error in submitForApproval:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * GET /api/approvals/pending
 * Query: ?type=schedule|duty
 * 
 * Returns all rows with status = 'pending_approval'.
 * For schedules: includes student, subject, room details.
 * For duties: includes faculty, exam schedule, subject details.
 */
const getPending = async (req, res) => {
  try {
    const { type } = req.query;

    if (!type || !resolveTable(type)) {
      return res.status(400).json({ error: "type query param must be 'schedule' or 'duty'" });
    }

    let result;

    if (type === 'schedule') {
      result = await db.query(
        `SELECT es.id, es.exam_date, es.time_slot, es.academic_year,
                es.status, es.is_manual_override,
                es.rejection_notes,
                r.room_no, r.building,
                sub.subject_code, sub.subject_name,
                st.name AS student_name, st.roll_no,
                u.name AS created_by_name
         FROM exam_schedule es
         JOIN rooms r ON es.room_id = r.id
         JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
         JOIN subjects sub ON bp.subject_id = sub.id
         JOIN students st ON bp.student_id = st.id
         LEFT JOIN users u ON es.created_by = u.id
         WHERE es.status = 'pending_approval'
         ORDER BY es.exam_date, es.time_slot`
      );

    } else if (type === 'main_duty') {
      result = await db.query(
        `SELECT m.id, m.exam_date, m.academic_year,
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
         ORDER BY m.exam_date, r.room_no`
      );
    } else if (type === 'regular_duty') {
      result = await db.query(
        `SELECT red.id, red.exam_date, red.time_slot, red.academic_year,
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
         ORDER BY red.exam_date, red.time_slot`
      );
    }

    return res.json({
      items: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error('Error in getPending:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * POST /api/approvals/approve
 * Body: { type: 'schedule'|'duty', ids: [1,2,3] }
 * 
 * Superadmin only. Sets pending_approval → approved.
 * Records the approver's user ID in approved_by.
 * Clears any previous rejection_notes.
 */
const approve = async (req, res) => {
  try {
    const { type, ids } = req.body;

    const table = resolveTable(type);
    if (!table) {
      return res.status(400).json({ error: "type must be 'schedule' or 'duty'" });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query(
      `UPDATE ${table}
       SET status = 'approved',
           approved_by = $${ids.length + 1},
           rejection_notes = NULL
       WHERE id IN (${placeholders}) AND status = 'pending_approval'
       RETURNING id`,
      [...ids, req.user.id]
    );

    return res.json({
      message: `${result.rows.length} ${type} item(s) approved`,
      approvedIds: result.rows.map(r => r.id)
    });

  } catch (err) {
    console.error('Error in approve:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * POST /api/approvals/reject
 * Body: { type: 'schedule'|'duty', ids: [1,2,3], reason: 'Please fix room assignment' }
 * 
 * Superadmin only. Sets pending_approval → draft (back to editable).
 * Records the rejection reason in rejection_notes.
 * The editor will see this reason and can make changes before resubmitting.
 */
const reject = async (req, res) => {
  try {
    const { type, ids, reason } = req.body;

    const table = resolveTable(type);
    if (!table) {
      return res.status(400).json({ error: "type must be 'schedule' or 'duty'" });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query(
      `UPDATE ${table}
       SET status = 'draft',
           rejection_notes = $${ids.length + 1},
           approved_by = NULL
       WHERE id IN (${placeholders}) AND status = 'pending_approval'
       RETURNING id`,
      [...ids, reason.trim()]
    );

    return res.json({
      message: `${result.rows.length} ${type} item(s) rejected`,
      rejectedIds: result.rows.map(r => r.id)
    });

  } catch (err) {
    console.error('Error in reject:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

/**
 * POST /api/approvals/unlock
 * Body: { type: 'schedule'|'duty', ids: [1,2,3] }
 * 
 * Superadmin only. Sets approved → draft.
 * This allows the editor to make further changes to previously approved items.
 * Clears approved_by.
 */
const unlock = async (req, res) => {
  try {
    const { type, ids } = req.body;

    const table = resolveTable(type);
    if (!table) {
      return res.status(400).json({ error: "type must be 'schedule' or 'duty'" });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required and must not be empty' });
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query(
      `UPDATE ${table}
       SET status = 'draft',
           approved_by = NULL
       WHERE id IN (${placeholders}) AND status = 'approved'
       RETURNING id`,
      ids
    );

    return res.json({
      message: `${result.rows.length} ${type} item(s) unlocked back to draft`,
      unlockedIds: result.rows.map(r => r.id)
    });

  } catch (err) {
    console.error('Error in unlock:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

module.exports = { submitForApproval, getPending, approve, reject, unlock };
