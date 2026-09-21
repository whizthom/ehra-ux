import { useEffect, useState } from "react";
import { getCustomers } from "../api/commerceApi";
import styles from "./CustomersTab.module.css";
import { buildWhatsAppLink } from "../api/whatsappApi";
export default function CustomersTab() {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    getCustomers()
      .then((r) => setItems(r.data || []))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div className={styles.wrap}>
      <h2>Customers</h2>
      <p>
        Customers connected to this business. Their information is
        business-specific and is not public.
      </p>
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          No registered customer memberships yet. Public orders can still be
          placed without requiring an Ehral account.
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((c) => (
            <div className={styles.card} key={c.membershipId}>
              <div className={styles.avatar}>
                {c.profileImage ? (
                  <img src={c.profileImage} alt="" />
                ) : (
                  <>
                    {(c.firstName || "?")[0]}
                    {(c.lastName || "")[0]}
                  </>
                )}
              </div>
              <div>
                <strong>
                  {[c.firstName, c.lastName].filter(Boolean).join(" ") ||
                    "Customer"}
                </strong>
                <span>{c.phone || "No phone"}</span>
                <span>{c.email || "No email"}</span>
              </div>
              <div className={styles.actions}>
                {c.phone && (
                  <button
                    onClick={() =>
                      (window.location.href = buildWhatsAppLink(
                        c.phone,
                        `Hello ${c.firstName || ""}, I am contacting you from Ehral regarding your customer relationship with this business.`,
                      ))
                    }
                  >
                    Contact on WhatsApp
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
