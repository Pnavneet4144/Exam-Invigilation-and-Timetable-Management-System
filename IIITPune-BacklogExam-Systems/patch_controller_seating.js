const fs = require('fs');

let content = fs.readFileSync('backend/controllers/importController.js', 'utf8');

// Replace preview logic
const targetPreviewOld = `    const blocksToCreate = [];
    const unmatchedRooms = new Set();

    for (const block of blocks) {
      let roomId = null;
      let matchedRoomNo = block.room_code_raw;

      // Try exact match first
      if (roomMap[block.room_code_raw.toLowerCase()]) {
        roomId = roomMap[block.room_code_raw.toLowerCase()];
        matchedRoomNo = block.room_code_raw;
      } else {
        // Try matching base room code by splitting on last hyphen
        // "LH1-B1" → try "LH1"
        const lastHyphen = block.room_code_raw.lastIndexOf('-');
        if (lastHyphen > 0) {
          const baseRoom = block.room_code_raw.substring(0, lastHyphen);
          if (roomMap[baseRoom.toLowerCase()]) {
            roomId = roomMap[baseRoom.toLowerCase()];
            matchedRoomNo = baseRoom;
          }
        }
      }

      if (!roomId) {
        unmatchedRooms.add(block.room_code_raw);
      }

      blocksToCreate.push({
        room_code_raw: block.room_code_raw,
        room_id: roomId,
        matched_room_no: matchedRoomNo,
        branch: block.branch,
        semester: block.semester,
        roll_no_start: block.roll_no_start,
        roll_no_end: block.roll_no_end,
        floor: block.floor,
        desks: block.desks,
        seating: block.seating
      });
    }

    for (const room of unmatchedRooms) {
      warnings.push(\`Room "\${room}" not found in the rooms table — these blocks will be skipped on confirm unless the room is created first.\`);
    }

    const previewId = storePreview({
      type: 'seating_plan',
      blocksToCreate,
      warnings,
      academicYear
    });

    res.json({
      preview_id: previewId,
      blocks_to_create: blocksToCreate,
      warnings,
      branch_semester_columns,
      total_blocks: blocksToCreate.length,
      unmatched_rooms: Array.from(unmatchedRooms)
    });`;

const targetPreviewNew = `    const blocksToCreate = [];
    const roomsToCreateMap = new Map();

    for (const block of blocks) {
      let roomId = null;
      let matchedRoomNo = block.room_code_raw;

      if (roomMap[block.room_code_raw.toLowerCase()]) {
        roomId = roomMap[block.room_code_raw.toLowerCase()];
        matchedRoomNo = block.room_code_raw;
      } else {
        const lastHyphen = block.room_code_raw.lastIndexOf('-');
        if (lastHyphen > 0) {
          const baseRoom = block.room_code_raw.substring(0, lastHyphen);
          if (roomMap[baseRoom.toLowerCase()]) {
            roomId = roomMap[baseRoom.toLowerCase()];
            matchedRoomNo = baseRoom;
          }
        }
      }

      if (!roomId) {
        if (!roomsToCreateMap.has(block.room_code_raw)) {
           let rtype = null;
           let ppb = 2; // Default 2
           const codeUpper = block.room_code_raw.toUpperCase();
           if (codeUpper.startsWith('LH')) { rtype = 'LH'; ppb = 3; }
           else if (codeUpper.startsWith('CR')) { rtype = 'CR'; ppb = 2; }
           else { warnings.push(\`Room "\${block.room_code_raw}" does not start with LH or CR. Auto-create will leave room_type null.\`); }
           
           roomsToCreateMap.set(block.room_code_raw, {
             room_no: block.room_code_raw,
             building: block.floor,
             capacity: block.desks ? parseInt(block.desks, 10) : 0,
             room_type: rtype,
             people_per_bench: ppb,
             seating_pattern: block.seating
           });
        }
      }

      blocksToCreate.push({
        room_code_raw: block.room_code_raw,
        room_id: roomId,
        matched_room_no: matchedRoomNo,
        branch: block.branch,
        semester: block.semester,
        count: block.count,
        roll_no_start: block.roll_no_start,
        roll_no_end: block.roll_no_end
      });
    }

    const roomsToCreate = Array.from(roomsToCreateMap.values());

    const previewId = storePreview({
      type: 'seating_plan',
      blocksToCreate,
      roomsToCreate,
      warnings,
      academicYear
    });

    res.json({
      preview_id: previewId,
      blocks_to_create: blocksToCreate,
      warnings,
      branch_semester_columns,
      total_blocks: blocksToCreate.length,
      rooms_to_create: roomsToCreate
    });`;

content = content.replace(targetPreviewOld, targetPreviewNew);

// Replace commit logic
const targetCommitOld = `async function commitSeatingPlan(client, preview) {
  let inserted = 0;
  let skipped = 0;
  for (const block of preview.blocksToCreate) {
    if (!block.room_id) {
      skipped++;
      continue;
    }
    await client.query(
      \`INSERT INTO seating_blocks (room_id, semester, branch, roll_no_start, roll_no_end, student_count)
       VALUES ($1, $2, $3, $4, $5, $6)\`,
      [block.room_id, block.semester, block.branch, block.roll_no_start, block.roll_no_end, block.count]
    );
    inserted++;
  }
  return { blocks_inserted: inserted, blocks_skipped_no_room: skipped };
}`;

const targetCommitNew = `async function commitSeatingPlan(client, preview) {
  let roomsInserted = 0;
  const newRoomIds = {};
  
  if (preview.roomsToCreate) {
    for (const r of preview.roomsToCreate) {
      const res = await client.query(
        \`INSERT INTO rooms (room_no, building, capacity, room_type, people_per_bench, seating_pattern)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (room_no) DO UPDATE SET room_no = EXCLUDED.room_no
         RETURNING id\`,
        [r.room_no, r.building, r.capacity || 0, r.room_type, r.people_per_bench || 2, r.seating_pattern]
      );
      newRoomIds[r.room_no] = res.rows[0].id;
      roomsInserted++;
    }
  }

  let inserted = 0;
  let skipped = 0;
  for (const block of preview.blocksToCreate) {
    const finalRoomId = block.room_id || newRoomIds[block.room_code_raw];
    if (!finalRoomId) {
      skipped++;
      continue;
    }
    await client.query(
      \`INSERT INTO seating_blocks (room_id, semester, branch, roll_no_start, roll_no_end, student_count)
       VALUES ($1, $2, $3, $4, $5, $6)\`,
      [finalRoomId, block.semester, block.branch, block.roll_no_start, block.roll_no_end, block.count]
    );
    inserted++;
  }
  return { rooms_auto_created: roomsInserted, blocks_inserted: inserted, blocks_skipped_no_room: skipped };
}`;

content = content.replace(targetCommitOld, targetCommitNew);

fs.writeFileSync('backend/controllers/importController.js', content);
