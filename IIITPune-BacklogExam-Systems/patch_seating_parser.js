const fs = require('fs');
let content = fs.readFileSync('backend/utils/seatingPlanParser.js', 'utf8');

// The block to replace:
const targetBlock = `    const floor = floorCol !== undefined
      ? (sheet[XLSX.utils.encode_cell({ r, c: parseInt(floorCol) })]?.v || '')
      : '';`;

const newBlock = `    let rowFloor = '';
    if (floorCol !== undefined) {
      const floorCell = sheet[XLSX.utils.encode_cell({ r, c: parseInt(floorCol) })];
      if (floorCell && floorCell.v !== undefined && String(floorCell.v).trim() !== '') {
        rowFloor = String(floorCell.v).trim();
        // Since variables are not scoped correctly if we declare currentFloor here,
        // we should just use a global or outer scope variable.
        // Wait, let's inject currentFloor declaration above the loop.
      }
    }`;

content = content.replace(targetBlock, newBlock);

content = content.replace(
  "const blocks = [];",
  "const blocks = [];\n  let currentFloor = '';"
);

content = content.replace(
  "let rowFloor = '';",
  `let rowFloor = '';
    if (floorCol !== undefined) {
      const floorCell = sheet[XLSX.utils.encode_cell({ r, c: parseInt(floorCol) })];
      if (floorCell && floorCell.v !== undefined && String(floorCell.v).trim() !== '') {
        rowFloor = String(floorCell.v).trim();
        currentFloor = rowFloor;
      } else {
        rowFloor = currentFloor;
      }
    }`
);

// We need to also replace 'floor' with 'rowFloor' inside the block push
content = content.replace(/floor: String\(floor\),/g, "floor: rowFloor,");

fs.writeFileSync('backend/utils/seatingPlanParser.js', content);
