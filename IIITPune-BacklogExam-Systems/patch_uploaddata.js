const fs = require('fs');
let content = fs.readFileSync('frontend/src/pages/UploadData.jsx', 'utf8');

content = content.replace(
  "const [preview, setPreview] = useState(null);",
  "const [preview, setPreview] = useState(null);\n  const [manualStartDate, setManualStartDate] = useState('');\n  const [manualEndDate, setManualEndDate] = useState('');"
);

content = content.replace(
  "      const res = await api.post(`/import/confirm/${preview.preview_id}`);",
  "      const payload = {};\n      if (previewType === 'seating' && preview.exam_period_found === false) {\n        if (!manualStartDate || !manualEndDate) { toast.error('Start and end dates are required'); setLoading(false); return; }\n        payload.manual_start_date = manualStartDate;\n        payload.manual_end_date = manualEndDate;\n      }\n      const res = await api.post(`/import/confirm/${preview.preview_id}`, payload);"
);

// Add input fields to the preview section
const uiBlockOld = `
          {previewType === 'seating' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Seating Blocks to Create</h4>
                <p className="text-2xl font-bold text-blue-700">{preview.total_blocks}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Rooms to Auto-Create</h4>
                <p className="text-2xl font-bold text-green-700">{preview.rooms_to_create?.length || 0}</p>
              </div>
            </div>
          )}
`;

const uiBlockNew = `
          {previewType === 'seating' && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Seating Blocks to Create</h4>
                  <p className="text-2xl font-bold text-blue-700">{preview.total_blocks}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Rooms to Auto-Create</h4>
                  <p className="text-2xl font-bold text-green-700">{preview.rooms_to_create?.length || 0}</p>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                {preview.exam_period_found ? (
                  <div>
                    <h4 className="font-semibold text-gray-900">Exam Period Found in File Header:</h4>
                    <p className="text-sm text-gray-700">Start: <strong>{preview.start_date}</strong> &nbsp;|&nbsp; End: <strong>{preview.end_date}</strong></p>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-semibold text-red-600 mb-2">⚠ No Exam Period found in file header!</h4>
                    <p className="text-sm text-gray-600 mb-3">Please enter the start and end dates manually for this main exam period.</p>
                    <div className="flex gap-4">
                      <div>
                        <label className="block text-xs font-semibold">Start Date</label>
                        <input type="date" value={manualStartDate} onChange={e => setManualStartDate(e.target.value)} className="border p-1 rounded text-sm"/>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold">End Date</label>
                        <input type="date" value={manualEndDate} onChange={e => setManualEndDate(e.target.value)} className="border p-1 rounded text-sm"/>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
`;

content = content.replace(uiBlockOld, uiBlockNew);

fs.writeFileSync('frontend/src/pages/UploadData.jsx', content);
