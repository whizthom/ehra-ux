// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD.JSX — Patch Instructions (3 changes only)
// ════════════════════════════════════════════════════════════════════════════
//
// CHANGE 1 ── Add import at the top (alongside other tab imports)
// ─────────────────────────────────────────────────────────────────────────────

// BEFORE (around line 16):
import LeavesTab from "../components/LeavesTab";

// AFTER:
import LeavesTab from "../components/LeavesTab";
import DepartmentsTab from "../components/DepartmentsTab";   // ← ADD THIS


// ─────────────────────────────────────────────────────────────────────────────
// CHANGE 2 ── Add "Departments" to the contentFull condition (~line 775)
// ─────────────────────────────────────────────────────────────────────────────

// BEFORE:
          activeNav === "Messages" ||
          activeNav === "Workforce" ||
          activeNav === "Attendance" ||
          activeNav === "Leave"

// AFTER:
          activeNav === "Messages" ||
          activeNav === "Workforce" ||
          activeNav === "Attendance" ||
          activeNav === "Leave"    ||
          activeNav === "Departments"


// ─────────────────────────────────────────────────────────────────────────────
// CHANGE 3 ── Add the Departments render branch (~line 783)
// ─────────────────────────────────────────────────────────────────────────────

// BEFORE:
{
    activeNav === "Workforce" ? (
        <WorkforceTab departments={departments} />
    ) : activeNav === "Messages" ? (

        // AFTER:
        { activeNav === "Departments" ? (
            <DepartmentsTab />
        ) : activeNav === "Workforce" ? (
            <WorkforceTab departments={departments} />
        ) : activeNav === "Messages" ? ()


// ════════════════════════════════════════════════════════════════════════════
// That's it — DepartmentsTab manages its own data fetching and real-time SSE.
// No props need to be passed in from Dashboard.
// ════════════════════════════════════════════════════════════════════════════