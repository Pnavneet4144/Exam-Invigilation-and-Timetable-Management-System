const fs = require('fs');
let content = fs.readFileSync('backend/controllers/importController.js', 'utf8');

// Patch seatingPlanPreview
content = content.replace(
  "const { blocks, warnings, branch_semester_columns } = parseSeatingPlan(req.file.buffer, req.file.originalname);",
  "const { blocks, warnings, branch_semester_columns, exam_period_found, start_date, end_date } = parseSeatingPlan(req.file.buffer, req.file.originalname);"
);

content = content.replace(
  "    const previewId = storePreview({\n      type: 'seating_plan',\n      blocksToCreate,\n      roomsToCreate,\n      warnings,\n      academicYear\n    });",
  "    const previewId = storePreview({\n      type: 'seating_plan',\n      blocksToCreate,\n      roomsToCreate,\n      warnings,\n      academicYear,\n      exam_period_found,\n      start_date,\n      end_date\n    });"
);

content = content.replace(
  "    res.json({\n      preview_id: previewId,\n      blocks_to_create: blocksToCreate,\n      warnings,\n      branch_semester_columns,\n      total_blocks: blocksToCreate.length,\n      rooms_to_create: roomsToCreate\n    });",
  "    res.json({\n      preview_id: previewId,\n      blocks_to_create: blocksToCreate,\n      warnings,\n      branch_semester_columns,\n      total_blocks: blocksToCreate.length,\n      rooms_to_create: roomsToCreate,\n      exam_period_found,\n      start_date,\n      end_date\n    });"
);

// Patch commitSeatingPlan
// In importController.js, the commit logic is inside confirmImport or a helper function. Let's see.
// Based on the grep, it looks like `commitSeatingPlan` exists but I need to check how it's called or if it's inline.
fs.writeFileSync('backend/controllers/importController.js', content);
