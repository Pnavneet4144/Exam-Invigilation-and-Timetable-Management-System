const db = require('./db');

const API_BASE = 'http://localhost:5000/api';

function toDateStr(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.split('T')[0];
  const y = val.getFullYear();
  const m = String(val.getMonth() + 1).padStart(2, '0');
  const d = String(val.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayOfWeek(val) {
  const [y, m, d] = toDateStr(val).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).getDay();
}

async function req(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('PHASE 2 SELF-TEST EXECUTION SUITE');
  console.log('====================================================\n');

  // Step 0: Authenticate as Superadmin to get JWT
  console.log('Authenticating as admin@iiitpune.ac.in...');
  const loginRes = await req('POST', '/auth/login/admin', {
    email: 'admin@iiitpune.ac.in',
    password: 'Admin@123'
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.token;
  console.log('Authentication successful! Token acquired.\n');

  const results = {
    test1: 'PASS', // Server booted on port 5000
    test2: 'PENDING',
    test3: 'PENDING',
    test4: 'PENDING',
    test5: 'PENDING',
    test6: 'PENDING'
  };

  // ---------------------------------------------------------------
  // TEST 2: Call POST /api/scheduling/suggest-pacing
  // ---------------------------------------------------------------
  console.log('--- TEST 2: POST /api/scheduling/suggest-pacing ---');
  try {
    const pacingRes = await req('POST', '/scheduling/suggest-pacing', { academic_year: '2026-2027' }, token);

    const students = pacingRes.data.students;
    console.log(`Received pacing response for ${students.length} students:`);
    students.forEach(s => {
      console.log(`  - ${s.name} (${s.roll_no}): Pending Backlogs = ${s.pending_count}, Suggested papers_per_day = ${s.papers_per_day}`);
    });

    const stA = students.find(s => s.roll_no === 'CS2023001');
    const stB = students.find(s => s.roll_no === 'CS2023002');
    const stC = students.find(s => s.roll_no === 'CS2023003');
    const stD = students.find(s => s.roll_no === 'CS2023004');
    const stE = students.find(s => s.roll_no === 'CS2023005');

    let t2Pass = true;
    if (!stA || stA.pending_count !== 20 || stA.papers_per_day !== 2) {
      console.error('FAIL: Student A must have 20 pending backlogs and papers_per_day = 2');
      t2Pass = false;
    }
    if (!stB || stB.pending_count !== 3 || stB.papers_per_day !== 1) {
      console.error('FAIL: Student B must have 3 pending backlogs and papers_per_day = 1');
      t2Pass = false;
    }
    for (const [st, name] of [[stC, 'Student C'], [stD, 'Student D'], [stE, 'Student E']]) {
      if (!st || st.pending_count !== 1 || st.papers_per_day !== 1) {
        console.error(`FAIL: ${name} must have 1 pending backlog and papers_per_day = 1`);
        t2Pass = false;
      }
    }

    if (t2Pass) {
      results.test2 = 'PASS';
      console.log('>>> TEST 2 RESULT: PASS\n');
    } else {
      results.test2 = 'FAIL';
      console.log('>>> TEST 2 RESULT: FAIL\n');
    }
  } catch (err) {
    console.error('TEST 2 Error:', err);
    results.test2 = 'FAIL';
  }

  // ---------------------------------------------------------------
  // TEST 3: Call POST /api/scheduling/generate & programmatically verify DB
  // ---------------------------------------------------------------
  console.log('--- TEST 3: POST /api/scheduling/generate & Constraint Verification ---');
  try {
    const genRes = await req('POST', '/scheduling/generate', { academic_year: '2026-2027' }, token);
    console.log('Generate response summary:', genRes.data.summary);

    // Direct DB query verification
    const dbScheduleRes = await db.query(`
      SELECT 
        es.id,
        es.backlog_paper_id,
        es.room_id,
        es.exam_date,
        es.time_slot,
        es.academic_year,
        es.is_manual_override,
        es.status,
        bp.student_id,
        st.roll_no,
        st.name AS student_name,
        r.capacity AS room_capacity,
        r.room_no
      FROM exam_schedule es
      JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
      JOIN students st ON bp.student_id = st.id
      JOIN rooms r ON es.room_id = r.id
      WHERE es.academic_year = '2026-2027'
      ORDER BY es.exam_date ASC, es.time_slot ASC
    `);

    const rows = dbScheduleRes.rows;
    console.log(`Direct DB query returned ${rows.length} scheduled exam rows.`);

    let t3Pass = true;

    // a. No student has two exam_schedule rows with same exam_date AND overlapping time_slot
    const studentDateSlotMap = new Map();
    for (const r of rows) {
      const dStr = toDateStr(r.exam_date);
      const key = `${r.student_id}:${dStr}:${r.time_slot}`;
      if (studentDateSlotMap.has(key)) {
        console.error(`CONSTRAINT VIOLATION (3a): Student ${r.student_name} (${r.roll_no}) double-booked on ${dStr} slot ${r.time_slot}!`);
        t3Pass = false;
      }
      studentDateSlotMap.set(key, r.id);
    }

    // b. No room has more students assigned in a single (exam_date, time_slot) than capacity
    const roomSlotUsage = new Map();
    for (const r of rows) {
      const dStr = toDateStr(r.exam_date);
      const key = `${r.room_id}:${dStr}:${r.time_slot}`;
      roomSlotUsage.set(key, (roomSlotUsage.get(key) || 0) + 1);
    }
    for (const [key, count] of roomSlotUsage.entries()) {
      const [roomIdStr, dStr, slot] = key.split(':');
      const rRow = rows.find(r => r.room_id === parseInt(roomIdStr, 10));
      if (count > rRow.room_capacity) {
        console.error(`CONSTRAINT VIOLATION (3b): Room ${rRow.room_no} capacity exceeded on ${dStr} slot ${slot}: ${count} > ${rRow.room_capacity}!`);
        t3Pass = false;
      }
    }

    // c. No exam_schedule row falls on Saturday, Sunday, or holiday
    const holidaysRes = await db.query('SELECT holiday_date FROM holidays');
    const holidaySet = new Set(holidaysRes.rows.map(h => toDateStr(h.holiday_date)));
    for (const r of rows) {
      const dStr = toDateStr(r.exam_date);
      const dayOfWeek = getDayOfWeek(r.exam_date);
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.error(`CONSTRAINT VIOLATION (3c): Exam scheduled on weekend (${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}): ${dStr}`);
        t3Pass = false;
      }
      if (holidaySet.has(dStr)) {
        console.error(`CONSTRAINT VIOLATION (3c): Exam scheduled on holiday: ${dStr}`);
        t3Pass = false;
      }
    }

    // d. Student A never has more than 2 papers on same date. Student B/C/D/E never more than 1.
    const studentDailyCounts = new Map();
    for (const r of rows) {
      const dStr = toDateStr(r.exam_date);
      const key = `${r.roll_no}:${dStr}`;
      studentDailyCounts.set(key, (studentDailyCounts.get(key) || 0) + 1);
    }
    for (const [key, count] of studentDailyCounts.entries()) {
      const [rollNo, dStr] = key.split(':');
      if (rollNo === 'CS2023001' && count > 2) {
        console.error(`CONSTRAINT VIOLATION (3d): Student A has ${count} (>2) papers on ${dStr}!`);
        t3Pass = false;
      }
      if (rollNo !== 'CS2023001' && count > 1) {
        console.error(`CONSTRAINT VIOLATION (3d): Student ${rollNo} has ${count} (>1) papers on ${dStr}!`);
        t3Pass = false;
      }
    }

    // e. All rows have status = 'draft'
    for (const r of rows) {
      if (r.status !== 'draft') {
        console.error(`CONSTRAINT VIOLATION (3e): Row ${r.id} has status '${r.status}' instead of 'draft'!`);
        t3Pass = false;
      }
    }

    if (t3Pass && rows.length === 26) {
      results.test3 = 'PASS';
      console.log('>>> TEST 3 RESULT: PASS (All constraints 3a, 3b, 3c, 3d, 3e verified successfully)\n');
    } else {
      results.test3 = 'FAIL';
      console.log('>>> TEST 3 RESULT: FAIL\n');
    }
  } catch (err) {
    console.error('TEST 3 Error:', err);
    results.test3 = 'FAIL';
  }

  // ---------------------------------------------------------------
  // TEST 4: Call PUT /api/scheduling/exam/:id with a conflicting slot (student conflict)
  // ---------------------------------------------------------------
  console.log('--- TEST 4: Conflict check rejection (HTTP 409) ---');
  try {
    // Find two exams for Student A scheduled on DIFFERENT time slots or dates
    const stAExams = await db.query(`
      SELECT es.id, es.exam_date, es.time_slot, es.room_id
      FROM exam_schedule es
      JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
      JOIN students st ON bp.student_id = st.id
      WHERE st.roll_no = 'CS2023001'
      ORDER BY es.exam_date ASC, es.time_slot ASC
    `);

    const exam1 = stAExams.rows[0]; // e.g. slot '09:00-12:00' on Date 1
    const exam2 = stAExams.rows[1]; // target to move into exam1's exact slot

    const exam1DateStr = toDateStr(exam1.exam_date);

    console.log(`Attempting to move Exam ID ${exam2.id} to slot already occupied by Exam ID ${exam1.id} (${exam1DateStr} ${exam1.time_slot})...`);

    const putRes = await req('PUT', `/scheduling/exam/${exam2.id}`, {
      exam_date: exam1DateStr,
      time_slot: exam1.time_slot,
      room_id: exam1.room_id
    }, token);

    let rejectedWith409 = false;
    if (putRes.status === 409) {
      rejectedWith409 = true;
      console.log(`Success: Received expected HTTP 409 Conflict with message: "${putRes.data.error}"`);
    } else {
      console.error(`Received unexpected status: ${putRes.status}`, putRes.data);
    }

    // Verify database was NOT modified
    const checkExam2 = await db.query('SELECT exam_date, time_slot, is_manual_override FROM exam_schedule WHERE id = $1', [exam2.id]);
    const unchanged = checkExam2.rows[0].is_manual_override === false;

    if (rejectedWith409 && unchanged) {
      results.test4 = 'PASS';
      console.log('>>> TEST 4 RESULT: PASS (Conflict correctly caught, DB left unchanged)\n');
    } else {
      results.test4 = 'FAIL';
      console.log('>>> TEST 4 RESULT: FAIL\n');
    }
  } catch (err) {
    console.error('TEST 4 Error:', err);
    results.test4 = 'FAIL';
  }

  // ---------------------------------------------------------------
  // TEST 5: Call PUT /api/scheduling/exam/:id with a genuinely free slot
  // ---------------------------------------------------------------
  console.log('--- TEST 5: Manual override update on genuinely free slot ---');
  try {
    // Pick an exam to update (e.g. Student C's backlog)
    const stCExam = await db.query(`
      SELECT es.id, es.exam_date, es.time_slot, es.room_id
      FROM exam_schedule es
      JOIN backlog_papers bp ON es.backlog_paper_id = bp.id
      JOIN students st ON bp.student_id = st.id
      WHERE st.roll_no = 'CS2023003'
      LIMIT 1
    `);
    const targetExamId = stCExam.rows[0].id;

    // Pick a date far in the future on a weekday (e.g. 2026-11-10 Tuesday) in Room 1
    const roomsRes = await db.query('SELECT id FROM rooms LIMIT 1');
    const freeRoomId = roomsRes.rows[0].id;
    const freeDate = '2026-11-10'; // Tuesday
    const freeSlot = '14:00-17:00';

    console.log(`Updating Exam ID ${targetExamId} to free slot: ${freeDate} ${freeSlot} Room ID ${freeRoomId}...`);

    const updateRes = await req('PUT', `/scheduling/exam/${targetExamId}`, {
      exam_date: freeDate,
      time_slot: freeSlot,
      room_id: freeRoomId
    }, token);

    // Verify DB update and is_manual_override = true
    const verifyRow = await db.query(`
      SELECT id, exam_date, time_slot, room_id, is_manual_override 
      FROM exam_schedule 
      WHERE id = $1
    `, [targetExamId]);

    const row = verifyRow.rows[0];
    const rowDateStr = toDateStr(row.exam_date);

    const isUpdated = rowDateStr === freeDate && row.time_slot === freeSlot && row.room_id === freeRoomId && row.is_manual_override === true;

    // Verify other rows did NOT have is_manual_override changed
    const otherOverridesRes = await db.query(`
      SELECT COUNT(*)::int AS count 
      FROM exam_schedule 
      WHERE is_manual_override = true AND id != $1
    `, [targetExamId]);

    const onlyTargetOverridden = otherOverridesRes.rows[0].count === 0;

    if (isUpdated && onlyTargetOverridden) {
      results.test5 = 'PASS';
      console.log('>>> TEST 5 RESULT: PASS (Updated successfully and set is_manual_override = true on that row only)\n');
    } else {
      results.test5 = 'FAIL';
      console.log(`Debug test 5: isUpdated=${isUpdated}, onlyTargetOverridden=${onlyTargetOverridden}, count=${otherOverridesRes.rows[0].count}`);
      console.log('>>> TEST 5 RESULT: FAIL\n');
    }
  } catch (err) {
    console.error('TEST 5 Error:', err);
    results.test5 = 'FAIL';
  }

  // ---------------------------------------------------------------
  // TEST 6: Re-run POST /api/scheduling/generate a second time (Idempotence & Approved protection)
  // ---------------------------------------------------------------
  console.log('--- TEST 6: Re-run POST /api/scheduling/generate (Idempotence test) ---');
  try {
    // Add a fake 'approved' row to test that approved rows are protected
    // Pick one draft row and update its status to 'approved'
    const pickDraft = await db.query('SELECT id FROM exam_schedule LIMIT 1');
    const draftId = pickDraft.rows[0].id;
    await db.query(`UPDATE exam_schedule SET status = 'approved' WHERE id = $1`, [draftId]);

    console.log(`Marked Exam Schedule ID ${draftId} as 'approved' to verify protection.`);

    // Re-run generate
    const regenRes = await req('POST', '/scheduling/generate', { academic_year: '2026-2027' }, token);
    console.log('Re-generation response message:', regenRes.data.message);

    // Verify approved row is still intact!
    const checkApproved = await db.query('SELECT id, status FROM exam_schedule WHERE id = $1', [draftId]);
    const approvedPreserved = checkApproved.rows.length === 1 && checkApproved.rows[0].status === 'approved';

    // Verify total count and no duplicates
    const totalCountRes = await db.query("SELECT COUNT(*)::int as count FROM exam_schedule WHERE academic_year = '2026-2027'");
    console.log(`Total exam rows after regeneration: ${totalCountRes.rows[0].count}`);

    // Revert approved row back for cleanliness
    await db.query(`UPDATE exam_schedule SET status = 'draft' WHERE id = $1`, [draftId]);

    // Finally, re-run clean generation so all 26 backlogs are cleanly draft
    await req('POST', '/scheduling/generate', { academic_year: '2026-2027' }, token);
    const finalCount = await db.query("SELECT COUNT(*)::int as count FROM exam_schedule WHERE academic_year = '2026-2027'");

    if (approvedPreserved && finalCount.rows[0].count === 26) {
      results.test6 = 'PASS';
      console.log('>>> TEST 6 RESULT: PASS (Regenerates cleanly, preserves approved rows, no duplicates)\n');
    } else {
      results.test6 = 'FAIL';
      console.log('>>> TEST 6 RESULT: FAIL\n');
    }
  } catch (err) {
    console.error('TEST 6 Error:', err);
    results.test6 = 'FAIL';
  }

  console.log('====================================================');
  console.log('TEST SUITE SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
  console.log('====================================================');
  
  process.exit(Object.values(results).includes('FAIL') ? 1 : 0);
}

runTestSuite().catch(e => {
  console.error('Fatal error running test suite:', e);
  process.exit(1);
});
