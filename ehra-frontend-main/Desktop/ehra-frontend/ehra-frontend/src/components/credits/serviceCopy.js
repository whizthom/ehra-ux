// User-facing pricing copy for Ehral services. Presentation only: the amounts shown next to this copy
// always come from the backend billing rules; nothing here sets a price.
export const BUSINESS_OPS_NOTE =
  "These services share one daily Business Operations charge. Using multiple services on the same day does not create multiple ₦75 charges.";

const BUNDLE_LINE = "Part of Business Operations Daily Bundle · maximum per business per day";

export const SERVICE_COPY = {
  ATTENDANCE_CLOCK_IN: { title: "Attendance clock-in", unit: "per employee clock-in event", icon: "ti-login" },
  ATTENDANCE_CLOCK_OUT: { title: "Attendance clock-out", unit: "per employee clock-out event", icon: "ti-logout" },
  DEPARTMENT_MANAGEMENT: { title: "Department Management", unit: BUNDLE_LINE, icon: "ti-building-community", bundle: true },
  LEAVE_MANAGEMENT: { title: "Leave Management", unit: BUNDLE_LINE, icon: "ti-calendar-event", bundle: true },
  EMPLOYEE_MESSAGING: { title: "Employee Messaging", unit: BUNDLE_LINE, icon: "ti-messages", bundle: true },
  PROFILE_EDIT_APPROVAL: { title: "Profile Edit Approval", unit: BUNDLE_LINE, icon: "ti-user-check", bundle: true },
  PENALTY_MANAGEMENT: { title: "Penalty Management", unit: BUNDLE_LINE, icon: "ti-gavel", bundle: true },
  PAYROLL_CALCULATION: { title: "Payroll Calculation", unit: BUNDLE_LINE, icon: "ti-calculator", bundle: true },
  AI_STANDARD_DAILY: {
    title: "Standard AI",
    unit: "per business per day · multiple standard AI interactions the same day are covered by one daily charge",
    icon: "ti-sparkles",
  },
  PRODUCT_ACTIVATION: { title: "Product Activation", icon: "ti-package" },
  POS_RECEIPT: { title: "POS Receipt", icon: "ti-receipt-2" },
  WHATSAPP_CLICK: { title: "WhatsApp Click", icon: "ti-brand-whatsapp" },
};

export const hasBundledServices = (services = []) =>
  services.some((s) => SERVICE_COPY[s.serviceCode]?.bundle);
