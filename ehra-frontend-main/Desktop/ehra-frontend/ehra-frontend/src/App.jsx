import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";

import Register from "./pages/Register";
import CompleteSetup from "./pages/CompleteSetup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import SelectWorkspace from "./pages/SelectWorkspace";

import InvitationLanding from "./pages/public/InvitationLanding";
import EmployeeRegistration from "./pages/public/EmployeeRegistration";
import RegistrationSubmitted from "./pages/public/RegistrationSubmitted";

import ScanAttendance from "./pages/ScanAttendance";
import EmployeeDashboard from "./pages/EmployeeDashboard";

import EmployeeProfilePage from "./pages/EmployeeProfilePage";
import MyAccountsPage from "./pages/MyAccountsPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* PUBLIC ROUTES */}

          <Route path="/" element={<Register />} />

          <Route path="/complete-setup" element={<CompleteSetup />} />

          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Shown after login when the Identity holds more than one
              membership and hasn't picked an active workspace yet.
              Protected only by "is logged in" — ProtectedRoute's
              needsContextSelection redirect deliberately leaves this path
              alone (see ProtectedRoute.jsx) so it doesn't loop. */}
          <Route
            path="/select-workspace"
            element={
              <ProtectedRoute>
                <SelectWorkspace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/unauthorized"
            element={
              <div style={{ padding: 40, textAlign: "center" }}>
                <h2>You don't have access to this page.</h2>
              </div>
            }
          />

          {/* EMPLOYEE INVITATION FLOW */}

          <Route path="/invite/:token" element={<InvitationLanding />} />

          <Route path="/register/:token" element={<EmployeeRegistration />} />

          <Route
            path="/registration-submitted"
            element={<RegistrationSubmitted />}
          />

          {/* EMPLOYER DASHBOARD */}

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["ROLE_ADMIN"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* EMPLOYEE DASHBOARD */}

          <Route
            path="/my-dashboard"
            element={
              <ProtectedRoute roles={["ROLE_EMPLOYEE"]}>
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />

          {/* EMPLOYEE ATTENDANCE (standalone deep links, still supported).
              ROLE_ADMIN is included because an employer who has turned on
              "Personal attendance profile" (Settings) clocks in/out here
              exactly like any employee — the backend rejects the scan if
              that setting is off. */}

          <Route
            path="/my-attendance"
            element={
              <ProtectedRoute roles={["ROLE_EMPLOYEE", "ROLE_ADMIN"]}>
                <ScanAttendance />
              </ProtectedRoute>
            }
          />

          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute roles={["ROLE_ADMIN", "ROLE_EMPLOYEE"]}>
                <EmployeeProfilePage />
              </ProtectedRoute>
            }
          />

          {/* MY ACCOUNTS — full-page Employer/Employee workspace switcher,
              reachable from the "My Accounts" nav item on either dashboard. */}

          <Route
            path="/my-accounts"
            element={
              <ProtectedRoute roles={["ROLE_ADMIN", "ROLE_EMPLOYEE"]}>
                <MyAccountsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
