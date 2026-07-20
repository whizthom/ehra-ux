import API from "./authApi";

export const getMyProfile = () => API.get("/employees/me");

/** Employer-only: saves the employer's own personal profile fields
 *  (phone, gender, dob, address, emergency contact, photo, name).
 *  Applied immediately — there's no approval chain for the employer's
 *  own profile, unlike an employee's supervised fields (see profileEditApi). */
export const updateMyProfile = (data) => API.put("/employees/me", data);

/** Active colleagues in my own department — for the cover-person picker
 *  on the leave request form. Excludes me. Empty if I have no department. */
/** Active department colleagues with availability metadata.
 *  startDate and endDate are optional ISO strings (YYYY-MM-DD).
 *  When provided the backend checks for leave/cover overlaps in that period.
 */
export const getCoverCandidates = (startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (endDate)   params.set("endDate",   endDate);
  const qs = params.toString();
  return API.get(`/employees/cover-candidates${qs ? "?" + qs : ""}`);
};