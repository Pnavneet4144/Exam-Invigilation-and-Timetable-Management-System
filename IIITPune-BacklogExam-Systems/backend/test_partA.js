const db = require('./db');

async function apiCall(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`http://localhost:5000/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    console.error(`Error parsing response from ${path}:`, text);
    throw e;
  }
}

async function run() {
  const login = await apiCall('/auth/login/admin', 'POST', { email: 'admin@iiitpune.ac.in', password: 'Admin@123' });
  const token = login.token;

  await db.query(`DELETE FROM duties`);

  const genRes = await apiCall('/duties/generate', 'POST', { academic_year: '2026-2027' }, token);
  console.log('Duties Generated:', genRes);

  const preview = await apiCall('/duties/preview?academic_year=2026-2027', 'GET', null, token);
  
  const duties = Object.values(preview.duties).flat();
  const roomSlotGroups = {};
  for (const d of duties) {
    const key = `${d.exam_date}_${d.time_slot}_${d.room_no}`;
    if (!roomSlotGroups[key]) roomSlotGroups[key] = [];
    roomSlotGroups[key].push(d);
  }
  
  let success = true;
  for (const [key, group] of Object.entries(roomSlotGroups)) {
    const facultyIds = new Set(group.map(d => d.faculty_id));
    console.log(`Group ${key}: ${group.length} students, ${facultyIds.size} unique faculty assigned:`, Array.from(facultyIds));
    if (facultyIds.size > 2) {
      console.error(`ERROR: Group ${key} has more than 2 faculty!`);
      success = false;
    }
  }

  if (success) console.log("Part A Bug 2 test PASSED.");

  process.exit(0);
}
run().catch(console.error);
