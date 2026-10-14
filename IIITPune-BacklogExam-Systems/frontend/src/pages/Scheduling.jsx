import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { downloadExport } from '../utils/downloadExport';

export default function Scheduling() {
  // Config state
  const [academicYear, setAcademicYear] = useState('2026-2027');
  
  // Calculate tomorrow's date in YYYY-MM-DD for default start date
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [startDate, setStartDate] = useState(getTomorrowDate());

  // Step 1: Pacing state
  const [pacingList, setPacingList] = useState([]);
  const [loadingPacing, setLoadingPacing] = useState(false);
  const [pacingSearch, setPacingSearch] = useState('');
  const [savingPacingId, setSavingPacingId] = useState(null);

  // Time Slots state
  const [timeSlots, setTimeSlots] = useState([]);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);
  const [newSlot, setNewSlot] = useState({ label: '', start: '', end: '' });
  const [savingTimeSlot, setSavingTimeSlot] = useState(false);

  // Step 2: Generation state
  const [generating, setGenerating] = useState(false);
  const [genSummary, setGenSummary] = useState(null);
  const [unscheduledItems, setUnscheduledItems] = useState([]);

  // Step 3: Schedule Preview state
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState({});

  // Rooms list for modal
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Edit Modal state
  const [editingExam, setEditingExam] = useState(null);
  const [editForm, setEditForm] = useState({
    exam_date: '',
    time_slot: '09:00-12:00',
    room_id: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [exportLoading, setExportLoading] = useState({ pdf: false, excel: false });

  const handleExport = async (format) => {
    const isPdf = format === 'pdf';
    const mimeType = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats';
    const ext = isPdf ? 'pdf' : 'xlsx';
    const filename = `backlog-schedule-${academicYear}.${ext}`;
    setExportLoading(prev => ({ ...prev, [format]: true }));
    try {
      await downloadExport(api, `/scheduling/export/${format}?academic_year=${encodeURIComponent(academicYear)}`, filename, mimeType);
    } catch (err) {
      toast.error(err.message || `Failed to download ${format.toUpperCase()}`);
    } finally {
      setExportLoading(prev => ({ ...prev, [format]: false }));
    }
  };

  // Fetch initial schedule preview, rooms, pacing, and time slots on mount
  useEffect(() => {
    fetchPreview();
    fetchRooms();
    fetchPacing();
    fetchTimeSlots();
  }, [academicYear]);

  const fetchPacing = async () => {
    if (!academicYear) return;
    try {
      setLoadingPacing(true);
      const res = await api.post('/scheduling/suggest-pacing', {
        academic_year: academicYear
      });
      setPacingList(res.data.students || []);
    } catch (err) {
      console.error('Failed to fetch pacing:', err);
    } finally {
      setLoadingPacing(false);
    }
  };

  const fetchTimeSlots = async () => {
    try {
      setLoadingTimeSlots(true);
      const res = await api.get(`/scheduling/time-slots?academic_year=${encodeURIComponent(academicYear)}&exam_type=backlog`);
      setTimeSlots(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load time slots');
    } finally {
      setLoadingTimeSlots(false);
    }
  };

  const handleAddTimeSlot = async () => {
    if (!newSlot.label || !newSlot.start || !newSlot.end) {
      toast.error('Please fill all time slot fields');
      return;
    }
    try {
      setSavingTimeSlot(true);
      await api.post('/scheduling/time-slots', {
        academic_year: academicYear,
        exam_type: 'backlog',
        slot_label: newSlot.label,
        start_time: newSlot.start,
        end_time: newSlot.end
      });
      toast.success('Time slot added');
      setNewSlot({ label: '', start: '', end: '' });
      fetchTimeSlots();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add time slot');
    } finally {
      setSavingTimeSlot(false);
    }
  };

  const handleDeleteTimeSlot = async (id) => {
    if (!window.confirm('Delete this time slot?')) return;
    try {
      await api.delete(`/scheduling/time-slots/${id}`);
      toast.success('Time slot deleted');
      fetchTimeSlots();
    } catch (err) {
      toast.error('Failed to delete time slot');
    }
  };

  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await api.get('/rooms');
      setRooms(res.data || []);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // ----------------------------------------------------
  // Step 1: Suggest & Update Pacing
  // ----------------------------------------------------
  const handleSuggestPacing = async () => {
    if (!academicYear) {
      toast.error('Please enter an academic year');
      return;
    }
    try {
      setLoadingPacing(true);
      const res = await api.post('/scheduling/suggest-pacing', {
        academic_year: academicYear
      });
      const students = res.data.students || [];
      setPacingList(students);
      if (students.length === 0) {
        toast('No pending backlog papers found for this academic year.', { icon: 'ℹ️' });
      } else {
        toast.success(`Calculated pacing for ${students.length} student(s)`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to suggest pacing';
      toast.error(msg);
    } finally {
      setLoadingPacing(false);
    }
  };

  const handlePacingChange = (studentId, value) => {
    const val = parseInt(value, 10);
    setPacingList(prev =>
      prev.map(st => st.student_id === studentId ? { ...st, papers_per_day: isNaN(val) ? '' : val } : st)
    );
  };

  const handleSavePacingRow = async (student) => {
    const papersPerDay = parseInt(student.papers_per_day, 10);
    if (!papersPerDay || papersPerDay < 1 || papersPerDay > 10) {
      toast.error('Papers/Day must be between 1 and 10');
      return;
    }

    try {
      setSavingPacingId(student.student_id);
      await api.put(`/scheduling/pacing/${student.student_id}`, {
        academic_year: academicYear,
        papers_per_day: papersPerDay
      });
      toast.success(`Pacing saved for ${student.name}`);
      // Mark as manual override locally
      setPacingList(prev =>
        prev.map(st => st.student_id === student.student_id ? { ...st, is_manual_override: true } : st)
      );
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update pacing';
      toast.error(msg);
    } finally {
      setSavingPacingId(null);
    }
  };

  // ----------------------------------------------------
  // Step 2: Generate Schedule
  // ----------------------------------------------------
  const handleGenerateSchedule = async () => {
    if (!academicYear) {
      toast.error('Please enter an academic year');
      return;
    }
    if (!startDate) {
      toast.error('Please select a start date');
      return;
    }

    try {
      setGenerating(true);
      const res = await api.post('/scheduling/generate', {
        academic_year: academicYear,
        start_date: startDate
      });
      setGenSummary(res.data.summary);
      setUnscheduledItems(res.data.unscheduled || []);
      toast.success(res.data.message || 'Draft schedule generated successfully!');
      // Automatically refresh schedule preview
      fetchPreview();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate schedule';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // ----------------------------------------------------
  // Step 3: Schedule Preview & Manual Overrides
  // ----------------------------------------------------
  const fetchPreview = async (year = academicYear) => {
    if (!year) return;
    try {
      setLoadingPreview(true);
      const res = await api.get(`/scheduling/preview?academic_year=${encodeURIComponent(year)}`);
      setPreviewData(res.data);
    } catch (err) {
      console.error('Failed to fetch schedule preview:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSubmitForApproval = async () => {
    try {
      setSubmitting(true);
      const res = await api.post('/approvals/submit', {
        type: 'schedule',
        academic_year: academicYear
      });
      toast.success(res.data.message);
      fetchPreview(); // refresh to show updated statuses
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit for approval');
    } finally {
      setSubmitting(false);
    }
  };
  const toggleDateCollapse = (dateStr) => {
    setCollapsedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const openEditModal = (exam) => {
    setEditingExam(exam);
    setEditForm({
      exam_date: exam.exam_date,
      time_slot: exam.time_slot,
      room_id: exam.room_id
    });
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingExam(null);
    setEditError(null);
  };

  const handleSaveExamEdit = async (e) => {
    e.preventDefault();
    if (!editingExam) return;

    if (!editForm.exam_date || !editForm.time_slot || !editForm.room_id) {
      setEditError('Date, Time Slot, and Room are all required.');
      return;
    }

    try {
      setSavingEdit(true);
      setEditError(null);
      await api.put(`/scheduling/exam/${editingExam.exam_schedule_id}`, {
        exam_date: editForm.exam_date,
        time_slot: editForm.time_slot,
        room_id: parseInt(editForm.room_id, 10)
      });
      toast.success('Exam schedule updated successfully');
      closeEditModal();
      fetchPreview();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to update exam';
      setEditError(errMsg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Filtered student pacing list
  const filteredPacingList = pacingList.filter(s =>
    s.name.toLowerCase().includes(pacingSearch.toLowerCase()) ||
    s.roll_no.toLowerCase().includes(pacingSearch.toLowerCase()) ||
    (s.department && s.department.toLowerCase().includes(pacingSearch.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header & Academic Year / Start Date Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>📅</span> Backlog Exam Scheduling
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure pacing, generate optimized schedules without student clashes, and inspect or override allocations.
            </p>
          </div>
          <button
            onClick={() => fetchPreview(academicYear)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm self-start md:self-auto"
          >
            <span>🔄</span> Refresh Preview
          </button>
          <div className="flex gap-2 ml-4">
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

        {/* Global Controls: Academic Year and Start Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2026-2027"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <select
                value={['2025-2026', '2026-2027', '2027-2028'].includes(academicYear) ? academicYear : ''}
                onChange={(e) => e.target.value && setAcademicYear(e.target.value)}
                className="px-2 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Quick select</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Exam Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Sundays and official holidays are automatically skipped.</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIME SLOTS CONFIGURATION */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 mb-1">
              Configuration
            </div>
            <h2 className="text-lg font-bold text-gray-900">Exam Time Slots</h2>
            <p className="text-sm text-gray-500">
              Define the available time slots for backlog exams.
            </p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-4 items-end mb-6">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Slot Label</label>
              <input type="text" placeholder="e.g. Morning, 09:00-12:00" value={newSlot.label} onChange={e => setNewSlot({...newSlot, label: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time</label>
              <input type="time" value={newSlot.start} onChange={e => setNewSlot({...newSlot, start: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">End Time</label>
              <input type="time" value={newSlot.end} onChange={e => setNewSlot({...newSlot, end: e.target.value})} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <button
              onClick={handleAddTimeSlot}
              disabled={savingTimeSlot}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              + Add Slot
            </button>
          </div>
          
          {loadingTimeSlots ? (
            <div className="text-sm text-gray-500 animate-pulse">Loading slots...</div>
          ) : timeSlots.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {timeSlots.map(slot => (
                <div key={slot.id} className="inline-flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{slot.slot_label}</div>
                    <div className="text-xs text-gray-500 font-mono">{slot.start_time.substring(0,5)} - {slot.end_time.substring(0,5)}</div>
                  </div>
                  <button onClick={() => handleDeleteTimeSlot(slot.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded">
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              ⚠️ No time slots configured for {academicYear}. You must add at least one time slot before generating a schedule.
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* STEP 1: REVIEW STUDENT PACING */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-1">
              Step 1
            </div>
            <h2 className="text-lg font-bold text-gray-900">Review Student Pacing</h2>
            <p className="text-sm text-gray-500">
              Calculate automated pacing (1 paper/day, or 2 papers/day if backlog count &gt; 15) and customize as needed.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSuggestPacing}
              disabled={loadingPacing}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              {loadingPacing ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Calculating...
                </>
              ) : (
                <>
                  <span>⚡</span> Suggest Pacing
                </>
              )}
            </button>
          </div>
        </div>

        {pacingList.length > 0 && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="text-sm text-gray-600">
                Found <span className="font-semibold text-gray-900">{pacingList.length}</span> students with pending backlogs
              </div>
              <input
                type="text"
                value={pacingSearch}
                onChange={(e) => setPacingSearch(e.target.value)}
                placeholder="Filter by name, roll no, or dept..."
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-72"
              />
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-xs tracking-wider">
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Pending Backlogs</th>
                    <th className="py-3 px-4 text-center">Papers / Day</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPacingList.map((student) => (
                    <tr key={student.student_id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900">{student.name}</td>
                      <td className="py-3 px-4 font-mono text-gray-600">{student.roll_no}</td>
                      <td className="py-3 px-4 text-gray-600">{student.department || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                          {student.pending_count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={student.papers_per_day}
                          onChange={(e) => handlePacingChange(student.student_id, e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        {student.is_manual_override ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <span>✏️</span> Manual Override
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span>🤖</span> Auto Suggested
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleSavePacingRow(student)}
                          disabled={savingPacingId === student.student_id}
                          className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
                        >
                          {savingPacingId === student.student_id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPacingList.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-6 text-center text-gray-500">
                        No students match the filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pacingList.length === 0 && !loadingPacing && (
          <div className="p-8 text-center text-gray-500 text-sm">
            Click &ldquo;Suggest Pacing&rdquo; above to load backlog students and review pacing limits.
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* STEP 2: GENERATE SCHEDULE */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 mb-1">
              Step 2
            </div>
            <h2 className="text-lg font-bold text-gray-900">Generate Schedule</h2>
            <p className="text-sm text-gray-500">
              Run the automated scheduling engine with student pacing, room capacities, and holiday exclusions.
            </p>
          </div>

          <button
            onClick={handleGenerateSchedule}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-md"
          >
            {generating ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Generating Schedule...
              </>
            ) : (
              <>
                <span>🚀</span> Generate Schedule
              </>
            )}
          </button>
        </div>

        {/* Generation Statistics Summary */}
        {genSummary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-xs text-emerald-600 font-semibold uppercase tracking-wider">Scheduled Exams</span>
                <p className="text-2xl font-bold text-emerald-800 mt-1">
                  {genSummary.scheduled_papers} / {genSummary.total_papers}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Date Span</span>
                <p className="text-base font-bold text-blue-800 mt-1">
                  {genSummary.start_date} <span className="text-xs font-normal">to</span> {genSummary.end_date}
                </p>
                <span className="text-xs text-blue-600 font-medium">{genSummary.exam_days} exam day(s)</span>
              </div>
              <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
                <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wider">Rooms Utilized</span>
                <p className="text-2xl font-bold text-indigo-800 mt-1">{genSummary.rooms_utilized}</p>
                <span className="text-xs text-indigo-500">{genSummary.total_students} student(s)</span>
              </div>
              <div className={`p-4 rounded-lg border ${unscheduledItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <span className={`text-xs font-semibold uppercase tracking-wider ${unscheduledItems.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  Unscheduled Count
                </span>
                <p className={`text-2xl font-bold mt-1 ${unscheduledItems.length > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                  {unscheduledItems.length}
                </p>
                <span className="text-xs text-gray-500">papers needing review</span>
              </div>
            </div>

            {unscheduledItems.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-sm font-bold text-red-800 mb-2">Unscheduled Papers Warning</h4>
                <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                  {unscheduledItems.map((item, idx) => (
                    <li key={idx}>
                      Student ID {item.student_id} &bull; Paper ID {item.backlog_paper_id} &bull; Reason: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* STEP 3: SCHEDULE PREVIEW */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-1">
              Step 3
            </div>
            <h2 className="text-lg font-bold text-gray-900">Schedule Preview</h2>
            <p className="text-sm text-gray-500">
              Review exams grouped by date. Rows with manual overrides are highlighted. Click &ldquo;Edit&rdquo; to modify slot or room with conflict detection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {previewData && (
              <>
                <span className="text-sm font-medium text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded-lg shadow-sm">
                  Total Exams: <span className="font-bold text-primary-600">{previewData.total_exams}</span> across{' '}
                  <span className="font-bold text-primary-600">{previewData.dates_count}</span> day(s)
                </span>
                
                {Object.values(previewData.grouped_schedule || {}).flat().some(e => e.status === 'draft') && (
                  <button
                    onClick={handleSubmitForApproval}
                    disabled={submitting}
                    className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm inline-flex items-center gap-2"
                  >
                    {submitting ? 'Submitting...' : 'Submit for Approval'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Rejection Banner */}
        {previewData && Object.values(previewData.grouped_schedule || {}).flat().some(e => e.rejection_notes) && (
          <div className="bg-red-50 border-b border-red-200 p-4 flex items-start gap-3">
            <span className="text-red-500 mt-0.5">⚠️</span>
            <div>
              <h4 className="text-sm font-bold text-red-800">Changes Required</h4>
              <p className="text-sm text-red-700 mt-1">
                One or more items in this schedule were rejected by the superadmin.
                Please review the rejection notes below, make corrections, and resubmit.
              </p>
            </div>
          </div>
        )}

        <div className="p-6">
          {loadingPreview ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
              <span className="ml-3 text-sm text-gray-500 font-medium">Loading schedule preview...</span>
            </div>
          ) : !previewData || Object.keys(previewData.grouped_schedule || {}).length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-4xl mb-3">📅</div>
              <h3 className="text-base font-semibold text-gray-800">No Schedule Found</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                No draft schedule has been generated for academic year <span className="font-semibold">{academicYear}</span>. Run Step 2 above to create one.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(previewData.grouped_schedule).map(([dateStr, exams]) => {
                const isCollapsed = !!collapsedDates[dateStr];
                const dateObj = new Date(dateStr + 'T00:00:00');
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div key={dateStr} className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                    {/* Date Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleDateCollapse(dateStr)}
                      className="w-full flex items-center justify-between p-4 bg-gray-100/70 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-gray-800">{formattedDate}</span>
                        <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-300 text-gray-600">
                          {dateStr}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary-100 text-primary-800">
                          {exams.length} exam{exams.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-gray-500 text-sm font-semibold">
                        {isCollapsed ? '▼ Expand' : '▲ Collapse'}
                      </span>
                    </button>

                    {/* Table of exams for this date */}
                    {!isCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-xs tracking-wider">
                              <th className="py-3 px-4">Time Slot</th>
                              <th className="py-3 px-4">Student</th>
                              <th className="py-3 px-4">Subject</th>
                              <th className="py-3 px-4">Room</th>
                              <th className="py-3 px-4 text-center">Status</th>
                              <th className="py-3 px-4 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {exams.map((exam) => (
                              <React.Fragment key={exam.exam_schedule_id}>
                                <tr
                                  className={`transition-colors ${
                                    exam.is_manual_override
                                      ? 'bg-amber-50/50 hover:bg-amber-50'
                                      : 'hover:bg-gray-50/80'
                                  }`}
                                >
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-gray-200 text-gray-800 font-mono">
                                    {exam.time_slot}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-gray-900">{exam.student_name}</div>
                                  <div className="text-xs font-mono text-gray-500">
                                    {exam.roll_no} &bull; {exam.student_dept || 'N/A'}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-medium text-gray-900">
                                    <span className="font-mono text-primary-700 mr-1.5">{exam.subject_code}</span>
                                    {exam.subject_name}
                                  </div>
                                  <div className="text-xs text-gray-500">Sem {exam.subject_semester}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-gray-800">
                                    Room {exam.room_no}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {exam.building} (Cap: {exam.room_capacity})
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center whitespace-nowrap flex flex-col items-center gap-1 mt-1">
                                  {exam.status === 'draft' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                      Draft
                                    </span>
                                  )}
                                  {exam.status === 'pending_approval' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                      Pending
                                    </span>
                                  )}
                                  {exam.status === 'approved' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                      Approved
                                    </span>
                                  )}
                                  {exam.is_manual_override && (
                                    <span title="Manually Overridden" className="cursor-help">🔧</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                  <button
                                    onClick={() => openEditModal(exam)}
                                    disabled={exam.status === 'approved'}
                                    className="px-3 py-1 bg-white border border-gray-300 hover:border-primary-500 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:text-gray-700 text-gray-700 rounded text-xs font-semibold transition-colors shadow-xs"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                              {exam.rejection_notes && (
                                <tr className="bg-red-50/50 border-b border-gray-200">
                                  <td colSpan="6" className="px-4 py-2 text-xs text-red-700">
                                    <span className="font-bold">Rejection Reason:</span> {exam.rejection_notes}
                                  </td>
                                </tr>
                              )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* EDIT EXAM MODAL */}
      {/* ========================================================================= */}
      {editingExam && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 animate-in fade-in duration-150">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>✏️</span> Edit Exam Allocation
              </h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveExamEdit} className="p-6 space-y-4">
              {/* Exam details overview */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-1">
                <div>
                  <span className="font-medium text-gray-500">Student: </span>
                  <span className="font-bold text-gray-800">{editingExam.student_name}</span> ({editingExam.roll_no})
                </div>
                <div>
                  <span className="font-medium text-gray-500">Subject: </span>
                  <span className="font-bold text-gray-800">{editingExam.subject_code} - {editingExam.subject_name}</span>
                </div>
              </div>

              {/* Conflict Error Alert */}
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 leading-relaxed">
                  <div className="font-bold text-red-800 flex items-center gap-1 mb-1">
                    <span>⚠️</span> Conflict Detected
                  </div>
                  {editError}
                </div>
              )}

              {/* Form inputs */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Exam Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editForm.exam_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, exam_date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Time Slot <span className="text-red-500">*</span>
                </label>
                <select
                  value={editForm.time_slot}
                  onChange={(e) => setEditForm(prev => ({ ...prev, time_slot: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="09:00-12:00">09:00-12:00 (Morning)</option>
                  <option value="14:00-17:00">14:00-17:00 (Afternoon)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Assigned Room <span className="text-red-500">*</span>
                </label>
                <select
                  value={editForm.room_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, room_id: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a room...</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_no} &bull; {r.building} (Capacity: {r.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={savingEdit}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  {savingEdit ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
