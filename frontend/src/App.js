import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

// Auth
import { AuthProvider, ROLES } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import LoginPage from "./components/LoginPage";
import StudentHome from "./components/StudentHome";
import StudentMap from "./components/StudentMap";
import DiagnosticFlow from "./components/DiagnosticFlow";
import GradeSelector from "./components/GradeSelector";
import TeacherDashboard from "./components/TeacherDashboard";
import TeacherStudentDetail from "./components/TeacherStudentDetail";
import ParentHome from "./pages/ParentHome";
import AdminHome from "./pages/AdminHome";
import SalesHome from "./pages/SalesHome";

// Layouts
import StudentLayout from "./components/layouts/StudentLayout";
import TeacherLayout from "./components/layouts/TeacherLayout";
import ParentLayout from "./components/layouts/ParentLayout";
import AdminLayout from "./components/layouts/AdminLayout";
import SalesLayout from "./components/layouts/SalesLayout";

// Re-export api for backward compat with existing components
export { api } from "./lib/api";

function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Student routes */}
            <Route path="/student" element={
              <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
                <StudentLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home" element={<StudentHome />} />
              <Route path="grade-select" element={<GradeSelector />} />
              <Route path="diagnostic" element={<DiagnosticFlow />} />
              <Route path="map" element={<StudentMap />} />
            </Route>

            {/* Teacher routes */}
            <Route path="/teacher" element={
              <ProtectedRoute allowedRoles={[ROLES.TEACHER, ROLES.ADMIN]}>
                <TeacherLayout />
              </ProtectedRoute>
            }>
              <Route index element={<TeacherDashboard />} />
              <Route path="student/:studentId" element={<TeacherStudentDetail />} />
            </Route>

            {/* Parent routes */}
            <Route path="/parent" element={
              <ProtectedRoute allowedRoles={[ROLES.PARENT]}>
                <ParentLayout />
              </ProtectedRoute>
            }>
              <Route index element={<ParentHome />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminHome />} />
            </Route>

            {/* Sales routes */}
            <Route path="/sales" element={
              <ProtectedRoute allowedRoles={[ROLES.SALES]}>
                <SalesLayout />
              </ProtectedRoute>
            }>
              <Route index element={<SalesHome />} />
            </Route>

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
