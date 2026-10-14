const fs = require('fs');
function addRoutes(file) {
  let code = fs.readFileSync(file, 'utf8');
  if(!code.includes('export/pdf')) {
    code = code.replace('module.exports = router;', "router.get('/export/pdf', ctrl.exportPDF);\nrouter.get('/export/excel', ctrl.exportExcel);\n\nmodule.exports = router;");
    fs.writeFileSync(file, code);
  }
}
addRoutes('backend/routes/scheduling.js');
addRoutes('backend/routes/duties.js');
addRoutes('backend/routes/regularDuty.js');
