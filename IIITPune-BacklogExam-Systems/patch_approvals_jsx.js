const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Approvals.jsx', 'utf8');

code = code.replace(
  "{activeTab === 'schedule' ? 'Student' : 'Faculty'}",
  "{activeTab === 'schedule' ? 'Student' : activeTab === 'duty' ? 'Faculty' : 'Invigilators'}"
);

code = code.replace(
  `{activeTab === 'schedule' ? (
                          <>
                            <div className="text-gray-900">{item.student_name}</div>
                            <div className="text-gray-500 text-xs">{item.roll_no}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-gray-900">{item.faculty_name}</div>
                            <div className="text-gray-500 text-xs">{item.faculty_designation}</div>
                          </>
                        )}`,
  `{activeTab === 'schedule' ? (
                          <>
                            <div className="text-gray-900">{item.student_name}</div>
                            <div className="text-gray-500 text-xs">{item.roll_no}</div>
                          </>
                        ) : activeTab === 'duty' ? (
                          <>
                            <div className="text-gray-900">{item.faculty_name}</div>
                            <div className="text-gray-500 text-xs">{item.faculty_designation}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-gray-900">1: {item.f1_name}</div>
                            <div className="text-gray-900">2: {item.f2_name}</div>
                          </>
                        )}`
);

fs.writeFileSync('frontend/src/pages/Approvals.jsx', code);
