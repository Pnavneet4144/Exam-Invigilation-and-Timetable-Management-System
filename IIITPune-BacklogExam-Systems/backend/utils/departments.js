/**
 * Official IIIT Pune Departments
 * 
 * Single source of truth for the 5 official departments at IIIT Pune.
 * Used across upload validation (backend) and dropdown menus (frontend).
 * 
 * If IIIT Pune adds new departments in the future, update this list
 * and the corresponding frontend dropdown will auto-update.
 */

const VALID_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Applied Science and Humanities',
  'Mathematics',
  'Data Science'
];

/**
 * Check if a given department name is in the official list.
 * Comparison is case-sensitive — department names must match exactly.
 * 
 * @param {string} dept - Department name to validate
 * @returns {boolean} true if dept is a valid IIIT Pune department
 */
function isValidDepartment(dept) {
  return VALID_DEPARTMENTS.includes(dept);
}

module.exports = { VALID_DEPARTMENTS, isValidDepartment };
