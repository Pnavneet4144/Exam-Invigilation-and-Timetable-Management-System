const db = require('../db');
const { generateMainExamDuties } = require('../utils/mainExamDutyEngine');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');

// Generate working dates between start and end date excluding weekends and holidays
async function getWorkingDates(startDateStr, endDateStr) {
  const dates = [];
  let curr = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  const holidaysRes = await db.query('SELECT holiday_date FROM holidays');
  const holidaySet = new Set(holidaysRes.rows.map(r => r.holiday_date.toISOString().split('T')[0]));

  while (curr <= end) {
    const day = curr.getDay();
    const dateStr = curr.toISOString().split('T')[0];
    // Skip Sat(6) and Sun(0) and holidays
    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
      dates.push(dateStr);
    }
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

exports.generate = async (req, res) => {
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

    const workingDates = await getWorkingDates(start_date, end_date);
    if (workingDates.length === 0) {
      return res.status(400).json({ error: 'No working dates found in the given range.' });
    }

    // Get rooms that are used in seating_blocks for this academic_year
    const roomsRes = await db.query(`
      SELECT DISTINCT r.id, r.room_no
      FROM rooms r
      JOIN seating_blocks sb ON r.id = sb.room_id
      WHERE sb.academic_year = $1 OR sb.academic_year IS NULL
      ORDER BY r.room_no
    `, [academic_year]);
    const rooms = roomsRes.rows;

    if (rooms.length === 0) {
      return res.status(400).json({ error: 'No rooms found in seating plan for allocation.' });
    }

    const facultyRes = await db.query(`SELECT id, name, is_available FROM faculty WHERE is_available = TRUE`);
    const facultyList = facultyRes.rows;

    if (facultyList.length === 0) {
      return res.status(400).json({ error: 'No available faculty found.' });
    }

    // Run engine
    const { assignments, warnings, facultyStats } = generateMainExamDuties(rooms, workingDates, facultyList);

    // Commit to DB
    const client = await db.query('BEGIN');
    try {
      await db.query(`DELETE FROM main_exam_duty WHERE academic_year = $1 AND status = 'draft'`, [academic_year]);

      let inserted = 0;
      for (const a of assignments) {
        await db.query(
          `INSERT INTO main_exam_duty (room_id, exam_date, faculty_id, academic_year, status)
           VALUES ($1, $2, $3, $4, 'draft')`,
          [a.room_id, a.exam_date, a.faculty_id, academic_year]
        );
        inserted++;
      }
      await db.query('COMMIT');

      // Check rotation quality: sum of repeated assignments per room
      let repeatCount = 0;
      for (const f of Object.values(facultyStats)) {
        for (const history of Object.values(f.roomHistory)) {
          if (history.length > 1) {
            repeatCount += (history.length - 1);
          }
        }
      }

      res.json({
        message: 'Main exam duties generated successfully',
        assigned: inserted,
        warnings,
        rotation_repeats: repeatCount,
        exam_date_range: { start_date, end_date }
      });
    } catch (e) {
      await db.query('ROLLBACK');
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getPreview = async (req, res) => {
  try {
    const { academic_year } = req.query;
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year is required' });
    }

    const result = await db.query(`
      SELECT m.id, m.exam_date, m.is_manual_override, m.status,
             r.id AS room_id, r.room_no,
             f.id AS faculty_id, f.name AS faculty_name, f.department AS faculty_department
      FROM main_exam_duty m
      JOIN rooms r ON m.room_id = r.id
      LEFT JOIN faculty f ON m.faculty_id = f.id
      WHERE m.academic_year = $1
      ORDER BY m.exam_date, r.room_no
    `, [academic_year]);

    // Group by date for easier frontend rendering
    const dutiesByDate = {};
    for (const row of result.rows) {
      // Postgres returns DATE objects or strings depending on pg setup. We use IST string formatting
      const dateStr = typeof row.exam_date === 'string' ? row.exam_date : row.exam_date.toISOString().split('T')[0];
      if (!dutiesByDate[dateStr]) dutiesByDate[dateStr] = [];
      dutiesByDate[dateStr].push({
        id: row.id,
        room_id: row.room_id,
        room_no: row.room_no,
        faculty_id: row.faculty_id,
        faculty_name: row.faculty_name,
        is_manual_override: row.is_manual_override,
        status: row.status
      });
    }

    // Also fetch exam_period for this academic_year so frontend can display it
    const periodRes = await db.query('SELECT start_date, end_date, source FROM exam_periods WHERE academic_year = $1', [academic_year]);
    const exam_period = periodRes.rows.length > 0 ? periodRes.rows[0] : null;

    res.json({ dutiesByDate, total: result.rows.length, exam_period });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateDuty = async (req, res) => {
  try {
    const { id } = req.params;
    const { faculty_id } = req.body;

    const dutyRes = await db.query('SELECT exam_date, academic_year FROM main_exam_duty WHERE id = $1', [id]);
    if (dutyRes.rows.length === 0) return res.status(404).json({ error: 'Duty not found' });
    
    const { exam_date, academic_year } = dutyRes.rows[0];

    // Conflict check
    const conflictRes = await db.query(
      `SELECT r.room_no FROM main_exam_duty m
       JOIN rooms r ON m.room_id = r.id
       WHERE m.exam_date = $1 AND m.faculty_id = $2 AND m.id != $3`,
      [exam_date, faculty_id, id]
    );

    if (conflictRes.rows.length > 0) {
      return res.status(409).json({ 
        error: `Conflict: Faculty is already assigned to room ${conflictRes.rows[0].room_no} on this date.` 
      });
    }

    await db.query(
      `UPDATE main_exam_duty 
       SET faculty_id = $1, is_manual_override = true 
       WHERE id = $2`,
      [faculty_id, id]
    );

    res.json({ message: 'Duty updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.exportPDF = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const result = await db.query(`
      SELECT m.exam_date, r.room_no, f.name AS faculty_name
      FROM main_exam_duty m
      JOIN rooms r ON m.room_id = r.id
      LEFT JOIN faculty f ON m.faculty_id = f.id
      WHERE m.academic_year = $1
      ORDER BY r.room_no, m.exam_date
    `, [academic_year]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'No data to export' });

    // Pivot data: Rows = Rooms, Columns = Dates
    const rooms = [...new Set(result.rows.map(r => r.room_no))].sort();
    const dates = [...new Set(result.rows.map(r => typeof r.exam_date === 'string' ? r.exam_date : r.exam_date.toISOString().split('T')[0]))].sort();

    const dataMatrix = {};
    for (const r of rooms) dataMatrix[r] = {};
    for (const row of result.rows) {
      const dStr = typeof row.exam_date === 'string' ? row.exam_date : row.exam_date.toISOString().split('T')[0];
      dataMatrix[row.room_no][dStr] = row.faculty_name || 'UNASSIGNED';
    }

    const doc = new PDFDocument({ margin: 30, layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=main-duty-${academic_year}.pdf`);
    doc.pipe(res);

    doc.fontSize(16).text('Indian Institute of Information Technology, Pune', { align: 'center' });
    doc.fontSize(12).text(`Main Exam Duty Roster - ${academic_year}`, { align: 'center' });
    doc.moveDown();

    // Table rendering
    const startX = 30;
    let startY = doc.y;
    const colWidth = (doc.page.width - 60) / (dates.length + 1);

    // Headers
    doc.fontSize(10);
    doc.text('ROOM', startX, startY, { width: colWidth });
    dates.forEach((d, i) => {
      doc.text(d, startX + colWidth * (i + 1), startY, { width: colWidth });
    });
    startY += 20;

    // Rows
    for (const r of rooms) {
      if (startY > doc.page.height - 50) {
        doc.addPage();
        startY = 30;
      }
      doc.text(r, startX, startY, { width: colWidth });
      dates.forEach((d, i) => {
        doc.text(dataMatrix[r][d] || '', startX + colWidth * (i + 1), startY, { width: colWidth });
      });
      startY += 15;
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const result = await db.query(`
      SELECT m.exam_date, r.room_no, f.name AS faculty_name
      FROM main_exam_duty m
      JOIN rooms r ON m.room_id = r.id
      LEFT JOIN faculty f ON m.faculty_id = f.id
      WHERE m.academic_year = $1
      ORDER BY r.room_no, m.exam_date
    `, [academic_year]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'No data to export' });

    const rooms = [...new Set(result.rows.map(r => r.room_no))].sort();
    const dates = [...new Set(result.rows.map(r => typeof r.exam_date === 'string' ? r.exam_date : r.exam_date.toISOString().split('T')[0]))].sort();

    const dataMatrix = {};
    for (const r of rooms) dataMatrix[r] = {};
    for (const row of result.rows) {
      const dStr = typeof row.exam_date === 'string' ? row.exam_date : row.exam_date.toISOString().split('T')[0];
      dataMatrix[row.room_no][dStr] = row.faculty_name || 'UNASSIGNED';
    }

    const excelData = [];
    for (const r of rooms) {
      const rowData = { 'ROOM': r };
      for (const d of dates) {
        rowData[d] = dataMatrix[r][d] || '';
      }
      excelData.push(rowData);
    }

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Duty Roster');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader('Content-Disposition', `attachment; filename=main-duty-${academic_year}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
};
