import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import {
  getRetailEmployees,
  setRetailEmployeeRole,
  setRetailEmployeePermissions,
} from "../../../api/retailApi";
import {
  Modal,
  Field,
  Empty,
  Metric,
  Panel,
  Toolbar,
  filteredRows,
  PaymentHistory,
  RETAIL_CATEGORIES,
  today,
} from "./shared";
import { GlassSelect } from "./GlassSelect";

const ROLES = [
  "EMPLOYEE",
  "HOD",
  "MANAGER",
  "CASHIER",
  "SALESPERSON",
  "INVENTORY_MANAGER",
  "DELIVERY_STAFF",
];
const ROLE_OPTIONS = ROLES.map((r) => ({
  value: r,
  label: r
    .replace(/_/g, " ")
    .replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase()),
}));
const PERMISSIONS = [
  [
    "retailWorkspace",
    "Workspace access",
    "Lets the employee enter the Retail Workspace at all",
  ],
  ["canSales", "Sales / POS", ""],
  ["canInventory", "Inventory", ""],
  ["canOrders", "Orders", ""],
  ["canCustomers", "Customers", ""],
  ["canFinance", "Finance", ""],
  ["canSettings", "Settings", ""],
  [
    "canMessages",
    "Customer messages",
    "Lets the employee chat with customers and send them announcements",
  ],
];

function RetailEmployees() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  useEffect(() => {
    import("../../../api/retailApi")
      .then((m) => m.getRetailEmployees())
      .then((r) => setItems(r.data || []))
      .catch((e) => setError(e?.response?.data?.message || ""));
  }, []);

  const change = async (id, role) => {
    setSavingId(id);
    try {
      const m = await import("../../../api/retailApi");
      const r = await m.setRetailEmployeeRole(id, role);
      setItems((a) => a.map((x) => (x.membershipId === id ? r.data : x)));
    } catch (e) {
      setError(e?.response?.data?.message || "Could not update role.");
    } finally {
      setSavingId(null);
    }
  };

  const toggle = async (x, key) => {
    const next = {
      retailWorkspace: x.retailWorkspace,
      canSales: x.canSales,
      canInventory: x.canInventory,
      canOrders: x.canOrders,
      canCustomers: x.canCustomers,
      canFinance: x.canFinance,
      canSettings: x.canSettings,
      canMessages: x.canMessages,
    };
    next[key] = !next[key];
    if (key !== "retailWorkspace" && !next.retailWorkspace)
      next.retailWorkspace = true;
    setSavingId(x.membershipId);
    try {
      const m = await import("../../../api/retailApi");
      const r = await m.setRetailEmployeePermissions(x.membershipId, next);
      setItems((a) =>
        a.map((y) => (y.membershipId === x.membershipId ? r.data : y)),
      );
    } catch (e) {
      setError(e?.response?.data?.message || "Could not update permissions.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Panel
      title="Retail staff permissions"
      sub="The employer controls which employees can enter the Retail Workspace and which business functions they can use. Roles describe the employee's position. The permissions below are the employer's final business-specific authority."
    >
      {error && <div className={s.error}>{error}</div>}
      <div className={s.staffGrid}>
        {items.map((x) => {
          const busy = savingId === x.membershipId;
          return (
            <div
              className={`${s.staffCard} ${busy ? s.staffCardBusy : ""}`}
              key={x.membershipId}
            >
              <div className={s.staffCardHead}>
                <div className={s.avatar}>
                  {(x.firstName || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className={s.staffCardName}>
                  <b>
                    {x.firstName} {x.lastName}
                  </b>
                  <small>{x.phone || "No phone on file"}</small>
                </div>
              </div>
              <GlassSelect
                label="Role"
                value={x.role || "EMPLOYEE"}
                disabled={busy}
                onChange={(v) => change(x.membershipId, v)}
                options={ROLE_OPTIONS}
              />
              <div className={s.staffPermLabel}>Business function access</div>
              <div className={s.staffPermGrid}>
                {PERMISSIONS.map(([key, label, hint]) => (
                  <label
                    className={s.staffPermToggle}
                    key={key}
                    title={hint || undefined}
                  >
                    <input
                      type="checkbox"
                      checked={!!x[key]}
                      disabled={busy}
                      onChange={() => toggle(x, key)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!items.length && !error && (
        <Empty
          title="No employees yet"
          text="Employees invited through the existing Ehral workforce system will appear here."
        />
      )}
    </Panel>
  );
}

export { RetailEmployees };
