const XLSX = require('xlsx');

function getBacklogMatrixSheet(workbook, warnings) {
  let targetSheetName = null;
  let maxArea = -1;

  for (const name of workbook.SheetNames) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('m-tech') || lowerName.includes('mtech')) {
      warnings.push(`M-Tech data sheet detected ("${name}") but not imported — B.Tech/Honors only in this version.`);
      continue;
    }
    if (lowerName.includes('b-tech') || lowerName.includes('btech')) {
      return workbook.Sheets[name];
    }
    
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const area = (range.e.r - range.s.r) * (range.e.c - range.s.c);
    if (area > maxArea) {
      maxArea = area;
      targetSheetName = name;
    }
  }
  return workbook.Sheets[targetSheetName || workbook.SheetNames[0]];
}

function romanToInt(roman) {
  const map = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
  return map[roman.toUpperCase()] || null;
}

function parseBacklogMatrix(buffer, originalName) {
  const ext = originalName.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    throw new Error('Backlog matrix must be an .xlsx or .xls file');
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const warnings = [];
  const sheet = getBacklogMatrixSheet(workbook, warnings);
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  // STEP 1: Find the data header row
  let headerRow = -1;
  let misCol = -1;
  let nameCol = -1;
  let semCol = -1;

  for (let r = range.s.r; r <= range.e.r && r < 20; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell || !cell.v) continue;
      const val = String(cell.v).trim().toLowerCase();
      if (val.includes('mis') || val === 'roll no' || val === 'roll_no' || val === 'rollno' || val === 'roll number') {
        misCol = c;
        headerRow = r;
      }
      if (val === 'name' || val === 'student name') {
        nameCol = c;
        headerRow = r;
      }
      if (val === 'sem' || val === 'semester') {
        semCol = c;
      }
    }
    if (headerRow >= 0 && misCol >= 0) break;
  }

  if (headerRow < 0 || misCol < 0) {
    throw new Error('Could not find header row with MIS/Roll number column. Check the spreadsheet format.');
  }

  // STEP 2: Identify semester markers on row 1 (headerRow - 1)
  const semMarkerCols = []; // { col, sem }
  if (headerRow > range.s.r) {
    const rMarker = headerRow - 1; // Assuming row above headers
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rMarker, c })];
      if (!cell || !cell.v) continue;
      
      const val = String(cell.v).trim();
      const match = val.match(/Sem\s*(\d)/i);
      if (match) {
        semMarkerCols.push({ col: c, sem: parseInt(match[1], 10) });
      }
    }
  }

  // Sort them just in case
  semMarkerCols.sort((a, b) => a.col - b.col);

  // STEP 3: Identify subject columns
  const subjectColumns = []; 
  let finalTotalCol = -1;

  for (let c = range.s.c; c <= range.e.c; c++) {
    // Determine which semester this column belongs to
    let sem = null;
    for (let i = 0; i < semMarkerCols.length; i++) {
      if (c >= semMarkerCols[i].col) {
        if (i === semMarkerCols.length - 1 || c < semMarkerCols[i + 1].col) {
          sem = semMarkerCols[i].sem;
          break;
        }
      }
    }

    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (!cell || !cell.v) continue;
    
    const headerText = String(cell.v).trim();
    if (!headerText) continue;

    const lower = headerText.toLowerCase();

    // Exclude basic columns
    if (c === misCol || c === nameCol || c === semCol) continue;
    if (lower === 'sr' || lower.includes('sr.') || lower.includes('s.no') || lower === 'amount') continue;

    // Exclude Total running cols
    if (lower.startsWith('total no. of')) {
      if (!sem) finalTotalCol = c; // Assuming it's the final one if outside a block or just generally track it
      continue;
    }
    
    // Fallback if final total column is labeled differently
    if (lower.includes('total') && (lower.includes('exam') || lower.includes('applied'))) {
      finalTotalCol = c;
      continue;
    }

    // Only add if it's within a known semester block (or if no blocks found, just add it, but normally we need a block)
    if (sem) {
      subjectColumns.push({ col: c, headerText, semester: sem });
    }
  }

  if (subjectColumns.length === 0) {
    warnings.push('No subject columns detected. Check that subject headers exist and semester markers (e.g. "Sem 1") exist above them.');
  }

  // STEP 4: Parse student data rows
  const students = [];
  const backlogs = [];

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const misCell = sheet[XLSX.utils.encode_cell({ r, c: misCol })];
    if (!misCell || !misCell.v) continue;

    let rollNo = String(misCell.v).trim().replace(/^['"]/, '');
    if (!rollNo || rollNo.length < 2) continue;
    
    const rollLower = rollNo.toLowerCase();
    if (rollLower === 'total' || rollLower === 'grand total' || rollLower.includes('sum')) continue;

    const nameCell = nameCol >= 0 ? sheet[XLSX.utils.encode_cell({ r, c: nameCol })] : null;
    const studentName = nameCell && nameCell.v ? String(nameCell.v).trim() : rollNo;

    let studentSem = null;
    if (semCol >= 0) {
      const semCell = sheet[XLSX.utils.encode_cell({ r, c: semCol })];
      if (semCell && semCell.v) {
        studentSem = romanToInt(String(semCell.v).trim());
      }
    }
    if (!studentSem) {
      warnings.push(`Row ${r + 1}: Could not determine current semester for student ${rollNo}.`);
    }

    let department = null;
    if (rollNo.length >= 6) {
      const char6 = rollNo.charAt(5); // 0-indexed 5 = 6th char
      if (char6 === '5') department = 'Computer Science & Engineering';
      else if (char6 === '6') department = 'Electronics & Communication Engineering';
      else warnings.push(`Row ${r + 1}: could not determine department from MIS number ${rollNo} (unexpected character at position 6: ${char6})`);
    } else {
      warnings.push(`Row ${r + 1}: MIS number ${rollNo} is too short to determine department.`);
    }

    students.push({ roll_no: rollNo, name: studentName, semester: studentSem, department, row: r + 1 });

    let backlogCount = 0;

    for (const sc of subjectColumns) {
      const dataCell = sheet[XLSX.utils.encode_cell({ r, c: sc.col })];
      if (!dataCell) continue;

      const val = dataCell.v;
      const isTruthy = val === 1 || val === '1' || val === true ||
        (typeof val === 'string' && ['y', 'yes', 'x'].includes(val.trim().toLowerCase()));

      if (isTruthy) {
        backlogs.push({
          roll_no: rollNo,
          subject_header: sc.headerText,
          semester: sc.semester,
          row: r + 1
        });
        backlogCount++;
      }
    }

    if (finalTotalCol >= 0) {
      const totalCell = sheet[XLSX.utils.encode_cell({ r, c: finalTotalCol })];
      if (totalCell && totalCell.v !== undefined && totalCell.v !== '') {
        const expectedTotal = parseInt(String(totalCell.v).trim(), 10);
        if (!isNaN(expectedTotal) && expectedTotal !== backlogCount) {
          warnings.push(`Row ${r + 1} (roll ${rollNo}): expected ${expectedTotal} backlogs per total column, found ${backlogCount} marked subjects`);
        }
      }
    }
  }

  const uniqueStudents = {};
  for (const s of students) {
    if (!uniqueStudents[s.roll_no]) uniqueStudents[s.roll_no] = s;
  }

  const uniqueSubjects = {};
  for (const b of backlogs) {
    const key = `${b.subject_header}__${b.semester || 'unknown'}`;
    if (!uniqueSubjects[key]) {
      uniqueSubjects[key] = { header: b.subject_header, semester: b.semester };
    }
  }

  return {
    students: Object.values(uniqueStudents),
    subjects: Object.values(uniqueSubjects),
    backlogs,
    warnings,
    subjectColumnsDetected: subjectColumns.length,
    semesterMarkersFound: semMarkerCols.length,
    sheetSelected: sheet['!ref'] ? true : false
  };
}

function generateSubjectCode(headerText) {
  return headerText
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/[-\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20);
}

module.exports = { parseBacklogMatrix, generateSubjectCode };
