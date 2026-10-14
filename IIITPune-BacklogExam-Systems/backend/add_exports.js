const fs = require('fs');

function appendController(filePath, methodsCode, exportNames) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // Add require
  if (!code.includes('exportGenerator')) {
    code = `const { generatePDF, generateExcel } = require('../utils/exportGenerator');\n` + code;
  }
  
  // Replace module.exports
  const modExpRegex = /module\.exports\s*=\s*\{([^}]+)\};/m;
  const match = code.match(modExpRegex);
  if (match) {
    let exportsStr = match[1];
    exportNames.forEach(n => {
      if (!exportsStr.includes(n)) exportsStr += `, ${n}`;
    });
    code = code.replace(modExpRegex, `module.exports = {${exportsStr}};`);
  }
  
  // Append methods before module.exports
  code = code.replace(/module\.exports\s*=\s*\{/, methodsCode + '\nmodule.exports = {');
  
  fs.writeFileSync(filePath, code);
}

// 1. Scheduling
appendController('backend/controllers/schedulingController.js', `
const exportPDF = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const data = await module.exports.preview(req, mockRes);
    const title = \`Backlog Exam Schedule - \${academic_year}\`;
    const cols = ['Date', 'Time Slot', 'Room', 'Subject', 'Student'];
    const rows = [];
    if(data && typeof data === 'object') {
      Object.values(data).forEach(day => {
        if(Array.isArray(day)) {
          day.forEach(s => {
            rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, \`\${s.room_no} (\${s.building})\`, \`\${s.subject_code} - \${s.subject_name}\`, \`\${s.student_name} (\${s.roll_no})\`]);
          });
        }
      });
    }
    const buffer = await generatePDF(title, cols, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', \`attachment; filename="schedule_\${academic_year}.pdf"\`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};

const exportExcel = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const data = await module.exports.preview(req, mockRes);
    const cols = ['Date', 'Time Slot', 'Room', 'Subject Code', 'Subject Name', 'Student Name', 'Roll No'];
    const rows = [];
    if(data && typeof data === 'object') {
      Object.values(data).flat().forEach(s => {
        rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, s.room_no, s.subject_code, s.subject_name, s.student_name, s.roll_no]);
      });
    }
    const buffer = await generateExcel('Schedule', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', \`attachment; filename="schedule_\${academic_year}.xlsx"\`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};
`, ['exportPDF', 'exportExcel']);

// 2. Duties
appendController('backend/controllers/dutiesController.js', `
const exportPDF = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const payload = await module.exports.previewDuties(req, mockRes);
    const data = payload?.duties || {};
    const title = \`Duty Allocation - \${academic_year}\`;
    const cols = ['Date', 'Time Slot', 'Room', 'Faculty'];
    const rows = [];
    if(data && typeof data === 'object') {
      Object.values(data).flat().forEach(s => {
        rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, s.room_no, s.faculty_name || 'Unassigned']);
      });
    }
    const buffer = await generatePDF(title, cols, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', \`attachment; filename="duties_\${academic_year}.pdf"\`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};

const exportExcel = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const payload = await module.exports.previewDuties(req, mockRes);
    const data = payload?.duties || {};
    const cols = ['Date', 'Time Slot', 'Room', 'Faculty Name', 'Designation'];
    const rows = [];
    if(data && typeof data === 'object') {
      Object.values(data).flat().forEach(s => {
        rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, s.room_no, s.faculty_name || 'Unassigned', s.faculty_designation || '']);
      });
    }
    const buffer = await generateExcel('Duties', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', \`attachment; filename="duties_\${academic_year}.xlsx"\`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};
`, ['exportPDF', 'exportExcel']);

// 3. Regular Duty
appendController('backend/controllers/regularDutyController.js', `
const exportPDF = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const data = await module.exports.preview(req, mockRes);
    const title = \`Regular Exam Duty - \${academic_year}\`;
    const cols = ['Date', 'Time Slot', 'Room', 'Type', 'Invigilators'];
    const rows = [];
    if(Array.isArray(data)) {
      data.forEach(s => {
        rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, s.room_no, s.exam_type, \`1: \${s.f1_name||'None'} 2: \${s.f2_name||'None'}\`]);
      });
    }
    const buffer = await generatePDF(title, cols, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', \`attachment; filename="regular_duties_\${academic_year}.pdf"\`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};

const exportExcel = async (req, res) => {
  try {
    const { academic_year } = req.query;
    const mockRes = { json: (data) => data, status: () => mockRes };
    const data = await module.exports.preview(req, mockRes);
    const cols = ['Date', 'Time Slot', 'Room', 'Section', 'Subject', 'Exam Type', 'Invigilator 1', 'Invigilator 2'];
    const rows = [];
    if(Array.isArray(data)) {
      data.forEach(s => {
        rows.push([new Date(s.exam_date).toLocaleDateString(), s.time_slot, s.room_no, \`\${s.class_name}-\${s.section_name}\`, s.subject_code, s.exam_type, s.f1_name||'', s.f2_name||'']);
      });
    }
    const buffer = await generateExcel('Regular Duties', cols, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', \`attachment; filename="regular_duties_\${academic_year}.xlsx"\`);
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: 'Failed to export' }); }
};
`, ['exportPDF', 'exportExcel']);
