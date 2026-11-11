import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from './api';
import { useAuth } from './auth';
import { Login, Register } from './pages/auth';
import { FindDoctor, DoctorSlots, PatientHome, ProfilePage } from './pages/patient';
import { DoctorDay, PatientRecordPage, ReceptionDay, ReceptionQueue } from './pages/staff';
import { AdminAudit, AdminSlots, AdminUsers } from './pages/admin';
import { Button } from './ui';

const HOME: Record<Role, string> = { PATIENT: '/home', RECEPTIONIST: '/reception', DOCTOR: '/doctor', ADMIN: '/admin' };
const NAV: Record<Role, [string, string][]> = {
  PATIENT: [['/home', 'My care'], ['/doctors', 'Find a doctor'], ['/profile', 'My details']],
  RECEPTIONIST: [['/reception', "Today's schedule"], ['/reception/waitlist', 'Waitlist']],
  DOCTOR: [['/doctor', 'My day']],
  ADMIN: [['/admin', 'Users'], ['/admin/slots', 'Slots'], ['/admin/audit', 'Audit log'], ['/reception', 'Schedule'], ['/reception/waitlist', 'Waitlist']],
};

function Shell() {
  const { session, logout } = useAuth();
  const { pathname } = useLocation();
  if (!session) return <Navigate to="/login" replace />;
  return (
    <>
      <a className="skip" href="#main">Skip to main content</a>
      <header className="topbar">
        <strong className="brand"><span className="mark" aria-hidden="true" />ClinicQ</strong>
        <nav aria-label="Main">
          {NAV[session.role].map(([to, label]) => (
            <NavLink key={to} to={to} end>{label}</NavLink>
          ))}
        </nav>
        <span className="who">{session.fullName} · {session.role.toLowerCase()}</span>
        <Button variant="link" onClick={logout}>Sign out</Button>
      </header>
      <main id="main" tabIndex={-1} key={pathname}><Outlet /></main>
    </>
  );
}

function Guard({ role, children }: { role: Role | Role[]; children: JSX.Element }) {
  const { session } = useAuth();
  const roles = Array.isArray(role) ? role : [role];
  if (!session) return <Navigate to="/login" replace />;
  return roles.includes(session.role) ? children : <Navigate to={HOME[session.role]} replace />;
}

export default function App() {
  const { session } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={HOME[session.role]} replace /> : <Login />} />
      <Route path="/register" element={session ? <Navigate to={HOME[session.role]} replace /> : <Register />} />
      <Route element={<Shell />}>
        <Route path="/home" element={<Guard role="PATIENT"><PatientHome /></Guard>} />
        <Route path="/doctors" element={<Guard role="PATIENT"><FindDoctor /></Guard>} />
        <Route path="/doctors/:id" element={<Guard role="PATIENT"><DoctorSlots /></Guard>} />
        <Route path="/profile" element={<Guard role="PATIENT"><ProfilePage /></Guard>} />
        <Route path="/reception" element={<Guard role={['RECEPTIONIST', 'ADMIN']}><ReceptionDay /></Guard>} />
        <Route path="/reception/waitlist" element={<Guard role={['RECEPTIONIST', 'ADMIN']}><ReceptionQueue /></Guard>} />
        <Route path="/doctor" element={<Guard role="DOCTOR"><DoctorDay /></Guard>} />
        <Route path="/doctor/appointments/:id" element={<Guard role="DOCTOR"><PatientRecordPage /></Guard>} />
        <Route path="/admin" element={<Guard role="ADMIN"><AdminUsers /></Guard>} />
        <Route path="/admin/slots" element={<Guard role="ADMIN"><AdminSlots /></Guard>} />
        <Route path="/admin/audit" element={<Guard role="ADMIN"><AdminAudit /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to={session ? HOME[session.role] : '/login'} replace />} />
    </Routes>
  );
}
