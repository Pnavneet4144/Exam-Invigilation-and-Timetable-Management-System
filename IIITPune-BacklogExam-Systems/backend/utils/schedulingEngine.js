/**
 * ============================================================================
 * Backlog Exam Scheduling Engine
 * ============================================================================
 * 
 * A PURE FUNCTION that takes input data and returns a proposed exam schedule.
 * No database calls, no Express dependencies — easy to test and explain.
 * 
 * ALGORITHM SUMMARY (Greedy Front-Loading):
 * -----------------------------------------
 * Goal: Schedule every student's backlog papers as early and as densely as
 *       possible, respecting per-student pacing limits, room capacities,
 *       and holiday/weekend exclusions.
 * 
 * Approach:
 *   1. Sort students by number of backlogs (most backlogs first) so the
 *      heaviest-loaded students get priority in slot assignment.
 *   2. Iterate through calendar dates chronologically (skipping weekends
 *      and holidays).
 *   3. For each date, iterate through time slots (morning, afternoon).
 *   4. For each slot, try to assign as many unscheduled papers as possible
 *      to students, subject to:
 *        - Student hasn't exceeded their papers_per_day limit for this date
 *        - Student doesn't already have an exam in this exact time slot
 *        - At least one room has remaining capacity in this slot
 *   5. Continue until all papers are scheduled or we run out of dates.
 * 
 * WHY THIS WORKS:
 *   By iterating dates in order and greedily filling each slot before moving
 *   to the next, we naturally minimize the total schedule span. Papers are
 *   packed as early as possible — a student can have exams on consecutive
 *   days, or even 2 per day if their pacing allows it.
 * 
 * INPUTS:
 *   @param {Array} backlogPapers - [{id, student_id, subject_id}] all pending
 *   @param {Array} students      - [{id, roll_no, name}] student details
 *   @param {Array} studentPacing - [{student_id, papers_per_day}] pacing config
 *   @param {Array} rooms         - [{id, room_no, capacity}] available rooms
 *   @param {Array} holidays      - ['YYYY-MM-DD', ...] dates to skip
 *   @param {String} startDate    - 'YYYY-MM-DD' first possible exam date
 * 
 * OUTPUT:
 *   {
 *     scheduled: [{backlog_paper_id, room_id, exam_date, time_slot}],
 *     unscheduled: [{backlog_paper_id, student_id, reason}],
 *     summary: {total, scheduled_count, unscheduled_count, date_span}
 *   }
 * ============================================================================
 */

// Maximum number of calendar dates to generate before giving up
// (prevents infinite loops if there are more papers than capacity)
const MAX_DATE_WINDOW = 120; // ~4 months of working days

/**
 * Main entry point — the pure scheduling function.
 */
