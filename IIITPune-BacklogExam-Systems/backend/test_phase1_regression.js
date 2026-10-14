const db = require('./db');

const API_BASE = 'http://localhost:5000/api';

async function req(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function testPhase1Regression() {
  console.log('====================================================');
  console.log('PHASE 1 REGRESSION & API VERIFICATION');
  console.log('====================================================\n');

  let allPassed = true;

  // 1. Admin Login
  console.log('1. Testing Admin Login (admin@iiitpune.ac.in)...');
  const adminLogin = await req('POST', '/auth/login/admin', {
    email: 'admin@iiitpune.ac.in',
    password: 'Admin@123'
  });
  if (adminLogin.ok && adminLogin.data.user.role === 'superadmin') {
    console.log('   PASS: Admin logged in successfully.');
  } else {
    console.error('   FAIL: Admin login failed:', adminLogin.data);
    allPassed = false;
  }
  const adminToken = adminLogin.data.token;

  // 2. Staff Login
  console.log('2. Testing Staff Login (staff1@iiitpune.ac.in)...');
  const staffLogin = await req('POST', '/auth/login/staff', {
    email: 'staff1@iiitpune.ac.in',
    password: 'Staff@123'
  });
  if (staffLogin.ok && staffLogin.data.user.role === 'editor') {
    console.log('   PASS: Staff logged in successfully.');
  } else {
    console.error('   FAIL: Staff login failed:', staffLogin.data);
    allPassed = false;
  }
  const staffToken = staffLogin.data.token;

  // 3. Cross-role rejection: Staff attempting Admin Login
  console.log('3. Testing Staff rejected at Admin Login...');
  const staffAtAdmin = await req('POST', '/auth/login/admin', {
    email: 'staff1@iiitpune.ac.in',
    password: 'Staff@123'
  });
  if (staffAtAdmin.status === 403) {
    console.log('   PASS: Staff correctly rejected with HTTP 403 at Admin login.');
  } else {
    console.error('   FAIL: Expected HTTP 403, got:', staffAtAdmin.status);
    allPassed = false;
  }

  // 4. Cross-role rejection: Admin attempting Staff Login
  console.log('4. Testing Admin rejected at Staff Login...');
  const adminAtStaff = await req('POST', '/auth/login/staff', {
    email: 'admin@iiitpune.ac.in',
    password: 'Admin@123'
  });
  if (adminAtStaff.status === 403) {
    console.log('   PASS: Admin correctly rejected with HTTP 403 at Staff login.');
  } else {
    console.error('   FAIL: Expected HTTP 403, got:', adminAtStaff.status);
    allPassed = false;
  }

  // 5. Auth /me check
  console.log('5. Testing /auth/me for admin and staff...');
  const meAdmin = await req('GET', '/auth/me', null, adminToken);
  const meStaff = await req('GET', '/auth/me', null, staffToken);
  if (meAdmin.data.role === 'superadmin' && meStaff.data.role === 'editor') {
    console.log('   PASS: /auth/me returns valid profiles for both roles.');
  } else {
    console.error('   FAIL: /auth/me mismatch:', meAdmin.data, meStaff.data);
    allPassed = false;
  }

  // 6. Data tables APIs (Students, Subjects, Faculty, Rooms)
  console.log('6. Testing Data APIs (GET & COUNT)...');
  const [stRes, stCnt, subRes, subCnt, facRes, facCnt, rmRes, rmCnt] = await Promise.all([
    req('GET', '/students', null, staffToken),
    req('GET', '/students/count', null, staffToken),
    req('GET', '/subjects', null, staffToken),
    req('GET', '/subjects/count', null, staffToken),
    req('GET', '/faculty', null, staffToken),
    req('GET', '/faculty/count', null, staffToken),
    req('GET', '/rooms', null, staffToken),
    req('GET', '/rooms/count', null, staffToken)
  ]);

  if (
    stRes.ok && stCnt.ok && Array.isArray(stRes.data) &&
    subRes.ok && subCnt.ok && Array.isArray(subRes.data) &&
    facRes.ok && facCnt.ok && Array.isArray(facRes.data) &&
    rmRes.ok && rmCnt.ok && Array.isArray(rmRes.data)
  ) {
    console.log(`   PASS: Students (${stRes.data.length}), Subjects (${subRes.data.length}), Rooms (${rmRes.data.length}) list & count endpoints active.`);
  } else {
    console.error('   FAIL: Data endpoints error:', { stRes, subRes, facRes, rmRes });
    allPassed = false;
  }

  // 7. Preview Endpoint contract verification for Frontend UI
  console.log('7. Testing /scheduling/preview contract against UI requirements...');
  const preview = await req('GET', '/scheduling/preview?academic_year=2026-2027', null, staffToken);
  if (preview.ok && preview.data.grouped_schedule) {
    const dates = Object.keys(preview.data.grouped_schedule);
    const firstDateGroup = preview.data.grouped_schedule[dates[0]];
    const sample = firstDateGroup[0];
    const expectedKeys = [
      'exam_schedule_id', 'exam_date', 'time_slot', 'academic_year',
      'is_manual_override', 'status', 'room_id', 'room_no', 'building',
      'student_id', 'roll_no', 'student_name', 'subject_code', 'subject_name'
    ];
    const missingKeys = expectedKeys.filter(k => sample[k] === undefined);
    if (missingKeys.length === 0) {
      console.log(`   PASS: /scheduling/preview returns ${dates.length} date groups, sample row contains all required frontend fields: ${expectedKeys.join(', ')}.`);
    } else {
      console.error('   FAIL: Missing keys in preview response:', missingKeys);
      allPassed = false;
    }
  } else {
    console.error('   FAIL: /scheduling/preview returned error:', preview.data);
    allPassed = false;
  }

  console.log('\n====================================================');
  console.log('REGRESSION SUITE RESULT:', allPassed ? 'ALL PASSED (NO REGRESSIONS)' : 'FAILURES DETECTED');
  console.log('====================================================');
  process.exit(allPassed ? 0 : 1);
}

testPhase1Regression().catch(e => {
  console.error(e);
  process.exit(1);
});
