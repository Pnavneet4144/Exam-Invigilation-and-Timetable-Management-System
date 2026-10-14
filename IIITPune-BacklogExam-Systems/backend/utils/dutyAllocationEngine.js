const DESIGNATION_WEIGHTS = {
  'Assistant Professor': 3.0,
  'Associate Professor': 2.0,
  'Professor': 1.0,
  'HOD': 0.5
};

const MAX_STUDENTS_PER_INVIGILATOR = 40;

function getWeight(designation) {
  return DESIGNATION_WEIGHTS[designation] || 1.0;
}

function allocateDuties({ examSlots, faculty, existingDuties }) {
  const dutyCountMap = {};
  for (const f of faculty) dutyCountMap[f.id] = 0;
  for (const duty of existingDuties) {
    if (dutyCountMap[duty.faculty_id] !== undefined) dutyCountMap[duty.faculty_id]++;
  }

  const bookingMap = {};
  for (const f of faculty) bookingMap[f.id] = new Set();
  for (const duty of existingDuties) {
    if (bookingMap[duty.faculty_id]) {
      bookingMap[duty.faculty_id].add(`${duty.exam_date}|${duty.time_slot}`);
    }
  }

  // 1. Group exam slots by room_id, exam_date, time_slot
  const groupsMap = {};
  for (const slot of examSlots) {
    const groupKey = `${slot.room_id}|${slot.exam_date}|${slot.time_slot}`;
    if (!groupsMap[groupKey]) {
      groupsMap[groupKey] = {
        room_id: slot.room_id,
        exam_date: slot.exam_date,
        time_slot: slot.time_slot,
        slots: []
      };
    }
    groupsMap[groupKey].slots.push(slot);
  }

  const sortedGroups = Object.values(groupsMap).sort((a, b) => {
    const dateCompare = String(a.exam_date).localeCompare(String(b.exam_date));
    if (dateCompare !== 0) return dateCompare;
    return String(a.time_slot).localeCompare(String(b.time_slot));
  });

  const assignments = [];
  const warnings = [];

  for (const group of sortedGroups) {
    const slotKey = `${group.exam_date}|${group.time_slot}`;
    const requiredInvigilators = group.slots.length > MAX_STUDENTS_PER_INVIGILATOR ? 2 : 1;

    const eligible = faculty.filter(f => {
      if (!f.is_available) return false;
      const currentCount = dutyCountMap[f.id] || 0;
      if (currentCount >= f.max_duty_load) return false;
      if (bookingMap[f.id] && bookingMap[f.id].has(slotKey)) return false;
      return true;
    });

    if (eligible.length < requiredInvigilators) {
      warnings.push({
        exam_schedule_id: group.slots[0].id, // Just pass one for reference
        exam_date: group.exam_date,
        time_slot: group.time_slot,
        reason: `Needed ${requiredInvigilators} invigilator(s) but found ${eligible.length} eligible faculty available.`
      });
      continue;
    }

    const scored = eligible.map(f => {
      const remainingCapacity = f.max_duty_load - (dutyCountMap[f.id] || 0);
      const weight = getWeight(f.designation);
      return { faculty: f, score: remainingCapacity * weight };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.faculty.id - b.faculty.id;
    });

    const winners = scored.slice(0, requiredInvigilators).map(s => s.faculty);

    // Split the slots among the winners
    const slotsPerWinner = Math.ceil(group.slots.length / requiredInvigilators);
    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      const assignedSlots = group.slots.slice(i * slotsPerWinner, (i + 1) * slotsPerWinner);
      
      for (const slot of assignedSlots) {
        assignments.push({
          exam_schedule_id: slot.id,
          faculty_id: winner.id,
          faculty_name: winner.name,
          faculty_designation: winner.designation
        });
      }

      // Update counts and bookings
      dutyCountMap[winner.id] = (dutyCountMap[winner.id] || 0) + 1;
      if (!bookingMap[winner.id]) bookingMap[winner.id] = new Set();
      bookingMap[winner.id].add(slotKey);
    }
  }

  return { assignments, warnings };
}

module.exports = { allocateDuties, DESIGNATION_WEIGHTS };
