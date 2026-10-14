import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'superadmin';
  const basePath = isAdmin ? '/admin/dashboard' : '/staff/dashboard';

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-gray-800 text-white flex flex-col shadow-xl z-10 overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-sm font-bold tracking-widest text-gray-400 uppercase">Exam Management</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavLink 
            to={basePath} 
            end
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">📊</span> Dashboard
          </NavLink>
          <NavLink 
            to={`${basePath}/upload`}
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">📤</span> Upload Data
          </NavLink>
          <NavLink 
            to={`${basePath}/students`}
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">👨🎓</span> Students
          </NavLink>
          <NavLink 
            to={`${basePath}/subjects`}
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">📚</span> Subjects
          </NavLink>
          <NavLink 
            to={`${basePath}/faculty`}
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">👨🏫</span> Faculty
          </NavLink>
          <NavLink 
            to={`${basePath}/rooms`}
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">🏫</span> Rooms
          </NavLink>

          <NavLink 
            to={`${basePath}/scheduling`}
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">📅</span> Backlog Scheduling
          </NavLink>

          {isAdmin && (
            <NavLink 
              to={`${basePath}/approvals`}
              className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
            >
              <span className="mr-3">✅</span> Approvals
            </NavLink>
          )}

          <NavLink 
            to={`${basePath}/duty-allocation`}
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">📋</span> Duty Allocation
          </NavLink>

          <NavLink 
            to={`${basePath}/main-exam-duty`}
            className={({ isActive }) => `block px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-gray-700 font-medium' : 'hover:bg-gray-700/50'}`}
          >
            <span className="mr-3">📅</span> Main Exam Duty
          </NavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col h-full">
        {/* Header */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="flex items-center space-x-3">
            <img src="/assets/iiitpune-logo.png" alt="IIIT Pune Logo" className="w-10 h-10 object-contain" />
            <div>
              <span className="font-bold text-xl text-gray-800 block leading-tight">IIIT Pune</span>
              <span className="text-[10px] text-gray-400 tracking-wider uppercase">Leading Technology Leveraging Technology</span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-sm">
              <span className="text-gray-500">Logged in as </span>
              <span className="font-semibold text-gray-800">{user?.name}</span>
            </div>
            <button 
              onClick={logout}
              className="text-red-600 hover:text-red-700 font-medium text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
