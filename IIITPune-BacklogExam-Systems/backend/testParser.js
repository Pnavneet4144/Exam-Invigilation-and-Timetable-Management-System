const { parseSeatingPlan } = require('./utils/seatingPlanParser');
const rewire = require('rewire');
const parser = rewire('./utils/seatingPlanParser.js');
const parseCellValue = parser.__get__('parseCellValue');

const testCases = [
  "2[112415122-112415123]+112215197+112315171",
  "23(19+4).",
  "15[112315204-112315218]+112215023",
  "1[112316056]+112216028"
];

testCases.forEach((tc, idx) => {
  const result = parseCellValue(tc, idx + 1, "CR1", "CSE", 2);
  console.log(`\nTEST ${idx + 1}: "${tc}"`);
  console.log(JSON.stringify(result, null, 2));
});
