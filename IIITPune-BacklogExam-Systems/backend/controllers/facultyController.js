const db = require('../db');

const getAll = async (req, res) => {
  try {
    const { search, sortBy = 'id', order = 'asc' } = req.query;
    
    let queryStr = 'SELECT * FROM faculty';
    const params = [];
    
    if (search) {
      queryStr += ' WHERE name ILIKE $1 OR department ILIKE $1 OR designation ILIKE $1 OR email ILIKE $1';
      params.push(`%${search}%`);
    }

    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const validSortFields = ['id', 'name', 'department', 'designation', 'email', 'max_duty_load'];
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'id';

    queryStr += ` ORDER BY ${actualSortBy} ${sortOrder}`;

    const result = await db.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM faculty WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM faculty WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty not found' });
    }
    res.json({ message: 'Faculty deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getCount = async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM faculty');
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};



exports.createFaculty = async (req, res) => {
  try {
    const { name, department, designation, email, max_duty_load, is_available } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const validDesignations = ['HOD', 'Assistant Professor', 'Associate Professor', 'Professor'];
    const finalDesignation = validDesignations.includes(designation) ? designation : 'Assistant Professor';
    
    const result = await db.query(
      `INSERT INTO faculty (name, department, designation, email, max_duty_load, is_available) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, department, finalDesignation, email, max_duty_load || 5, is_available !== undefined ? is_available : true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create faculty' });
  }
};

exports.updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, designation, email, max_duty_load, is_available } = req.body;
    
    // Check if faculty exists
    const checkRes = await db.query('SELECT * FROM faculty WHERE id = $1', [id]);
    if (checkRes.rowCount === 0) return res.status(404).json({ error: 'Faculty not found' });
    const current = checkRes.rows[0];
    
    const finalDesignation = designation ? (['HOD', 'Assistant Professor', 'Associate Professor', 'Professor'].includes(designation) ? designation : current.designation) : current.designation;
    
    const result = await db.query(
      `UPDATE faculty 
       SET name = COALESCE($1, name), department = COALESCE($2, department), 
           designation = $3, email = COALESCE($4, email), 
           max_duty_load = COALESCE($5, max_duty_load), is_available = COALESCE($6, is_available)
       WHERE id = $7 RETURNING *`,
      [name, department, finalDesignation, email, max_duty_load, is_available, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update faculty' });
  }
};

exports.deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    
    const dutiesRes = await db.query('SELECT count(*) FROM duties WHERE faculty_id = $1', [id]);
    const mainDutiesRes = await db.query('SELECT count(*) FROM main_exam_duty WHERE faculty_id = $1', [id]);
    const reqDutiesRes = await db.query('SELECT count(*) FROM regular_exam_duty WHERE faculty_id_1 = $1 OR faculty_id_2 = $1', [id]);
    
    const totalAssignments = parseInt(dutiesRes.rows[0].count) + parseInt(mainDutiesRes.rows[0].count) + parseInt(reqDutiesRes.rows[0].count);
    
    if (totalAssignments > 0) {
      return res.status(409).json({ error: `Cannot delete: faculty has ${totalAssignments} duty assignment(s). Remove those first.` });
    }
    
    await db.query('DELETE FROM faculty WHERE id = $1', [id]);
    res.json({ message: 'Faculty deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete faculty' });
  }
};
module.exports = { getAll, getById, deleteById, getCount, createFaculty: exports.createFaculty, updateFaculty: exports.updateFaculty, deleteFaculty: exports.deleteFaculty };
