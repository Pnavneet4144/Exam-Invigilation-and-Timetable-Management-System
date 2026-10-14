const db = require('../db');

const getSections = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sections ORDER BY class_name, section_name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sections' });
  }
};

const createSection = async (req, res) => {
  try {
    const { class_name, section_name } = req.body;
    if (!class_name || !section_name) return res.status(400).json({ error: 'Missing required fields' });
    const result = await db.query(
      'INSERT INTO sections (class_name, section_name) VALUES ($1, $2) RETURNING *',
      [class_name, section_name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create section' });
  }
};

const deleteSection = async (req, res) => {
  try {
    await db.query('DELETE FROM sections WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete section' });
  }
};

module.exports = { getSections, createSection, deleteSection };
