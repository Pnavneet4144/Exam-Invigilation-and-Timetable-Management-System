const db = require('./index');
async function run() {
  await db.query(`
    INSERT INTO exam_time_slots (academic_year, exam_type, slot_label, start_time, end_time)
    VALUES 
    ('2026-2027', 'backlog', 'Morning Slot', '09:00:00', '12:00:00'),
    ('2026-2027', 'backlog', 'Afternoon Slot', '14:00:00', '17:00:00')
    ON CONFLICT DO NOTHING
  `);
  console.log("Seeded time slots");
  process.exit(0);
}
run();
