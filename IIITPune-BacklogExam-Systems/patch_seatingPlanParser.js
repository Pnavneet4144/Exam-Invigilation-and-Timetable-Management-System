const fs = require('fs');

let content = fs.readFileSync('backend/utils/seatingPlanParser.js', 'utf8');

const regexFunc = `
function extractDateRange(headerText) {
  // Common patterns: "14th to 25th May 2026", "14/05/2026 to 25/05/2026", "14 - 25 May 2026", "May 14-25, 2026"
  // For simplicity, we'll try a few regexes or look for date-like strings
  let start_date = null;
  let end_date = null;
  
  // Try format: DD/MM/YYYY to DD/MM/YYYY
  const slashMatch = headerText.match(/(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s*(?:to|-)\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{4})/i);
  if (slashMatch) {
    const parsePart = (str) => {
      const [d, m, y] = str.split('/');
      return new Date(\`\${y}-\${m.padStart(2, '0')}-\${d.padStart(2, '0')}\`).toISOString().split('T')[0];
    };
    return { start_date: parsePart(slashMatch[1]), end_date: parsePart(slashMatch[2]) };
  }

  // Try format: DD - DD Month YYYY or DDth to DDth Month YYYY
  const textMatch = headerText.match(/(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+([A-Za-z]+)\\s+(\\d{4})/i);
  if (textMatch) {
    const startDay = textMatch[1].padStart(2, '0');
    const endDay = textMatch[2].padStart(2, '0');
    const monthStr = textMatch[3];
    const year = textMatch[4];
    const monthMap = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const month = monthMap[monthStr.toLowerCase().substring(0,3)];
    if (month) {
      return { start_date: \`\${year}-\${month}-\${startDay}\`, end_date: \`\${year}-\${month}-\${endDay}\` };
    }
  }

  return null;
}
`;

const replaceBlock = `
  const blocks = [];
  let currentFloor = '';

  for (let r = headerRow + 1; r <= range.e.r; r++) {`;

const newBlock = `
  let headerText = '';
  for (let r = range.s.r; r < headerRow; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v) {
        headerText += ' ' + String(cell.v).trim();
      }
    }
  }
  
  const dates = extractDateRange(headerText);

  const blocks = [];
  let currentFloor = '';

  for (let r = headerRow + 1; r <= range.e.r; r++) {`;

const endBlockOld = `
  return { blocks, warnings, branch_semester_columns: branchSemCols.map(b => \`\${b.branch}-\${b.semester}\`) };
}
`;

const endBlockNew = `
  return { 
    blocks, 
    warnings, 
    branch_semester_columns: branchSemCols.map(b => \`\${b.branch}-\${b.semester}\`),
    exam_period_found: !!dates,
    start_date: dates ? dates.start_date : null,
    end_date: dates ? dates.end_date : null
  };
}
`;

content = regexFunc + '\n' + content;
content = content.replace(replaceBlock, newBlock);
content = content.replace(endBlockOld, endBlockNew);

fs.writeFileSync('backend/utils/seatingPlanParser.js', content);
