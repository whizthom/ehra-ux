import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import {
  getWhatsAppSettings,
  saveWhatsAppSettings,
} from "../../../api/whatsappApi";
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
import { RetailEmployees } from "./staff";
function Settings({ type, business, owner, onBack }) {
  const [wa, setWa] = useState({
    phoneNumber: "",
    countryCode: "",
    enabled: true,
  });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    getWhatsAppSettings()
      .then((r) => setWa(r.data || wa))
      .catch(() => {});
  }, []);
  const save = async () => {
    await saveWhatsAppSettings(wa);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return (
    <>
      <div className={s.toolbar}>
        <div>
          <h2>Retail settings</h2>
          <p>
            Business classification, workspace controls and customer channels.
          </p>
        </div>
        <button className={s.outline} onClick={onBack}>
          Switch workspace
        </button>
      </div>
      <div className={s.grid2}>
        <Panel
          title="Business type"
          sub="Business Type is a property of the Business and cannot be changed after confirmation."
        >
          <div className={s.lockedSetting}>
            <span>Retail</span>
            <strong>🔒 Locked</strong>
            <small>Confirmed for {business?.name}</small>
          </div>
        </Panel>
        <Panel
          title="WhatsApp customer channel"
          sub="Ehral creates customer-initiated links. It does not automatically send messages."
        >
          <div className={s.formGrid}>
            <Field
              label="WhatsApp number"
              value={wa.phoneNumber || ""}
              onChange={(e) => setWa({ ...wa, phoneNumber: e.target.value })}
              placeholder="e.g. 2348012345678"
            />
            <Field
              label="Country code"
              value={wa.countryCode || ""}
              onChange={(e) =>
                setWa({ ...wa, countryCode: e.target.value.replace(/\D/g, "") })
              }
              placeholder="234"
            />
          </div>
          <label className={s.toggle}>
            <input
              type="checkbox"
              checked={wa.enabled !== false}
              onChange={(e) => setWa({ ...wa, enabled: e.target.checked })}
            />
            <span>Enable WhatsApp links</span>
          </label>
          <button className={s.primary} onClick={save}>
            {saved ? "Saved" : "Save WhatsApp settings"}
          </button>
        </Panel>
      </div>
      <div className={s.grid2}>
        {/* FIX: reaching this Settings screen already required owner || canSettings
    (see RetailWorkspace.jsx's NAV/PERM gate) - re-checking `owner` alone here
    hid the staff panel from any employee who was granted "settings" access,
    even after the backend was fixed to let them use it. */}
        <RetailEmployees />
        <Panel
          title="Workspace switching"
          sub="Changing your current workspace does not change your Business Type."
        >
          <button className={s.workspaceCard} onClick={onBack}>
            <span>e</span>
            <div>
              <b>Ehral Dashboard</b>
              <small>Your existing employer workspace remains intact</small>
            </div>
            →
          </button>
          <div className={s.workspaceCardActive}>
            <span>R</span>
            <div>
              <b>Retail Workspace</b>
              <small>Products, sales, inventory, suppliers and reports</small>
            </div>
            <strong>Current</strong>
          </div>
        </Panel>
      </div>
    </>
  );
}

export { Settings };
