import { useEffect, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import { uploadProductImage } from "../../../api/commerceApi";
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
import { ConfirmModal } from "./modals";
import ArchiveConfirmModal from "../../../components/ArchiveConfirmModal";
function Products({
  items,
  archivedItems = [],
  query,
  setQuery,
  onAdd,
  onEdit,
  onDelete,
  onRestore,
  onActivate,
  money,
}) {
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [view, setView] = useState("active");
  const [restoringId, setRestoringId] = useState(null);
  const showingArchived = view === "archived";
  const rows = showingArchived ? archivedItems : items;
  const archive = async () => {
    if (!archiveTarget || archiving) return;
    setArchiving(true);
    setArchiveError("");
    try {
      await onDelete(archiveTarget);
      setArchiveTarget(null);
    } catch (e) {
      setArchiveError(
        e?.response?.data?.message ||
          "Couldn't archive this product. Please try again.",
      );
    } finally {
      setArchiving(false);
    }
  };
  const restore = async (p) => {
    if (restoringId) return;
    setRestoringId(p.id);
    try {
      await onRestore?.(p);
    } finally {
      setRestoringId(null);
    }
  };
  return (
    <>
      <div className={s.productsToolbar}>
        <div>
          <h2>Product catalogue</h2>
          <p>Create and manage the products customers can buy.</p>
        </div>
        <div className={s.productsToolbarControls}>
          <div className={s.productsSearch}>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button className={s.primary} onClick={onAdd}>
            ＋ Add Product
          </button>
        </div>
      </div>
      <div className={s.catalogTabs} role="tablist" aria-label="Product view">
        <button
          type="button"
          role="tab"
          aria-selected={!showingArchived}
          className={!showingArchived ? s.catalogTabActive : ""}
          onClick={() => setView("active")}
        >
          Active ({items.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={showingArchived}
          className={showingArchived ? s.catalogTabActive : ""}
          onClick={() => setView("archived")}
        >
          Archived ({archivedItems.length})
        </button>
      </div>
      <Panel
        title={
          showingArchived
            ? `${rows.length} archived product${rows.length === 1 ? "" : "s"}`
            : `${rows.length} products`
        }
        sub={
          showingArchived
            ? "Archived products are hidden from the POS and your store. Restore one to sell it again."
            : "Selling prices are customer-facing. Cost information stays inside the business workspace."
        }
      >
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    <small>{p.brand || "No brand"}</small>
                  </td>
                  <td>{p.category || "Uncategorised"}</td>
                  <td>{p.sku || "—"}</td>
                  <td>{money(p.price)}</td>
                  <td>
                    {p.trackInventory
                      ? `${p.stockQuantity} ${p.unit || "units"}`
                      : "Not tracked"}
                  </td>
                  <td>
                    <span className={s.badge}>
                      {showingArchived ? "ARCHIVED" : p.status}
                    </span>
                    {p.creditActive === false && (
                      <span
                        className={s.badge}
                        title="Not shown to customers until its Ehral Credits charge is paid"
                        style={{ marginLeft: 6 }}
                      >
                        Not activated
                      </span>
                    )}
                  </td>
                  <td>
                    {showingArchived ? (
                      <button
                        className={s.textBtn}
                        onClick={() => restore(p)}
                        disabled={restoringId === p.id}
                      >
                        {restoringId === p.id ? "Restoring…" : "Restore"}
                      </button>
                    ) : (
                      <>
                        <button className={s.textBtn} onClick={() => onEdit(p)}>
                          Edit
                        </button>
                        {p.creditActive === false && (
                          <button
                            className={s.textBtn}
                            onClick={() => onActivate?.(p)}
                          >
                            Activate
                          </button>
                        )}
                        <button
                          className={s.textDanger}
                          onClick={() => {
                            setArchiveError("");
                            setArchiveTarget(p);
                          }}
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {showingArchived && !rows.length && (
            <Empty
              title="No archived products"
              text="Products you archive will appear here so you can restore them."
            />
          )}
          {!showingArchived && !items.length && (
            <Empty
              title="No products yet"
              text="Build your catalogue and start selling from the POS."
              action={
                <button className={s.primary} onClick={onAdd}>
                  Add your first product
                </button>
              }
            />
          )}
        </div>
      </Panel>
      <ArchiveConfirmModal
        open={!!archiveTarget}
        productName={archiveTarget?.name}
        error={archiveError}
        loading={archiving}
        onCancel={() => {
          if (!archiving) setArchiveTarget(null);
        }}
        onConfirm={archive}
      />
    </>
  );
}
function Customers({
  items,
  query,
  setQuery,
  onAdd,
  onInvite,
  onEdit,
  onDelete,
  onView,
}) {
  return (
    <>
      <div className={s.productsToolbar}>
        <div>
          <h2>Customers</h2>
          <p>
            Business-specific customer relationships, kept isolated to this
            business.
          </p>
        </div>
        <div className={s.productsToolbarControls}>
          <div className={`${s.productsSearch} ${s.customersSearch}`}>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers..."
              aria-label="Search customers"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          {onInvite && (
            <button type="button" className={s.outline} onClick={onInvite}>
              <i className="ti ti-user-plus" aria-hidden="true" /> Invite
              customer
            </button>
          )}
          <button className={s.primary} onClick={onAdd}>
            ＋ Add Customer
          </button>
        </div>
      </div>
      <Panel
        title={`${items.length} customer${items.length === 1 ? "" : "s"}`}
        sub="Customer identities are global, while this business relationship remains private."
      >
        <div className={s.customerGrid}>
          {items.map((c) => (
            <div
              className={s.customer}
              key={c.membershipId}
              onClick={() => onView && onView(c)}
              role={onView ? "button" : undefined}
              tabIndex={onView ? 0 : undefined}
              onKeyDown={(e) => {
                if (onView && (e.key === "Enter" || e.key === " ")) onView(c);
              }}
              style={onView ? { cursor: "pointer" } : undefined}
            >
              <div className={s.avatar}>{(c.firstName || "?").slice(0, 1)}</div>
              <div>
                <b>
                  {c.firstName || "Customer"} {c.lastName || ""}
                </b>
                <small>{c.phone || "No phone"}</small>
                <small>{c.email || "No email"}</small>
              </div>
              <div>
                <button
                  className={s.textButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(c);
                  }}
                >
                  Edit
                </button>
                <button
                  className={s.textDanger}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.membershipId);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        {!items.length && (
          <Empty
            title={
              query ? "No customers match your search" : "No customers yet"
            }
            text={
              query
                ? "Try a different name, phone number or email."
                : "Add customers manually, invite one directly, or let storefront interactions establish their business relationship."
            }
            action={
              !query && (
                <button className={s.primary} onClick={onAdd}>
                  Add customer
                </button>
              )
            }
          />
        )}
      </Panel>
    </>
  );
}
function Expenses({ items, query, setQuery, onAdd, onEdit, onDelete, money }) {
  const visible = filteredRows(items, query, ["category", "description"]);
  return (
    <>
      <div className={s.productsToolbar}>
        <div>
          <h2>Expenses</h2>
          <p>Record operating costs separately from owner withdrawals.</p>
        </div>
        <div className={s.productsToolbarControls}>
          <div className={s.productsSearch}>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search expenses..."
              aria-label="Search expenses"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <button className={s.primary} onClick={onAdd}>
            ＋ Add Expense
          </button>
        </div>
      </div>
      <Panel
        title="Expense ledger"
        sub="Rent, salaries, utilities, marketing, repairs and other operating costs."
      >
        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((x) => (
                <tr key={x.id}>
                  <td>{x.expenseDate}</td>
                  <td>
                    <span className={s.badge}>{x.category}</span>
                  </td>
                  <td>{x.description || "—"}</td>
                  <td>{money(x.amount)}</td>
                  <td>
                    {x.ownerWithdrawal
                      ? "Owner withdrawal"
                      : x.recurring
                        ? "Recurring"
                        : "Operating"}
                  </td>
                  <td>
                    <button className={s.textButton} onClick={() => onEdit(x)}>
                      Edit
                    </button>
                    <button
                      className={s.textDanger}
                      onClick={() => onDelete(x.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && (
            <Empty
              title={
                query ? "No expenses match your search" : "No expenses yet"
              }
              text={
                query
                  ? "Try a different category or description."
                  : "Record your first operating expense to start tracking business costs."
              }
              action={
                !query && (
                  <button className={s.primary} onClick={onAdd}>
                    Add expense
                  </button>
                )
              }
            />
          )}
        </div>
      </Panel>
    </>
  );
}

export { Products, Customers, Expenses };
