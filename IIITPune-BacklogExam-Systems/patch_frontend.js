const fs = require('fs');

const buttonsUI = `
          <div className="flex gap-2 ml-4">
            <button onClick={() => window.open(\`/api/API_PATH/export/pdf?academic_year=\${encodeURIComponent(academicYear)}\`, '_blank')} className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded border border-red-100 hover:bg-red-100 font-medium flex items-center gap-1">
              <span>📄</span> PDF
            </button>
            <button onClick={() => window.open(\`/api/API_PATH/export/excel?academic_year=\${encodeURIComponent(academicYear)}\`, '_blank')} className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded border border-green-100 hover:bg-green-100 font-medium flex items-center gap-1">
              <span>📊</span> Excel
            </button>
          </div>
`;

function addExportButtons(file, targetStr, apiPath) {
  let code = fs.readFileSync(file, 'utf8');
  if(!code.includes('export/pdf')) {
    code = code.replace(targetStr, targetStr + buttonsUI.replace(/API_PATH/g, apiPath));
    fs.writeFileSync(file, code);
  }
}

// In Scheduling.jsx, we can insert it after the "Refresh Preview" button
addExportButtons('frontend/src/pages/Scheduling.jsx', 
  '<button\n            onClick={() => fetchPreview(academicYear)}\n            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm self-start md:self-auto"\n          >\n            <span>🔄</span> Refresh Preview\n          </button>', 
  'scheduling');

addExportButtons('frontend/src/pages/DutyAllocation.jsx', 
  '<button\n            onClick={() => fetchPreview(academicYear)}\n            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm self-start md:self-auto"\n          >\n            <span>🔄</span> Refresh Preview\n          </button>', 
  'duties');

addExportButtons('frontend/src/pages/RegularDuty.jsx', 
  '<button\n            onClick={handleSubmitForApproval}\n            disabled={pendingCount === 0}\n            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"\n          >\n            Submit for Approval\n          </button>', 
  'regular-duty');

