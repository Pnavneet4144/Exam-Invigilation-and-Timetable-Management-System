
function extractDateRange(headerText) {
  // Common patterns: "14th to 25th May 2026", "14/05/2026 to 25/05/2026", "14 - 25 May 2026", "May 14-25, 2026"
  // For simplicity, we'll try a few regexes or look for date-like strings
  let start_date = null;
  let end_date = null;
  
  // Try format: DD/MM/YYYY to DD/MM/YYYY
  const slashMatch = headerText.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:to|-)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (slashMatch) {
    const parsePart = (str) => {
      const [d, m, y] = str.split('/');
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`).toISOString().split('T')[0];
    };
    return { start_date: parsePart(slashMatch[1]), end_date: parsePart(slashMatch[2]) };
  }

  // Try format: DD - DD Month YYYY or DDth to DDth Month YYYY
  const textMatch = headerText.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i);
  if (textMatch) {
    const startDay = textMatch[1].padStart(2, '0');
    const endDay = textMatch[2].padStart(2, '0');
    const monthStr = textMatch[3];
    const year = textMatch[4];
    const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const month = monthMap[monthStr.toLowerCase().substring(0,3)];
    if (month) {
      return { start_date: `${year}-${month}-${startDay}`, end_date: `${year}-${month}-${endDay}` };
    }
  }

  return null;
}

// Safety: ensure start_date <= end_date
function ensureDateOrder(result) {
  if (result && result.start_date > result.end_date) {
    return { start_date: result.end_date, end_date: result.start_date };
  }
  return result;
}

const XLSX = require('xlsx');

function getSeatingPlanSheet(workbook) {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    if (range.e.r - range.s.r < 4) continue;

    let foundRoom = false;
    let foundDesks = false;
    let foundSeating = false;

    for (let r = range.s.r; r <= range.e.r && r < 20; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v) {
          const val = String(cell.v).trim().toUpperCase();
          if (val === 'ROOM') foundRoom = true;
          if (val === 'DESKS') foundDesks = true;
          if (val === 'SEATING') foundSeating = true;
        }
      }
      if (foundRoom && foundDesks && foundSeating) return sheet;
    }
  }
  return workbook.Sheets[workbook.SheetNames[0]];
}

function parseSeatingPlan(buffer, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    throw new Error('Seating plan must be an .xlsx or .xls file');
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = getSeatingPlanSheet(workbook);

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  let warnings = [];

  let headerRow = -1;

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v && String(cell.v).trim().toUpperCase() === 'ROOM') {
        headerRow = r;
        break;
      }
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0) {
    throw new Error('Could not find header row containing "ROOM". Check the spreadsheet format.');
  }

  const colMap = {}; 
  const branchSemCols = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (!cell || !cell.v) continue;
    const val = String(cell.v).trim();
    const upper = val.toUpperCase();

    if (upper === 'ROOM') {
      colMap[c] = 'room';
    } else if (upper.includes('FLOOR')) {
      colMap[c] = 'floor';
    } else if (upper === 'DESKS') {
      colMap[c] = 'desks';
    } else if (upper === 'SEATING') {
      colMap[c] = 'seating';
    } else if (upper === 'TOTAL' || upper === 'CAPACITY') {
      colMap[c] = 'total'; 
    } else {
      const lastHyphen = val.lastIndexOf('-');
      if (lastHyphen > 0) {
        const branch = val.substring(0, lastHyphen).trim();
        const semStr = val.substring(lastHyphen + 1).trim();
        const sem = parseInt(semStr, 10);
        if (!isNaN(sem) && sem > 0 && sem <= 12 && branch.length > 0) {
          branchSemCols.push({ col: c, branch, semester: sem });
          colMap[c] = 'branch_sem';
        }
      }
    }
  }

  const roomCol = Object.keys(colMap).find(c => colMap[c] === 'room');
  const floorCol = Object.keys(colMap).find(c => colMap[c] === 'floor');
  const desksCol = Object.keys(colMap).find(c => colMap[c] === 'desks');
  const seatingCol = Object.keys(colMap).find(c => colMap[c] === 'seating');

  if (roomCol === undefined) {
    throw new Error('Could not find ROOM column in the header row.');
  }

  if (branchSemCols.length === 0) {
    warnings.push('No branch-semester columns detected (expected headers like "CSE-2", "ECE-4"). Check column headers.');
  }

  let headerText = '';
  for (let r = range.s.r; r < headerRow; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v) {
        headerText += ' ' + String(cell.v).trim();
      }
    }
  }
  
  const dates = ensureDateOrder(extractDateRange(headerText));

  const blocks = [];
  let currentFloor = '';

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const roomCell = sheet[XLSX.utils.encode_cell({ r, c: parseInt(roomCol) })];
    if (!roomCell || !roomCell.v) continue;

    const roomRaw = String(roomCell.v).trim();
    if (roomRaw.toUpperCase() === 'TOTAL' || roomRaw.toUpperCase() === 'GRAND TOTAL') continue;

    let rowFloor = '';
    if (floorCol !== undefined) {
      const floorCell = sheet[XLSX.utils.encode_cell({ r, c: parseInt(floorCol) })];
      if (floorCell && floorCell.v !== undefined && String(floorCell.v).trim() !== '') {
        rowFloor = String(floorCell.v).trim();
        currentFloor = rowFloor;
      } else {
        rowFloor = currentFloor;
      }
    }

    const desks = desksCol !== undefined
      ? (sheet[XLSX.utils.encode_cell({ r, c: parseInt(desksCol) })]?.v || '')
      : '';
    const seating = seatingCol !== undefined
      ? (sheet[XLSX.utils.encode_cell({ r, c: parseInt(seatingCol) })]?.v || '')
      : '';

    for (const bsc of branchSemCols) {
      const dataCell = sheet[XLSX.utils.encode_cell({ r, c: bsc.col })];
      if (!dataCell || !dataCell.v) continue;

      const cellVal = String(dataCell.v).trim();
      if (!cellVal || cellVal === '0' || cellVal === '-') continue;

      const parsed = parseCellValue(cellVal, r + 1, roomRaw, bsc.branch, bsc.semester);
      warnings = warnings.concat(parsed.warnings);

      for (const rng of parsed.ranges) {
        blocks.push({
          room_code_raw: roomRaw,
          branch: bsc.branch,
          semester: bsc.semester,
          count: rng.count,
          roll_no_start: rng.start,
          roll_no_end: rng.end,
          floor: rowFloor,
          desks: String(desks),
          seating: String(seating)
        });
      }
    }
  }

  return { 
    blocks, 
    warnings, 
    branch_semester_columns: branchSemCols.map(b => `${b.branch}-${b.semester}`),
    exam_period_found: !!dates,
    start_date: dates ? dates.start_date : null,
    end_date: dates ? dates.end_date : null
  };
}

function splitTopLevelSegments(str) {
  const segments = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '[' || char === '(') depth++;
    else if (char === ']' || char === ')') depth--;

    if (char === '+' && depth === 0) {
      if (current.trim()) segments.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

function parseCellValue(cellVal, rowNum, roomRaw, branch, semester) {
  const cleanVal = cellVal.replace(/\.$/, '').trim();
  const resultRanges = [];
  const warnings = [];

  const parenMatch = cleanVal.match(/^(\d+)\s*\([^\[\]]+\)$/);
  if (parenMatch) {
    warnings.push(`Row ${rowNum}, Room "${roomRaw}", ${branch}-${semester}: roll number range not specified, only total count (${parenMatch[1]}) recorded.`);
    return {
      ranges: [{ count: parseInt(parenMatch[1], 10), start: null, end: null }],
      warnings
    };
  }

  const segments = splitTopLevelSegments(cleanVal);

  for (const seg of segments) {
    const bracketMatch = seg.match(/^(\d+)?\s*\[(.+)\]$/);
    if (bracketMatch) {
      const outerCount = bracketMatch[1] ? parseInt(bracketMatch[1], 10) : null;
      const inside = bracketMatch[2].trim();
      const subRanges = inside.split('+');
      const useCount = subRanges.length === 1 ? outerCount : null;

      for (const sr of subRanges) {
        const trimmed = sr.trim();
        const parts = trimmed.split('-');
        
        if (parts.length === 2) {
          resultRanges.push({ count: useCount, start: parts[0].trim(), end: parts[1].trim() });
        } else if (parts.length === 1) {
          resultRanges.push({ count: useCount || 1, start: trimmed, end: trimmed });
        } else {
          const dashMatch = trimmed.match(/^(.+?)\s*-\s*(.+)$/);
          if (dashMatch) {
            resultRanges.push({ count: useCount, start: dashMatch[1].trim(), end: dashMatch[2].trim() });
          } else {
            warnings.push(`Row ${rowNum}, Room "${roomRaw}", ${branch}-${semester}: Could not parse sub-range "${trimmed}" in segment "${seg}"`);
          }
        }
      }
      continue;
    }

    const bareRangeMatch = seg.match(/^([A-Za-z0-9]+)\s*-\s*([A-Za-z0-9]+)$/);
    if (bareRangeMatch) {
      resultRanges.push({ count: null, start: bareRangeMatch[1], end: bareRangeMatch[2] });
      continue;
    }

    const singleBareMatch = seg.match(/^[A-Za-z0-9]+$/);
    if (singleBareMatch) {
      resultRanges.push({ count: 1, start: seg, end: seg });
      continue;
    }

    const parenSegMatch = seg.match(/^(\d+)\s*\([^\[\]]+\)$/);
    if (parenSegMatch) {
      resultRanges.push({ count: parseInt(parenSegMatch[1], 10), start: null, end: null });
      warnings.push(`Row ${rowNum}, Room "${roomRaw}", ${branch}-${semester}: roll number range not specified for segment "${seg}", only total count (${parenSegMatch[1]}) recorded.`);
      continue;
    }

    warnings.push(`Row ${rowNum}, Room "${roomRaw}", ${branch}-${semester}: Could not parse segment "${seg}"`);
  }

  return { ranges: resultRanges, warnings };
}

module.exports = { parseSeatingPlan };
