import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import DataTable from '../components/DataTable';

export default function Faculty() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department' },
    { key: 'designation', label: 'Designation' },
    { key: 'email', label: 'Email' },
    { key: 'max_duty_load', label: 'Max Duty Load' },
    { key: 'is_available', label: 'Available' }
  ];

  const fetchFaculty = async () => {
    try {
      setLoading(true);
      const res = await api.get('/faculty');
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch faculty.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this faculty member?')) return;
    try {
      await api.delete(`/faculty/${id}`);
      toast.success('Faculty deleted successfully');
      fetchFaculty();
    } catch (err) {
      toast.error('Failed to delete faculty');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Faculty</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 shadow-sm border border-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <DataTable 
          columns={columns} 
          data={data} 
          searchPlaceholder="Search faculty..." 
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
