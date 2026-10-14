/**
 * App Component — Root Route Configuration
 * 
 * Defines all application routes:
 * - /login/admin → Admin login page (superadmin only)
 * - /login/staff → Staff login page (editors only)
 * - /admin/dashboard/* → Protected admin routes (superadmin)
 * - /staff/dashboard/* → Protected staff routes (editor)
 * - / → Redirects to /login/staff
 * 
 * Both admin and staff dashboards share the same Layout component
 * and child pages — the Layout adapts based on user role.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import StaffLogin from './pages/StaffLogin';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadData from './pages/UploadData';
import Students from './pages/Students';
import Subjects from './pages/Subjects';
import Faculty from './pages/Faculty';
import Rooms from './pages/Rooms';
import Scheduling from './pages/Scheduling';
import DutyAllocation from './pages/DutyAllocation';
import MainExamDuty from './pages/MainExamDuty';
import RegularDuty from './pages/RegularDuty';
import Approvals from './pages/Approvals';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* Public login routes */}
        <Route path="/login/admin" element={<AdminLogin />} />
        <Route path="/login/staff" element={<StaffLogin />} />

        {/* Protected routes — SUPERADMIN */}
        <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="superadmin"><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="upload" element={<UploadData />} />
          <Route path="students" element={<Students />} />
          <Route path="subjects" element={<Subjects />} />
          <Route path="faculty" element={<Faculty />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="scheduling" element={<Scheduling />} />
          <Route path="duty-allocation" element={<DutyAllocation />} />
            <Route path="main-exam-duty" element={<MainExamDuty />} />
          <Route path="regular-duty" element={<RegularDuty />} />
          <Route path="approvals" element={<Approvals />} />
        </Route>

        {/* Protected routes — EDITOR (Staff) */}
        <Route path="/staff/dashboard" element={<ProtectedRoute requiredRole="editor"><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="upload" element={<UploadData />} />
          <Route path="students" element={<Students />} />
          <Route path="subjects" element={<Subjects />} />
          <Route path="faculty" element={<Faculty />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="scheduling" element={<Scheduling />} />
          <Route path="duty-allocation" element={<DutyAllocation />} />
            <Route path="main-exam-duty" element={<MainExamDuty />} />
          <Route path="regular-duty" element={<RegularDuty />} />
        </Route>
        
        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login/staff" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
