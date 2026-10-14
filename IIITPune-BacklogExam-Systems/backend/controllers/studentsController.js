const db = require('../db');

const getAll = async (req, res) => {
  try {
    const { search, sortBy = 'id', order = 'asc' } = req.query;
    
    let queryStr = 'SELECT * FROM students';
    const params = [];
    
    if (search) {
      queryStr += ' WHERE roll_no ILIKE $1 OR name ILIKE $1 OR department ILIKE $1';
      params.push(`%${search}%`);
    }

    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const validSortFields = ['id', 'roll_no', 'name', 'department', 'semester', 'email'];
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
    const result = await db.query('SELECT * FROM students WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
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
    const result = await db.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const getCount = async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM students');
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getAll, getById, deleteById, getCount };
