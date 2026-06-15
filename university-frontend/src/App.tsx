import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const AdminRedirect: React.FC = () => {
  const last = localStorage.getItem('admin_last_path');
  return <Navigate to={last || '/admin/institutes'} replace />;
};
import { LoginPage } from './pages/auth/LoginPage';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { TeacherLayout } from './layouts/TeacherLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { MyDisciplinesPage } from './pages/teacher/MyDisciplinesPage';
import { MySchedulePage } from './pages/teacher/MySchedulePage';
import { GradeBookPage } from './pages/teacher/GradeBookPage';
import { MaterialsPage } from './pages/teacher/MaterialsPage';
import { StudentProfilePage } from './pages/student/StudentProfilePage';
import { StudentSchedulePage } from './pages/student/StudentSchedulePage';
import { StudentJournalPage } from './pages/student/StudentJournalPage';
import { StudentGradesPage } from './pages/student/StudentGradesPage';
import { RegistrationPage } from './pages/student/RegistrationPage';
import { StudentExamsPage } from './pages/student/StudentExamsPage';
import { StudentPaymentsPage } from './pages/student/StudentPaymentsPage';
import { SchedulePage } from './pages/admin/SchedulePage';
import { ExamsPage } from './pages/admin/ExamsPage';
import { TeacherExamsPage } from './pages/teacher/TeacherExamsPage';
import { PaymentsPage } from './pages/admin/PaymentsPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
import { InstitutesPage } from './pages/admin/InstitutesPage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { StudentsPage } from './pages/admin/StudentsPage';
import { TeachersPage } from './pages/admin/TeachersPage';
import { CurriculumPage } from './pages/admin/CurriculumPage';
import { ProgramsPage } from './pages/admin/ProgramsPage';
import { GroupsPage } from './pages/admin/GroupsPage';
import { AdminsManagePage } from './pages/admin/AdminsManagePage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminRedirect />} />
            <Route path="institutes" element={<InstitutesPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="teachers" element={<TeachersPage />} />
            <Route path="admins" element={<AdminsManagePage />} />

            <Route path="curriculum" element={<CurriculumPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['teacher']} />}>
          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<Navigate to="schedule" replace />} />
            <Route path="schedule" element={<MySchedulePage />} />
            <Route path="disciplines" element={<MyDisciplinesPage />} />
            <Route path="groups" element={<GradeBookPage />} />
            <Route path="groups/:groupId/gradebook" element={<GradeBookPage />} />
            <Route path="exams" element={<TeacherExamsPage />} />
            <Route path="materials" element={<MaterialsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<StudentProfilePage />} />
            <Route path="schedule" element={<StudentSchedulePage />} />
            <Route path="journal" element={<StudentJournalPage />} />
            <Route path="grades" element={<StudentGradesPage />} />
            <Route path="exams" element={<StudentExamsPage />} />
            <Route path="registration" element={<RegistrationPage />} />
            <Route path="payments" element={<StudentPaymentsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
