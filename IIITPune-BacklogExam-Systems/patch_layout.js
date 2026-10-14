const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/Layout.jsx', 'utf8');

// Insert the new route into the sidebar
content = content.replace(
  "{ name: 'Duty Allocation', path: `/${role}/dashboard/duty-allocation`, icon: '📝' },",
  "{ name: 'Duty Allocation', path: `/${role}/dashboard/duty-allocation`, icon: '📝' },\n    { name: 'Main Exam Duty', path: `/${role}/dashboard/main-exam-duty`, icon: '📅' },"
);

fs.writeFileSync('frontend/src/components/Layout.jsx', content);
