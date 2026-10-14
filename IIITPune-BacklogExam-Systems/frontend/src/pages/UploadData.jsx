
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function UploadData() {
  const uploadSections = [
    {
      title: 'Upload Students',
      description: 'Expected columns: Roll No, Name, Department, Semester, Email',
      endpoint: '/upload/students'
    },
    {
      title: 'Upload Subjects',
      description: 'Expected columns: Subject Code, Subject Name, Semester, Department',
      endpoint: '/upload/subjects'
    },
    {
      title: 'Upload Rooms',
      description: 'Expected columns: Room No, Building, Capacity',
      endpoint: '/upload/rooms'
    },
    {
      title: 'Upload Faculty',
      description: 'Expected columns: Name, Department, Designation, Email, Max Duty Load, Available',
      endpoint: '/upload/faculty'
    }
  ];

  const advancedSections = [
    {
      title: 'Faculty Roster (Extract Names)',
      description: 'Upload pivot-style duty roster to extract unique faculty names into the system.',
      endpoint: '/import/faculty-roster/preview',
      type: 'faculty',
      needsYear: false
    },
    {
      title: 'Seating Plan',
      description: 'Upload matrix seating plan mapping room, branch, semester to roll number ranges.',
      endpoint: '/import/seating-plan/preview',
      type: 'seating',
      needsYear: true
    },
    {
      title: 'Backlog Matrix',
      description: 'Upload wide pivot format for students vs subject backlogs to bulk create pending papers.',
      endpoint: '/import/backlog-matrix/preview',
      type: 'backlog',
      needsYear: true
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Standard Data Upload</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {uploadSections.map((section, idx) => (
            <UploadCard key={idx} section={section} />
          ))}
        </div>
      </div>
      
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-6 border-t pt-8">Advanced Imports (2-Step Preview)</h1>
        <div className="grid grid-cols-1 gap-6">
          {advancedSections.map((section, idx) => (
            <AdvancedImportCard key={idx} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadCard({ section }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null); // Clear previous results
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    setResult(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await api.post(section.endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setResult(response.data);
      toast.success(`${section.title} uploaded successfully!`);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Upload failed';
      toast.error(errorMessage);
      if (err.response?.data?.details) {
         setResult({ error: errorMessage, details: err.response.data.details });
      }
    } finally {
      setLoading(false);
      setFile(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
      <h3 className="text-lg font-bold text-gray-800 mb-2">{section.title}</h3>
      <p className="text-sm text-gray-500 mb-4 flex-1">{section.description}</p>
      
      <div className="mb-4">
        <input 
          type="file" 
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary-700 hover:file:bg-blue-100 cursor-pointer"
        />
      </div>
      
      <button 
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-md transition-colors flex justify-center items-center h-10 mb-4"
      >
        {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> : 'Upload'}
      </button>

      {/* Result Panel */}
      {result && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm border border-gray-200 max-h-48 overflow-y-auto">
            {result.error && !result.success && result.success !== 0 ? (
             <div className="text-red-600 font-medium mb-2">{result.error}</div>
           ) : (
            <div className="flex space-x-2 mb-3">
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md font-medium text-xs">
                {result.success || 0} rows uploaded successfully
              </span>
              {(result.failed > 0) && (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md font-medium text-xs">
                  {result.failed} rows failed
                </span>
              )}
            </div>
          )}
          
          {result.errors && result.errors.length > 0 && (
            <div className="text-red-600 space-y-1">
              {result.errors.map((err, i) => (
                <div key={i}>Row {err.row || '?'}: {err.error || err.message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdvancedImportCard({ section }) {
  const [file, setFile] = useState(null);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setPreview(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setPreview(null);
    
    const formData = new FormData();
    formData.append('file', file);
    if (section.needsYear) {
      formData.append('academic_year', academicYear);
    }
    
    try {
      const response = await api.post(section.endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(response.data);
      toast.success('Preview generated! Please review.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Preview failed');
    } finally {
      setLoading(false);
      document.getElementById(`file-input-${section.type}`).value = '';
      setFile(null);
    }
  };

  const handleConfirm = async () => {
    if (!preview?.preview_id) return;
    setLoading(true);
    try {
      const payload = {};
      if (section.type === 'seating' && preview.exam_period_found === false) {
        if (!manualStartDate || !manualEndDate) { toast.error('Start and end dates are required'); setLoading(false); return; }
        payload.manual_start_date = manualStartDate;
        payload.manual_end_date = manualEndDate;
      }
      const res = await api.post(`/import/confirm/${preview.preview_id}`, payload);
      toast.success(res.data.message || 'Import successful!');
      setPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!preview?.preview_id) return;
    try {
      await api.post(`/import/cancel/${preview.preview_id}`);
      toast.success('Preview discarded');
    } catch (err) {
      // Ignore errors on cancel
    } finally {
      setPreview(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-6 items-start">
      <div className="flex-1 w-full">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{section.title}</h3>
        <p className="text-sm text-gray-500 mb-4">{section.description}</p>
        
        <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
          <div className="flex-1">
            <input 
              id={`file-input-${section.type}`}
              type="file" 
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-primary-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>
          {section.needsYear && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Academic Year</label>
              <input
                type="text"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-32"
              />
            </div>
          )}
          <button 
            onClick={handlePreview}
            disabled={!file || loading}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-medium py-2 px-6 rounded-md transition-colors flex justify-center items-center h-10"
          >
            {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> : 'Upload & Preview'}
          </button>
        </div>
      </div>
      
      {/* PREVIEW PANEL */}
      {preview && (
        <div className="w-full md:w-1/2 bg-gray-50 border border-gray-200 rounded-lg p-5">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-gray-800">Preview Results</h4>
            <div className="space-x-2">
              <button onClick={handleCancel} disabled={loading} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-50">Cancel</button>
              <button onClick={handleConfirm} disabled={loading} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Confirm Import</button>
            </div>
          </div>

          <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
            {section.type === 'faculty' && (
              <>
                <p><strong>Found {preview.new_faculty?.length} new faculty</strong> to create.</p>
                <p><strong>Found {preview.existing_matches?.length} existing faculty</strong> (will be skipped).</p>
                {preview.new_faculty?.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-primary-600 font-medium">View new faculty</summary>
                    <ul className="list-disc pl-5 mt-1 text-gray-600">
                      {preview.new_faculty.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </details>
                )}
              </>
            )}

            {section.type === 'seating' && (
              <>
                <p><strong>Will create {preview.total_blocks} seating blocks</strong> across {preview.branch_semester_columns?.length} branch-semester combinations.</p>
                {preview.unmatched_rooms?.length > 0 && (
                  <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded mt-2">
                    <p className="font-bold mb-1">Unmatched Rooms ({preview.unmatched_rooms.length}):</p>
                    <ul className="list-disc pl-5 text-xs">
                      {preview.unmatched_rooms.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                    <p className="mt-1 text-xs">Blocks for these rooms will be skipped during import.</p>
                  </div>
                )}
              </>
            )}

            {section.type === 'backlog' && (
              <>
                <ul className="space-y-1 mb-3">
                  <li><strong>New Students:</strong> {preview.students_to_create?.length}</li>
                  <li><strong>Existing Students:</strong> {preview.students_matched?.length}</li>
                  <li><strong>New Subjects:</strong> {preview.subjects_to_create?.length}</li>
                  <li><strong>Existing Subjects:</strong> {preview.subjects_matched?.length}</li>
                  <li><strong>Total Backlogs to Insert:</strong> {preview.backlog_papers_to_create}</li>
                </ul>
              </>
            )}

            {/* General Warnings */}
            {preview.warnings && preview.warnings.length > 0 && (
              <div className="mt-4 p-3 bg-orange-50 text-orange-800 border border-orange-200 rounded">
                <p className="font-bold mb-1 flex items-center gap-2"><span className="text-lg">⚠️</span> Warnings ({preview.warnings.length}):</p>
                <ul className="list-disc pl-5 text-xs space-y-1 max-h-32 overflow-y-auto">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
