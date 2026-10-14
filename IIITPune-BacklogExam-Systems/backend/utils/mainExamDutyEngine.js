/**
 * Engine for generating main/end-semester exam duty allocations.
 * 
 * Rules:
 * 1. 1 faculty per room per exam date.
 * 2. Rotate faculty (avoid assigning to the same room repeatedly if possible).
 * 3. Faculty cannot be assigned to two rooms on the same date.
 * 4. Distribute load evenly (prioritize faculty with lowest duty count).
 */

function generateMainExamDuties(rooms, examDates, facultyList) {
  const assignments = [];
  const warnings = [];

  // Initialize tracking data structures
  const facultyStats = {};
  for (const f of facultyList) {
    facultyStats[f.id] = {
      id: f.id,
      name: f.name,
      is_available: f.is_available,
      count: 0,
      roomHistory: {}, // room_id -> array of date indexes when assigned
      lastAssignedDateIdx: -1
    };
  }

  // Iterate over each date chronologically
  examDates.forEach((date, dateIdx) => {
    // Faculty used today
    const usedToday = new Set();

    for (const room of rooms) {
      // Find eligible faculty
      const candidates = Object.values(facultyStats).filter(f => f.is_available && !usedToday.has(f.id));

      if (candidates.length === 0) {
        warnings.push(`No available faculty left for Room ${room.room_no} on ${date}`);
        continue;
      }

      // Group candidates by whether they have been assigned to this room before
      const neverAssignedToRoom = candidates.filter(f => !f.roomHistory[room.id] || f.roomHistory[room.id].length === 0);

      let selectedFaculty = null;

      if (neverAssignedToRoom.length > 0) {
        // We have faculty who have never seen this room.
        // Pick the one with the lowest total count.
        neverAssignedToRoom.sort((a, b) => a.count - b.count);
        selectedFaculty = neverAssignedToRoom[0];
      } else {
        // Everyone available has been assigned to this room before.
        // Relax constraint: pick the one assigned to this room LEAST recently.
        // If tie, pick lowest total count.
        candidates.sort((a, b) => {
          const aLastSeen = a.roomHistory[room.id][a.roomHistory[room.id].length - 1];
          const bLastSeen = b.roomHistory[room.id][b.roomHistory[room.id].length - 1];
          if (aLastSeen !== bLastSeen) {
            return aLastSeen - bLastSeen; // Lower index means longer ago
          }
          return a.count - b.count;
        });
        selectedFaculty = candidates[0];
      }

      if (selectedFaculty) {
        assignments.push({
          room_id: room.id,
          room_no: room.room_no,
          exam_date: date,
          faculty_id: selectedFaculty.id,
          faculty_name: selectedFaculty.name
        });

        usedToday.add(selectedFaculty.id);
        selectedFaculty.count += 1;
        selectedFaculty.lastAssignedDateIdx = dateIdx;
        
        if (!selectedFaculty.roomHistory[room.id]) {
          selectedFaculty.roomHistory[room.id] = [];
        }
        selectedFaculty.roomHistory[room.id].push(dateIdx);
      }
    }
  });

  return { assignments, warnings, facultyStats };
}

module.exports = { generateMainExamDuties };
