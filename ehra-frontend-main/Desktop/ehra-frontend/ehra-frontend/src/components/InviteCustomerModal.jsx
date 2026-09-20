import InviteModal from "./InviteModal";

// The Customers tab's "Invite customer" button. Same three ways to
// invite as InviteEmployeeModal (one link / reusable link / invite by
// email), pointed at CUSTOMER invitations instead of EMPLOYEE ones - see
// InviteModal's doc and InvitationType on the backend.
//
// Whoever accepts the link becomes a customer of this business: if they
// already have an Ehral account they simply log in and the relationship
// is attached to it (see InvitationLanding.jsx); otherwise they create a
// brand-new account and are connected as a customer the moment they
// finish (see CustomerInvitationRegistration.jsx).
export default function InviteCustomerModal({ open, onClose, companyName }) {
  return (
    <InviteModal
      open={open}
      onClose={onClose}
      companyName={companyName}
      type="CUSTOMER"
      title="Invite a customer"
      description="Send a customer a link to connect with your business on Ehral. If they already have an Ehral account they just log in; otherwise they'll create one in a couple of steps - either way they're linked to your business as a customer the moment they finish."
    />
  );
}
