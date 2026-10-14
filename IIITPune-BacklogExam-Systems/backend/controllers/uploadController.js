const db = require('../db');
const { VALID_DEPARTMENTS, isValidDepartment } = require('../utils/departments');

// helper function to extract constraint name from postgres error
const getConstraintName = (err) => err.constraint || 'Unique constraint violation';

const uploadStudents = async (req, res) => {
  const rows = req.parsedRows;
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based + 1 header row
    
    // validate required
    if (!row.roll_no || !row.name) {
      errors.push({ row: rowNum, error: 'Missing required fields: roll_no and name' });
      continue;
    }
    
    // validate types
    const semester = row.semester ? parseInt(row.semester, 10) : null;
    if (row.semester && isNaN(semester)) {
      errors.push({ row: rowNum, error: 'semester must be an integer' });
      continue;
    }

    // Validate department against official IIIT Pune list
    if (row.department && !isValidDepartment(row.department)) {
      errors.push({ row: rowNum, error: `Invalid department "${row.department}". Must be one of: ${VALID_DEPARTMENTS.join(', ')}` });
      continue;
    }

    try {
      await db.query(
        'INSERT INTO students (roll_no, name, department, semester, email) VALUES ($1, $2, $3, $4, $5)',
        [row.roll_no, row.name, row.department || null, semester, row.email || null]
      );
      successCount++;
    } catch (err) {
      if (err.code === '23505') {
        errors.push({ row: rowNum, error: `Duplicate entry for ${getConstraintName(err)}` });
      } else {
        errors.push({ row: rowNum, error: err.message });
      }
    }
  }
  
  res.json({ success: successCount, failed: errors.length, errors });
};

const uploadSubjects = async (req, res) => {
  const rows = req.parsedRows;
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (!row.subject_code || !row.subject_name || !row.semester) {
      errors.push({ row: rowNum, error: 'Missing required fields: subject_code, subject_name, semester' });
      continue;
    }

    const semester = parseInt(row.semester, 10);
    if (isNaN(semester)) {
      errors.push({ row: rowNum, error: 'semester must be an integer' });
      continue;
    }

    // Validate department against official IIIT Pune list
    if (row.department && !isValidDepartment(row.department)) {
      errors.push({ row: rowNum, error: `Invalid department "${row.department}". Must be one of: ${VALID_DEPARTMENTS.join(', ')}` });
      continue;
    }

    try {
      await db.query(
        'INSERT INTO subjects (subject_code, subject_name, semester, department) VALUES ($1, $2, $3, $4)',
        [row.subject_code, row.subject_name, semester, row.department || null]
      );
      successCount++;
    } catch (err) {
      if (err.code === '23505') {
        errors.push({ row: rowNum, error: `Duplicate entry for ${getConstraintName(err)}` });
      } else {
        errors.push({ row: rowNum, error: err.message });
      }
    }
  }
  
  res.json({ success: successCount, failed: errors.length, errors });
};

const uploadRooms = async (req, res) => {
  const rows = req.parsedRows;
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (!row.room_no || !row.capacity) {
      errors.push({ row: rowNum, error: 'Missing required fields: room_no, capacity' });
      continue;
    }

    const capacity = parseInt(row.capacity, 10);
    if (isNaN(capacity) || capacity <= 0) {
      errors.push({ row: rowNum, error: 'capacity must be a positive integer' });
      continue;
    }

    try {
      await db.query(
        'INSERT INTO rooms (room_no, building, capacity) VALUES ($1, $2, $3)',
        [row.room_no, row.building || null, capacity]
      );
      successCount++;
    } catch (err) {
      if (err.code === '23505') {
        errors.push({ row: rowNum, error: `Duplicate entry for ${getConstraintName(err)}` });
      } else {
        errors.push({ row: rowNum, error: err.message });
      }
    }
  }
  
  res.json({ success: successCount, failed: errors.length, errors });
};

const uploadFaculty = async (req, res) => {
  const rows = req.parsedRows;
  let successCount = 0;
  const errors = [];

  const allowedDesignations = ['HOD', 'Assistant Professor', 'Associate Professor', 'Professor'];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (!row.name) {
      errors.push({ row: rowNum, error: 'Missing required field: name' });
      continue;
    }

    let designation = row.designation || null;
    if (designation && !allowedDesignations.includes(designation)) {
      errors.push({ row: rowNum, error: `designation must be one of ${allowedDesignations.join(', ')}` });
      continue;
    }

    // Validate department against official IIIT Pune list
    if (row.department && !isValidDepartment(row.department)) {
      errors.push({ row: rowNum, error: `Invalid department "${row.department}". Must be one of: ${VALID_DEPARTMENTS.join(', ')}` });
      continue;
    }

    const max_duty_load = row.max_duty_load ? parseInt(row.max_duty_load, 10) : 5;
    if (isNaN(max_duty_load) || max_duty_load <= 0) {
      errors.push({ row: rowNum, error: 'max_duty_load must be a positive integer' });
      continue;
    }

    try {
      await db.query(
        'INSERT INTO faculty (name, department, designation, email, max_duty_load) VALUES ($1, $2, $3, $4, $5)',
        [row.name, row.department || null, designation, row.email || null, max_duty_load]
      );
      successCount++;
    } catch (err) {
      if (err.code === '23505') {
        errors.push({ row: rowNum, error: `Duplicate entry for ${getConstraintName(err)}` });
      } else {
        errors.push({ row: rowNum, error: err.message });
      }
    }
  }
  
  res.json({ success: successCount, failed: errors.length, errors });
};

module.exports = { uploadStudents, uploadSubjects, uploadRooms, uploadFaculty };
