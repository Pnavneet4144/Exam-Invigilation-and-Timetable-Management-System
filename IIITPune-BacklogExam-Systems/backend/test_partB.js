const db = require('./db');
async function apiCall(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`http://localhost:5000/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { throw e; }
}
async function run() {
  const login = await apiCall('/auth/login/admin', 'POST', { email: 'admin@iiitpune.ac.in', password: 'Admin@123' });
  const token = login.token;
  
  // Create dummy section
  const sec = await apiCall('/sections', 'POST', { class_name: 'B.Tech Sem 3', section_name: 'B1' }, token);
  
  const subRes = await db.query('SELECT id FROM subjects LIMIT 1');
  const roomRes = await db.query('SELECT id FROM rooms LIMIT 1');
  
  const payload = {
    section_id: sec.id,
    subject_id: subRes.rows[0].id,
    room_id: roomRes.rows[0].id,
    exam_date: '2026-10-15',
    time_slot: '09:00-12:00',
    exam_type: 'midsem',
    academic_year: '2026-2027'
  };
  
  const createRes = await apiCall('/regular-duty/create', 'POST', payload, token);
  console.log(createRes);
  
  const preview = await apiCall('/regular-duty/preview?academic_year=2026-2027', 'GET', null, token);
  console.log("Preview returned", preview.length, "items.");
  
  process.exit(0);
}
run().catch(console.error);
