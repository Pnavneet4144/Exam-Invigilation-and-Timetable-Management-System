import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function Approvals() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [approvedCount, setApprovedCount] = useState(0);
  const [approvedItems, setApprovedItems] = useState([]);
  
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [itemsToReject, setItemsToReject] = useState([]);
  
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchPendingItems();
    fetchApprovedItems();
    setSelectedIds(new Set());
  }, [activeTab, academicYear]);

  const fetchPendingItems = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/approvals/pending?type=${activeTab}`);
      setPendingItems(response.data.items || []);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to fetch pending items');
      setPendingItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedItems = async () => {
    try {
      const endpoint = activeTab === 'schedule' 
        ? `/scheduling/preview?academic_year=${academicYear}` 
        : `/duties/preview?academic_year=${academicYear}`;
        
      const response = await api.get(endpoint);
      const items = response.data.items || [];
      const approved = items.filter(item => item.status === 'approved');
      setApprovedItems(approved);
      setApprovedCount(approved.length);
    } catch (error) {
      console.error(error);
      setApprovedCount(0);
      setApprovedItems([]);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(pendingItems.map(item => item.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleApprove = async (ids) => {
    if (!ids || ids.length === 0) return;
    setIsProcessing(true);
    try {
      await api.post('/approvals/approve', {
        type: activeTab,
        ids: ids
      });
      toast.success(`Successfully approved ${ids.length} item(s)`);
      setSelectedIds(new Set());
      fetchPendingItems();
      fetchApprovedItems();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to approve items');
    } finally {
      setIsProcessing(false);
    }
  };

  const openRejectModal = (ids) => {
    setItemsToReject(ids);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (rejectReason.length < 10) {
      toast.error('Rejection reason must be at least 10 characters');
      return;
    }
    
    setIsProcessing(true);
    try {
      await api.post('/approvals/reject', {
        type: activeTab,
        ids: itemsToReject,
        reason: rejectReason
      });
      toast.success(`Successfully rejected ${itemsToReject.length} item(s)`);
      setIsRejectModalOpen(false);
      setSelectedIds(new Set());
      fetchPendingItems();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to reject items');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlockAll = async () => {
    if (!window.confirm(`Are you sure you want to unlock ALL ${approvedCount} approved items? They will return to draft state.`)) {
      return;
    }
    
    setIsProcessing(true);
    try {
      const ids = approvedItems.map(item => item.id || item.duty_id || item.exam_schedule_id);
      await api.post('/approvals/unlock', {
        type: activeTab,
        ids: ids
      });
      toast.success(`Unlocked ${ids.length} items successfully`);
      fetchPendingItems();
      fetchApprovedItems();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to unlock items');
    } finally {
      setIsProcessing(false);
    }
  };

  const allSelected = pendingItems.length > 0 && selectedIds.size === pendingItems.length;
  const isSelected = (id) => selectedIds.has(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-100 shadow-sm">
          <label className="text-sm font-medium text-gray-700">Academic Year</label>
          <input 
            type="text" 
            value={academicYear} 
            onChange={(e) => setAcademicYear(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-1 border"
            placeholder="e.g. 2026-2027"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'schedule'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Schedule Approvals
            </button>
            <button
              onClick={() => setActiveTab('duty')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'duty'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Duty Approvals
            </button>
            <button
              onClick={() => setActiveTab('regular_duty')}
              className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                activeTab === 'regular_duty'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Regular Duty Approvals
            </button>
          </nav>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Pending Items ({pendingItems.length})
            </h2>
            
            {selectedIds.size > 0 && (
              <div className="flex gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <span className="text-sm text-gray-600 flex items-center px-2">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => handleApprove(Array.from(selectedIds))}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </button>
                <button
                  onClick={() => openRejectModal(Array.from(selectedIds))}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading pending items...</div>
          ) : pendingItems.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-900">No pending approvals</h3>
              <p className="mt-1 text-sm text-gray-500">All caught up! There are no items waiting for your review.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider">Room & Subject</th>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider">
                      {activeTab === 'schedule' ? 'Student' : activeTab === 'duty' ? 'Faculty' : 'Invigilators'}
                    </th>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
                    <th className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected(item.id)}
                          onChange={() => handleSelect(item.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900">{new Date(item.exam_date).toLocaleDateString()}</div>
                        <div className="text-gray-500 text-xs">{item.time_slot}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900 font-medium">{item.room_no} ({item.building})</div>
                        <div className="text-gray-500 text-xs truncate max-w-xs">{item.subject_code} - {item.subject_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        {activeTab === 'schedule' ? (
                          <>
                            <div className="text-gray-900">{item.student_name}</div>
                            <div className="text-gray-500 text-xs">{item.roll_no}</div>
                          </>
                        ) : activeTab === 'duty' ? (
                          <>
                            <div className="text-gray-900">{item.faculty_name}</div>
                            <div className="text-gray-500 text-xs">{item.faculty_designation}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-gray-900">1: {item.f1_name}</div>
                            <div className="text-gray-900">2: {item.f2_name}</div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {item.created_by_name || 'System'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleApprove([item.id])}
                          disabled={isProcessing}
                          className="text-green-600 hover:text-green-900 bg-green-50 px-2 py-1 rounded mr-2 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectModal([item.id])}
                          disabled={isProcessing}
                          className="text-red-600 hover:text-red-900 bg-red-50 px-2 py-1 rounded disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Approved Items</h3>
          <p className="text-sm text-gray-500">
            {approvedCount} {activeTab} item(s) are currently approved for {academicYear}. 
            Approved items can be unlocked and returned to draft status if changes are needed.
          </p>
        </div>
        <button
          onClick={handleUnlockAll}
          disabled={isProcessing || approvedCount === 0}
          className="whitespace-nowrap px-4 py-2 bg-yellow-100 text-yellow-800 font-medium rounded-lg hover:bg-yellow-200 disabled:opacity-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          Unlock All
        </button>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Reject Items</h3>
            
            <div className="mb-4 bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-3">
              <svg className="h-5 w-5 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-amber-800">
                Warning: Items will be returned to draft status for the editor to revise. This action cannot be undone.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection (Required)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm p-3 border"
                rows="4"
                placeholder="Please provide specific feedback to help the editor fix the issues..."
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">
                Minimum 10 characters required. ({rejectReason.length}/10)
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={isProcessing || rejectReason.length < 10}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
