/**
 * Faculty Roster Parser
 * 
 * Parses a "duty roster" Excel spreadsheet where:
 *   - Column A: serial number (ignored)
 *   - Column B: faculty full name (e.g. "Dr. Sushant Kumar", "Ms. Anupama Arun")
 *   - Columns C+: date columns with room/duty codes (entirely ignored for this import)
 * 
 * We only extract UNIQUE faculty names from column B.
 * Each extracted faculty defaults to:
 *   designation = 'Assistant Professor'
 *   max_duty_load = 5
 */

const XLSX = require('xlsx');

function getFacultyRosterSheet(workbook) {
  let targetSheetName = null;
  let maxRows = -1;

  for (const name of workbook.SheetNames) {
    if (name.toLowerCase().includes('invig')) {
      return workbook.Sheets[name];
    }
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rows = range.e.r - range.s.r;
    if (rows > maxRows) {
      maxRows = rows;
      targetSheetName = name;
    }
  }
  return workbook.Sheets[targetSheetName];
}

function isValidFacultyName(name) {
  if (!name || typeof name !== 'string') return { valid: false, reason: 'Empty or not string' };
  
  const trimmed = name.trim();
  if (trimmed.length < 3) return { valid: false, reason: 'Too short (less than 3 chars)' };
  
  if (/^\d+$/.test(trimmed)) return { valid: false, reason: 'Pure number' };
  
  const alphaChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (alphaChars < 3) return { valid: false, reason: 'Less than 3 alphabetic characters' };
  
  if (trimmed.includes(':') || trimmed.includes('--')) return { valid: false, reason: 'Contains colons or dashes' };
  
  const lowerName = trimmed.toLowerCase();
  const blacklistedTerms = ['exam', 'sem', 'hon', 'duty', 'date', 'invig', 'room', 'total', 'floor', 'squad', 'academic', 'year', 'course', 'time', 'chart', 'classroom', 'declared'];
  for (const term of blacklistedTerms) {
    if (lowerName.includes(term)) {
      return { valid: false, reason: `Contains blacklisted word: ${term}` };
    }
  }
  
  const words = trimmed.split(/\s+/);
  const prefixes = ['dr', 'dr.', 'mr', 'mr.', 'ms', 'ms.', 'mrs', 'mrs.', 'prof', 'prof.'];
  const hasPrefix = prefixes.includes(words[0].toLowerCase());
  
  if (!hasPrefix && words.length < 2) {
    return { valid: false, reason: 'No title prefix and less than 2 words' };
  }
  
  return { valid: true };
}

function parseFacultyRoster(buffer, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    throw new Error('Faculty roster must be an .xlsx or .xls file');
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = getFacultyRosterSheet(workbook);

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const warnings = [];
  const namesSet = new Set();
  const namesList = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const cellB = sheet[XLSX.utils.encode_cell({ r, c: 1 })]; // Column B
    
    if (!cellB || !cellB.v) continue;

    let name = String(cellB.v).trim();
    if (!name) continue;
    
    const lowerName = name.toLowerCase();
    // basic exact skip list
    if (['name', 'faculty name', 'faculty', 'sr. no.', 'sr no', 's.no', 'total', 'grand total'].includes(lowerName)) {
      continue;
    }

    const validCheck = isValidFacultyName(name);
    if (!validCheck.valid) {
      warnings.push(`Skipped non-name value in column B row ${r + 1}: "${name}" (${validCheck.reason})`);
      continue;
    }

    name = name.replace(/\s+/g, ' ').trim();

    if (!namesSet.has(name.toLowerCase())) {
      namesSet.add(name.toLowerCase());
      namesList.push(name);
    }
  }

  if (namesList.length === 0) {
    warnings.push('No faculty names could be extracted from the file. Check that column B contains names.');
  }

  return { faculty: namesList, warnings };
}

module.exports = { parseFacultyRoster };
