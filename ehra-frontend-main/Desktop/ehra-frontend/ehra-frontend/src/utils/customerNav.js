// The customer navigation, defined once: [tab id, label, Tabler icon].
// Used by the customer sidebar (components/CustomerShell.jsx) and the
// dashboard's own title lookup, so the two can never disagree.
export const CUSTOMER_NAV_ITEMS = [
  ["home", "Dashboard", "layout-dashboard"],
  ["discover", "Discover", "compass"],
  ["businesses", "My businesses", "building-store"],
  ["orders", "Orders", "shopping-bag"],
  ["receipts", "Receipts", "receipt"],
  ["messages", "Messages", "messages"],
  ["spending", "Spending", "chart-donut"],
  ["account", "Account", "user-circle"],
];