import InviteModal from "./InviteModal";

// Thin wrapper kept so every existing call site (BusinessSettingsTab,
// staff.jsx, etc.) keeps working unchanged - the actual three-tab
// (single link / reusable link / invite by email) implementation now
// lives in InviteModal, shared with InviteCustomerModal.
export default function InviteEmployeeModal({ open, onClose, companyName }) {
  return (
    <InviteModal
      open={open}
      onClose={onClose}
      companyName={companyName}
      type="EMPLOYEE"
    />
  );
}
