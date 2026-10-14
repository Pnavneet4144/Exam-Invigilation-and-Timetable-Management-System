import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    students: 0,
    subjects: 0,
    faculty: 0,
    rooms: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // Fetch all counts in parallel
        const [students, subjects, faculty, rooms] = await Promise.all([
          api.get('/students/count'),
          api.get('/subjects/count'),
          api.get('/faculty/count'),
          api.get('/rooms/count')
        ]);
        
        setStats({
          students: students.data.count,
          subjects: subjects.data.count,
          faculty: faculty.data.count,
          rooms: rooms.data.count
        });
      } catch (err) {
        setError('Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Welcome, {user?.name}!</h1>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 shadow-sm border border-red-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Students Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-2xl">
            👨🎓
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Students</p>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
            ) : (
              <h3 className="text-2xl font-bold text-gray-800">{stats.students}</h3>
            )}
          </div>
        </div>

        {/* Subjects Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-2xl">
            📚
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Subjects</p>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
            ) : (
              <h3 className="text-2xl font-bold text-gray-800">{stats.subjects}</h3>
            )}
          </div>
        </div>

        {/* Faculty Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-2xl">
            👨🏫
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Faculty</p>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
            ) : (
              <h3 className="text-2xl font-bold text-gray-800">{stats.faculty}</h3>
            )}
          </div>
        </div>

        {/* Rooms Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4">
          <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-2xl">
            🏫
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Rooms</p>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded mt-1"></div>
            ) : (
              <h3 className="text-2xl font-bold text-gray-800">{stats.rooms}</h3>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
