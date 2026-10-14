import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { downloadExport } from '../utils/downloadExport';

export default function MainExamDuty() {
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [examPeriod, setExamPeriod] = useState(null);
  
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exportLoading, setExportLoading] = useState({ pdf: false, excel: false });
  const [facultyList, setFacultyList] = useState([]);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchFaculty();
  }, []);

  useEffect(() => {
    if (academicYear) {
      fetchPreview();
      checkExamPeriod();
    }
  }, [academicYear]);

  const fetchFaculty = async () => {
    try {
      const res = await api.get('/faculty');
      setFacultyList(res.data.filter(f => f.is_available));
    } catch (err) {
      console.error(err);
    }
  };

  const checkExamPeriod = async () => {
    try {
      const res = await api.get(`/main-exam-duty/preview?academic_year=${encodeURIComponent(academicYear)}`);
      // We can get the period from preview or generate endpoint. 
      // Actually, wait, let's just make a small endpoint or send it in preview.
      // We'll update the backend to include exam_period in the preview response!
    } catch (e) {}
  };

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/main-exam-duty/preview?academic_year=${encodeURIComponent(academicYear)}`);
      setPreviewData(res.data);
      if (res.data.exam_period) {
        setExamPeriod(res.data.exam_period);
      } else {
        setExamPeriod(null);
      }
    } catch (err) {
      toast.error('Failed to load preview');
      setPreviewData(null);
      setExamPeriod(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/main-exam-duty/generate', { academic_year: academicYear });
      toast.success(res.data.message);
      if (res.data.warnings?.length > 0) {
        res.data.warnings.forEach(w => toast.error(w, { duration: 5000 }));
      }
      fetchPreview();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/approvals/submit', { type: 'main_duty', academic_year: academicYear });
      toast.success(res.data.message);
      fetchPreview();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async (format) => {
    const isPdf = format === 'pdf';
    const mimeType = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats';
    const ext = isPdf ? 'pdf' : 'xlsx';
    const filename = `main-exam-duty-${academicYear}.${ext}`;
    setExportLoading(prev => ({ ...prev, [format]: true }));
    try {
      await downloadExport(api, `/main-exam-duty/export/${format}?academic_year=${encodeURIComponent(academicYear)}`, filename, mimeType);
    } catch (err) {
      toast.error(err.message || `Failed to download ${format.toUpperCase()}`);
    } finally {
      setExportLoading(prev => ({ ...prev, [format]: false }));
    }
  };

  const openEditModal = (duty, dateStr, roomNo) => {
    setSelectedCell({ id: duty.id, date: dateStr, room: roomNo });
    setSelectedFacultyId(duty.faculty_id || '');
    setEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedFacultyId) {
      toast.error('Please select a faculty member');
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/main-exam-duty/${selectedCell.id}`, { faculty_id: selectedFacultyId });
      toast.success('Assignment updated');
      setEditModalOpen(false);
      fetchPreview();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  };

  // Prepare Grid Data
  let dates = [];
  let rooms = [];
  let grid = {}; // room_no -> { dateStr -> duty }

  if (previewData && previewData.dutiesByDate) {
    dates = Object.keys(previewData.dutiesByDate).sort();
    const roomSet = new Set();
    dates.forEach(d => {
      previewData.dutiesByDate[d].forEach(duty => {
        roomSet.add(duty.room_no);
        if (!grid[duty.room_no]) grid[duty.room_no] = {};
        grid[duty.room_no][d] = duty;
      });
    });
    rooms = Array.from(roomSet).sort();
  }

  const hasDrafts = dates.some(d => previewData.dutiesByDate[d].some(x => x.status === 'draft'));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Main Exam Duty</h1>
          <p className="text-sm text-gray-500">Regular/End-Semester Exams</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Academic Year:</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm sm:text-sm px-3 py-1.5 border"
          />
          <button
            onClick={handleSubmitForApproval}
            disabled={submitting || !hasDrafts}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exportLoading.pdf || !previewData?.total}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded border border-red-100 hover:bg-red-100 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {exportLoading.pdf ? '⏳' : '📄'} PDF
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={exportLoading.excel || !previewData?.total}
              className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded border border-green-100 hover:bg-green-100 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {exportLoading.excel ? '⏳' : '📊'} Excel
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold mb-4">Generate Duty Roster</h2>
        
        {!examPeriod ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
            ⚠ No exam dates found — please import the seating plan with its exam dates first for this academic year.
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-200 flex-1">
              <span className="font-semibold">Exam Period:</span> {new Date(examPeriod.start_date).toLocaleDateString()} to {new Date(examPeriod.end_date).toLocaleDateString()} (from seating plan)
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Duty Roster'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <h2 className="text-lg font-bold mb-4">Preview</h2>
        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : !previewData?.total ? (
          <div className="text-center py-10 text-gray-500">No duties found for this academic year.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 border text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-b sticky left-0 bg-gray-50">ROOM</th>
                {dates.map(d => (
                  <th key={d} className="px-4 py-3 text-left font-semibold text-gray-700 border-b">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rooms.map(room => (
                <tr key={room}>
                  <td className="px-4 py-3 whitespace-nowrap font-medium border-r sticky left-0 bg-white">{room}</td>
                  {dates.map(dateStr => {
                    const duty = grid[room]?.[dateStr];
                    if (!duty) return <td key={dateStr} className="px-4 py-3 bg-gray-50"></td>;
                    
                    const isDraft = duty.status === 'draft';
                    const isMissing = !duty.faculty_name;
                    
                    return (
                      <td key={dateStr} className={`px-4 py-3 min-w-[200px] ${isMissing ? 'bg-red-50' : ''}`}>
                        <div className="flex justify-between items-center group">
                          <span className={isMissing ? 'text-red-600 font-bold' : ''}>
                            {duty.faculty_name || 'UNASSIGNED'}
                            {duty.is_manual_override && <span className="ml-1 text-xs text-orange-500" title="Manually overridden">*</span>}
                          </span>
                          {isDraft && (
                            <button 
                              onClick={() => openEditModal(duty, dateStr, room)}
                              className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 p-1"
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Edit Duty Assignment</h3>
            <p className="text-sm text-gray-500 mb-4">
              Room: <strong>{selectedCell?.room}</strong> | Date: <strong>{selectedCell?.date}</strong>
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1">Assign Faculty</label>
              <select
                value={selectedFacultyId}
                onChange={e => setSelectedFacultyId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Select Faculty --</option>
                {facultyList.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.department || 'N/A'})</option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
