import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";
import ScrollRestoration from "./components/ScrollRestoration";
import RouteLoading from "./components/RouteLoading";

import InstallPrompt from "./pwa/InstallPrompt";
import UpdateToast from "./pwa/UpdateToast";
import OfflineBanner from "./pwa/OfflineBanner";
import ThemeColorSync from "./theme/ThemeColorSync";

// Auth/public entry pages stay eagerly bundled — one of these is always
// the very first thing an unauthenticated visitor paints, so splitting
// them into their own chunk would just add a network round trip to the
// critical path for zero benefit.
import Register from "./pages/Register";
import CompleteSetup from "./pages/CompleteSetup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";

import InvitationLanding from "./pages/public/InvitationLanding";
import EmployeeRegistration from "./pages/public/EmployeeRegistration";
import RegistrationSubmitted from "./pages/public/RegistrationSubmitted";
import QrDisplayPage from "./pages/public/QrDisplayPage";

import NotFound from "./pages/NotFound";

// Everything behind a login stays out of the initial bundle — these are
// the heaviest pages in the app (Dashboard.jsx and EmployeeDashboard.jsx
// alone are ~100KB and ~70KB of source each) and are never needed until
// after authentication succeeds, so there's no reason to ship them to a
// visitor who's still looking at the login form.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SelectWorkspace = lazy(() => import("./pages/SelectWorkspace"));
const ScanAttendance = lazy(() => import("./pages/ScanAttendance"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const EmployeeProfilePage = lazy(() => import("./pages/EmployeeProfilePage"));
const MyAccountsPage = lazy(() => import("./pages/MyAccountsPage"));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollRestoration />
        <ThemeColorSync />
        <OfflineBanner />
        <UpdateToast />

        <Suspense fallback={<RouteLoading />}>
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

            {/* PUBLIC QR DISPLAY — the "share a link instead of admin access"
                feature. Reachable at /qr-display/:token with no login at
                all; the token is the QrDisplayLink's opaque share token
                (see AttendanceController's public /qr/display/{token}
                endpoint), not a JWT or any kind of session credential. */}
            <Route path="/qr-display/:token" element={<QrDisplayPage />} />

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

            {/* Numeric today, kept as a single dynamic segment on purpose —
                react-router treats `:id` as an opaque string regardless of
                what's in it, so the route itself needs zero changes to
                accept UUIDs later. The one thing that WOULD need a
                one-line update at that point is EmployeeProfilePage's
                `Number(id)` call (used when messaging a coworker from
                their profile) — everywhere else `id` already flows
                through untouched as a string. */}
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

            {/* Catch-all — anything that doesn't match a route above
                (typo'd URL, stale bookmark, removed page) gets a friendly
                404 screen instead of react-router silently rendering
                nothing. Must stay LAST. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>

        <InstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
