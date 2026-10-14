import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { downloadExport } from '../utils/downloadExport';

export default function DutyAllocation() {
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [dutiesByDate, setDutiesByDate] = useState({});
  const [totalDuties, setTotalDuties] = useState(0);
  const [unassignedSlotsCount, setUnassignedSlotsCount] = useState(0);
  const [facultyList, setFacultyList] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generationWarnings, setGenerationWarnings] = useState([]);
  const [showWarnings, setShowWarnings] = useState(false);
  
  const [expandedDates, setExpandedDates] = useState({});
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedDuty, setSelectedDuty] = useState(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [exportLoading, setExportLoading] = useState({ pdf: false, excel: false });

  const handleExport = async (format) => {
    const isPdf = format === 'pdf';
    const mimeType = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats';
    const ext = isPdf ? 'pdf' : 'xlsx';
    const filename = `duty-allocation-${academicYear}.${ext}`;
    setExportLoading(prev => ({ ...prev, [format]: true }));
    try {
      await downloadExport(api, `/duties/export/${format}?academic_year=${encodeURIComponent(academicYear)}`, filename, mimeType);
    } catch (err) {
      toast.error(err.message || `Failed to download ${format.toUpperCase()}`);
    } finally {
      setExportLoading(prev => ({ ...prev, [format]: false }));
    }
  };

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/duties/preview?academic_year=${academicYear}`);
      const { duties, totalDuties: total, unassignedSlots, faculty } = response.data;
      
      setDutiesByDate(duties || {});
      setTotalDuties(total || 0);
      setUnassignedSlotsCount(unassignedSlots ? unassignedSlots.length : 0);
      setFacultyList(faculty || []);
      
      // Expand all dates by default
      const newExpanded = {};
      if (duties) {
        Object.keys(duties).forEach(date => {
          newExpanded[date] = true;
        });
      }
      setExpandedDates(newExpanded);
      
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load duty preview');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [academicYear]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await api.post('/duties/generate', { academic_year: academicYear });
      const { message, assigned, total_slots, unassigned, warnings } = response.data;
      
      toast.success(message || `Generated ${assigned} duties. Unassigned: ${unassigned}`);
      if (warnings && warnings.length > 0) {
        setGenerationWarnings(warnings);
        setShowWarnings(true);
      } else {
        setGenerationWarnings([]);
        setShowWarnings(false);
      }
      fetchPreview();
    } catch (error) {
      toast.error('Failed to generate duties');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!window.confirm('Are you sure you want to submit all draft duties for approval?')) return;
    
    setSubmitting(true);
    try {
      await api.post('/approvals/submit', { type: 'duty', academic_year: academicYear });
      toast.success('Duties submitted for approval');
      fetchPreview();
    } catch (error) {
      toast.error('Failed to submit duties for approval');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (duty) => {
    setSelectedDuty(duty);
    setSelectedFacultyId(duty.faculty_id || '');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedFacultyId) {
      toast.error('Please select a faculty');
      return;
    }
    
    setSavingEdit(true);
    try {
      await api.put(`/duties/${selectedDuty.duty_id}`, { faculty_id: selectedFacultyId });
      toast.success('Duty manually updated');
      setEditModalOpen(false);
      fetchPreview();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update duty');
      console.error(error);
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleDate = (date) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Draft</span>;
      case 'pending_approval':
        return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Pending Approval</span>;
      case 'approved':
        return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Approved</span>;
      default:
        return <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  // Check for any rejections across all duties
  let anyRejection = null;
  Object.values(dutiesByDate).forEach(dutiesArray => {
    dutiesArray.forEach(duty => {
      if (duty.duty_rejection_notes) {
        anyRejection = duty.duty_rejection_notes;
      }
    });
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Duty Allocation</h1>
          <p className="text-gray-500 text-sm mt-1">Manage faculty invigilation duties</p>
        </div>
        
        <div className="flex items-center space-x-3 bg-white p-2 rounded-lg shadow-sm border border-gray-100">
          <label className="text-sm font-medium text-gray-700 ml-2">Academic Year:</label>
          <input
            type="text"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm px-3 py-1.5 border outline-none"
            placeholder="2026-2027"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating...' : 'Generate Duties'}
          </button>
          <button
            onClick={handleSubmitForApproval}
            disabled={submitting || totalDuties === 0}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
          <div className="flex gap-2 ml-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exportLoading.pdf}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded border border-red-100 hover:bg-red-100 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {exportLoading.pdf ? <span className="animate-spin">⏳</span> : <span>📄</span>} PDF
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={exportLoading.excel}
              className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded border border-green-100 hover:bg-green-100 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {exportLoading.excel ? <span className="animate-spin">⏳</span> : <span>📊</span>} Excel
            </button>
          </div>
        </div>
      </div>

      {anyRejection && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Duty Rejected</h3>
              <div className="mt-1 text-sm text-red-700">
                <p>One or more duties were rejected: {anyRejection}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
          <dt className="text-sm font-medium text-gray-500 truncate">Total Duties</dt>
          <dd className="text-3xl font-bold text-gray-900 mt-1">{totalDuties}</dd>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
          <dt className="text-sm font-medium text-gray-500 truncate">Unassigned Slots</dt>
          <dd className={`text-3xl font-bold mt-1 ${unassignedSlotsCount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {unassignedSlotsCount}
          </dd>
        </div>
      </div>

      {generationWarnings.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
          <div 
            className="bg-orange-50 px-4 py-3 border-b border-orange-200 flex justify-between items-center cursor-pointer"
            onClick={() => setShowWarnings(!showWarnings)}
          >
            <h3 className="text-sm font-medium text-orange-800 flex items-center">
              <svg className="h-5 w-5 mr-2 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Warnings from last generation ({generationWarnings.length} unassigned)
            </h3>
            <svg className={`h-5 w-5 text-orange-500 transform transition-transform ${showWarnings ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          {showWarnings && (
            <div className="p-4 bg-white">
              <ul className="space-y-2">
                {generationWarnings.map((warn, i) => (
                  <li key={i} className="text-sm text-gray-700 flex flex-col md:flex-row md:items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="font-medium mr-2">{new Date(warn.exam_date).toLocaleDateString()} {warn.time_slot}</span>
                    <span className="text-gray-500 mr-2">{warn.subject_code} - {warn.subject_name}</span>
                    <span className="text-orange-600 text-xs bg-orange-100 px-2 py-0.5 rounded mt-1 md:mt-0">{warn.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary-600"></div>
          <p className="mt-2 text-gray-500">Loading duties...</p>
        </div>
      ) : Object.keys(dutiesByDate).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="mt-2 text-gray-500">No duties generated yet for {academicYear}.</p>
          <button
            onClick={handleGenerate}
            className="mt-4 px-4 py-2 bg-primary-50 text-primary-700 text-sm font-medium rounded-lg hover:bg-primary-100 transition-colors"
          >
            Generate Now
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(dutiesByDate).map(([date, duties]) => (
            <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div 
                className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleDate(date)}
              >
                <div className="flex items-center space-x-3">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h2>
                  <span className="bg-white text-gray-600 text-xs px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">
                    {duties.length} duties
                  </span>
                </div>
                <svg className={`h-5 w-5 text-gray-400 transform transition-transform ${expandedDates[date] ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              
              {expandedDates[date] && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                      <tr>
                        <th className="px-6 py-3 font-medium">Time Slot</th>
                        <th className="px-6 py-3 font-medium">Room</th>
                        <th className="px-6 py-3 font-medium">Subject & Student</th>
                        <th className="px-6 py-3 font-medium">Faculty</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const grouped = {};
                        duties.forEach(duty => {
                          const key = `${duty.time_slot}|${duty.room_no}`;
                          if (!grouped[key]) grouped[key] = [];
                          grouped[key].push(duty);
                        });

                        return Object.entries(grouped).map(([key, groupDuties]) => {
                          const [timeSlot, roomNo] = key.split('|');
                          const firstDuty = groupDuties[0];
                          
                          // Consolidate assigned faculty for this group
                          const uniqueFaculty = [];
                          const seenFaculty = new Set();
                          groupDuties.forEach(d => {
                            if (d.faculty_id && !seenFaculty.has(d.faculty_id)) {
                              seenFaculty.add(d.faculty_id);
                              uniqueFaculty.push(d);
                            }
                          });

                          return (
                            <React.Fragment key={key}>
                              <tr className="bg-gray-100/50 border-t border-gray-200">
                                <td colSpan="6" className="px-6 py-2 text-sm font-semibold text-gray-800">
                                  {timeSlot} — Room {roomNo} <span className="text-gray-500 font-normal">({firstDuty.building})</span> 
                                  <span className="ml-3 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{groupDuties.length} Students</span>
                                </td>
                              </tr>
                              {uniqueFaculty.length > 0 ? (
                                uniqueFaculty.map((facDuty, idx) => (
                                  <tr key={`fac-${facDuty.duty_id}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs text-center border-r border-gray-100">
                                      Invigilator {idx + 1}
                                    </td>
                                    <td colSpan="2" className="px-6 py-4 text-gray-500 text-sm italic">
                                      Covering Room {roomNo}
                                    </td>
                                    <td className="px-6 py-4">
                                      <div>
                                        <div className="text-gray-900 flex items-center">
                                          {facDuty.faculty_name}
                                          {facDuty.is_manual_override && (
                                            <span title="Manually assigned" className="ml-1.5 text-lg">🔧</span>
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-500">{facDuty.faculty_designation} • {facDuty.faculty_department}</div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {getStatusBadge(facDuty.duty_status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                      <button
                                        onClick={() => openEditModal(facDuty)}
                                        disabled={facDuty.duty_status === 'approved'}
                                        className="text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400 p-2 rounded-full hover:bg-gray-100 transition-colors"
                                        title="Edit assignment"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs text-center border-r border-gray-100">
                                    Invigilator
                                  </td>
                                  <td colSpan="2" className="px-6 py-4 text-gray-500 text-sm italic">
                                    Covering Room {roomNo}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-orange-500 italic text-sm">Unassigned</span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    {getStatusBadge(firstDuty.duty_status)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && selectedDuty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-900">Edit Duty Assignment</h3>
              <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Duty Details</h4>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-gray-500">Date:</div>
                <div className="font-medium text-gray-900">{new Date(selectedDuty.exam_date).toLocaleDateString()}</div>
                <div className="text-gray-500">Time:</div>
                <div className="font-medium text-gray-900">{selectedDuty.time_slot}</div>
                <div className="text-gray-500">Subject:</div>
                <div className="font-medium text-gray-900 truncate">{selectedDuty.subject_code}</div>
                <div className="text-gray-500">Room:</div>
                <div className="font-medium text-gray-900">{selectedDuty.room_no}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign Faculty</label>
              <select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">-- Select Faculty --</option>
                {facultyList.map(faculty => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name} ({faculty.department})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">Selecting a faculty manually will mark this assignment as an override (🔧).</p>
            </div>

            <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !selectedFacultyId}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {savingEdit ? 'Saving...' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
