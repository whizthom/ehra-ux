import "./EmployeeProfileModal.css";

export default function EmployeeProfileModal({
  employee,
  onClose
}) {
  if (!employee) return null;

  return (
    <div className="employee-modal-overlay">
      <div className="employee-modal">

        <div className="modal-header">
          <h2>Employee Profile</h2>

          <button
            className="close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="employee-avatar">
          {employee.name.charAt(0)}
        </div>

        <h3>{employee.name}</h3>

        <p className="employee-role">
          Department: {employee.department}
        </p>

        <div className="profile-grid">
          <div>
            <strong>Email</strong>
            <p>{employee.email}</p>
          </div>

          <div>
            <strong>Phone</strong>
            <p>{employee.phone}</p>
          </div>

          <div>
            <strong>Status</strong>
            <p>{employee.status}</p>
          </div>

          <div>
            <strong>Employee ID</strong>
            <p>EMP-{employee.id}</p>
          </div>
        </div>

        <div className="attendance-summary">
          <h4>Attendance Summary</h4>

          <div className="attendance-cards">
            <div>
              <h3>96%</h3>
              <p>Attendance Rate</p>
            </div>

            <div>
              <h3>182</h3>
              <p>Present</p>
            </div>

            <div>
              <h3>5</h3>
              <p>Absent</p>
            </div>

            <div>
              <h3>9</h3>
              <p>Late</p>
            </div>
          </div>
        </div>

        <div className="history-section">
          <h4>Recent Attendance</h4>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>16 Jun</td>
                <td>08:02</td>
                <td>17:00</td>
                <td>Present</td>
              </tr>

              <tr>
                <td>15 Jun</td>
                <td>08:11</td>
                <td>17:02</td>
                <td>Late</td>
              </tr>

              <tr>
                <td>14 Jun</td>
                <td>08:00</td>
                <td>17:01</td>
                <td>Present</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="action-buttons">
          <button>
            Assign Department
          </button>

          <button>
            Promote Employee
          </button>

          <button>
            Deactivate
          </button>

          <button className="danger">
            Delete Employee
          </button>
        </div>

      </div>
    </div>
  );
}