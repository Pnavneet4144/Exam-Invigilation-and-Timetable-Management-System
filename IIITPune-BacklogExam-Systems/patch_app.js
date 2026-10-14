const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

if (!content.includes('MainExamDuty')) {
  content = content.replace(
    "import DutyAllocation from './pages/DutyAllocation';",
    "import DutyAllocation from './pages/DutyAllocation';\nimport MainExamDuty from './pages/MainExamDuty';"
  );
  
  content = content.replace(
    /<Route path="duty-allocation" element={<DutyAllocation \/>} \/>/g,
    `<Route path="duty-allocation" element={<DutyAllocation />} />\n            <Route path="main-exam-duty" element={<MainExamDuty />} />`
  );
  
  fs.writeFileSync('frontend/src/App.jsx', content);
}