function generateSchedule(backlogPapers, students, studentPacing, rooms, holidays, startDate, timeSlots) {
  // If timeSlots is missing or empty, fallback (though controller should prevent this)
  const slots = (timeSlots && timeSlots.length > 0) ? timeSlots : ['09:00-12:00', '14:00-17:00'];
  // =========================================================================
  // STEP 1: INPUT VALIDATION & EDGE CASES
  // =========================================================================

  // If there are no backlog papers to schedule, return early
  if (!backlogPapers || backlogPapers.length === 0) {
    return {
      scheduled: [],
      unscheduled: [],
      summary: { total: 0, scheduled_count: 0, unscheduled_count: 0, date_span: 0 }
    };
  }

  // If there are no rooms, nothing can be scheduled
  if (!rooms || rooms.length === 0) {
    return {
      scheduled: [],
      unscheduled: backlogPapers.map(p => ({
        backlog_paper_id: p.id,
        student_id: p.student_id,
        reason: 'No rooms available for scheduling'
      })),
      summary: { total: backlogPapers.length, scheduled_count: 0, unscheduled_count: backlogPapers.length, date_span: 0 }
    };
  }

  // =========================================================================
  // STEP 2: BUILD LOOKUP MAPS
  // =========================================================================

  /**
   * studentPapersMap: { student_id → [backlog_paper objects] }
   * Groups all pending papers by student, so we can process each student's
   * papers in order.
   */
  const studentPapersMap = {};
  for (const paper of backlogPapers) {
    if (!studentPapersMap[paper.student_id]) {
      studentPapersMap[paper.student_id] = [];
    }
    studentPapersMap[paper.student_id].push({ ...paper, scheduled: false });
  }

  /**
   * pacingMap: { student_id → papers_per_day }
   * How many of their OWN papers each student can have on a single calendar date.
   * Defaults to 1 if no pacing record exists for a student.
   */
  const pacingMap = {};
  for (const pacing of studentPacing) {
    pacingMap[pacing.student_id] = pacing.papers_per_day;
  }

  /**
   * Sort student IDs by number of backlogs (descending).
   * Rationale: Students with the most backlogs are hardest to schedule,
   * so they get first pick of slots. This avoids situations where a
   * student with 20 papers gets pushed out because all slots were taken
   * by students with 1-2 papers each.
   */
  const sortedStudentIds = Object.keys(studentPapersMap)
    .map(Number)
    .sort((a, b) => studentPapersMap[b].length - studentPapersMap[a].length);

  /**
   * Total capacity per slot = sum of all room capacities.
   * Used to detect when we've exhausted all room space in a slot.
   */
  const totalCapacityPerSlot = rooms.reduce((sum, room) => sum + room.capacity, 0);

  // =========================================================================
  // STEP 3: GENERATE WORKING DATES
  // =========================================================================

  /**
   * Build the list of valid exam dates by starting from startDate and
   * skipping Saturdays (6), Sundays (0), and holidays.
   */
  const holidaySet = new Set(
    holidays.map(h => typeof h === 'string' ? h : h.toISOString().split('T')[0])
  );

  const workingDates = [];
  const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
  const start = new Date(sYear, sMonth - 1, sDay, 12, 0, 0);
  // Ensure we start from a valid date
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid start date: ${startDate}`);
  }

  let currentDate = new Date(start);
  let daysChecked = 0;

  while (workingDates.length < MAX_DATE_WINDOW && daysChecked < MAX_DATE_WINDOW * 2) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = formatDate(currentDate);

    // Skip Saturdays (6) and Sundays (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      workingDates.push(dateStr);
    }

    // Move to next calendar day
    currentDate.setDate(currentDate.getDate() + 1);
    daysChecked++;
  }

  // =========================================================================
  // STEP 4: GREEDY FRONT-LOADING SCHEDULER
  // =========================================================================

  const scheduled = [];      // Successfully scheduled papers
  let totalScheduled = 0;    // Counter for scheduled papers
  const totalToSchedule = backlogPapers.length;

  /**
   * Track how many papers each student has been assigned on each date.
   * Structure: { 'student_id:YYYY-MM-DD' → count }
   * Used to enforce the papers_per_day limit.
   */
  const studentDateCounts = {};

  /**
   * Track which students are already booked in a specific time slot.
   * Structure: Set of 'student_id:YYYY-MM-DD:time_slot'
   * Used to prevent double-booking a student in the same slot.
   */
  const studentSlotBooked = new Set();

  /**
   * Track how many students are assigned to each room in each slot.
   * Structure: { 'room_id:YYYY-MM-DD:time_slot' → count }
   * Used to enforce room capacity limits.
   */
  const roomSlotUsage = {};

  // Iterate through each working date, chronologically
  for (const date of workingDates) {
    // If all papers are scheduled, stop early
    if (totalScheduled >= totalToSchedule) break;

    // Iterate through each time slot on this date
    for (const slot of slots) {
      if (totalScheduled >= totalToSchedule) break;

      // Try to assign papers for each student in priority order
      for (const studentId of sortedStudentIds) {
        if (totalScheduled >= totalToSchedule) break;

        const papers = studentPapersMap[studentId];
        const maxPerDay = pacingMap[studentId] || 1; // Default: 1 paper/day

        // -------------------------------------------------------------------
        // CHECK 1: Has this student reached their daily paper limit?
        // -------------------------------------------------------------------
        const dateKey = `${studentId}:${date}`;
        const currentDayCount = studentDateCounts[dateKey] || 0;
        if (currentDayCount >= maxPerDay) {
          // Student has already been assigned their max papers for today
          continue;
        }

        // -------------------------------------------------------------------
        // CHECK 2: Is this student already booked in THIS time slot?
        // A student can't sit for two exams at the same time.
        // -------------------------------------------------------------------
        const slotKey = `${studentId}:${date}:${slot}`;
        if (studentSlotBooked.has(slotKey)) {
          continue;
        }

        // -------------------------------------------------------------------
        // CHECK 3: Find the next unscheduled paper for this student
        // -------------------------------------------------------------------
        const nextPaper = papers.find(p => !p.scheduled);
        if (!nextPaper) {
          // All of this student's papers are already scheduled
          continue;
        }

        // -------------------------------------------------------------------
        // CHECK 4: Find a room with available capacity in this slot
        // -------------------------------------------------------------------
        let assignedRoom = null;
        for (const room of rooms) {
          const roomKey = `${room.id}:${date}:${slot}`;
          const currentUsage = roomSlotUsage[roomKey] || 0;
          if (currentUsage < room.capacity) {
            assignedRoom = room;
            // Increment room usage
            roomSlotUsage[roomKey] = currentUsage + 1;
            break;
          }
        }

        if (!assignedRoom) {
          // No room has capacity in this slot — move on.
          // The paper may be picked up in the next slot or next date.
          continue;
        }

        // -------------------------------------------------------------------
        // ASSIGN: Schedule this paper
        // -------------------------------------------------------------------
        nextPaper.scheduled = true;
        totalScheduled++;

        scheduled.push({
          backlog_paper_id: nextPaper.id,
          room_id: assignedRoom.id,
          exam_date: date,
          time_slot: slot
        });

        // Update tracking structures
        studentDateCounts[dateKey] = currentDayCount + 1;
        studentSlotBooked.add(slotKey);
      }
    }
  }

  // =========================================================================
  // STEP 5: COLLECT UNSCHEDULED PAPERS (if any)
  // =========================================================================

  /**
   * Any paper that didn't get assigned (usually because room capacity
   * was exhausted across all available dates) is reported as unscheduled.
   */
  const unscheduled = [];
  for (const studentId of sortedStudentIds) {
    for (const paper of studentPapersMap[studentId]) {
      if (!paper.scheduled) {
        unscheduled.push({
          backlog_paper_id: paper.id,
          student_id: paper.student_id,
          reason: 'Insufficient room capacity or date window exhausted'
        });
      }
    }
  }

  // =========================================================================
  // STEP 6: BUILD SUMMARY
  // =========================================================================

  // Calculate the date span (number of unique dates used)
  const usedDates = new Set(scheduled.map(s => s.exam_date));
  const dateSpan = usedDates.size;

  return {
    scheduled,
    unscheduled,
    summary: {
      total: totalToSchedule,
      scheduled_count: totalScheduled,
      unscheduled_count: unscheduled.length,
      date_span: dateSpan,
      first_date: scheduled.length > 0 ? scheduled[0].exam_date : null,
      last_date: scheduled.length > 0 ? scheduled[scheduled.length - 1].exam_date : null
    }
  };
}

// =============================================================================
// HELPER: Format a Date object as 'YYYY-MM-DD' string
// =============================================================================
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { generateSchedule };
