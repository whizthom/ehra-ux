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
function ProductModal({
  item,
  onClose,
  onSave,
  canFinance = true,
  currency = "NGN",
}) {
  let initialVariants = [];
  let initialImages = [];
  try {
    const parsed = item?.variantsJson ? JSON.parse(item.variantsJson) : [];
    initialVariants = Array.isArray(parsed) ? parsed : [];
  } catch {}
  try {
    const parsed = item?.imagesJson ? JSON.parse(item.imagesJson) : [];
    initialImages = Array.isArray(parsed) ? parsed : [];
  } catch {}
  if (!initialImages.length && item?.imageUrl) initialImages = [item.imageUrl];
  const [d, setD] = useState({
    name: item?.name || "",
    description: item?.description || "",
    price: item?.price || "",
    currency: item?.currency || currency,
    category: item?.category || "",
    brand: item?.brand || "",
    sku: item?.sku || "",
    barcode: item?.barcode || "",
    costPrice: item?.costPrice || 0,
    discount: item?.discount || 0,
    tax: item?.tax || 0,
    wholesalePrice: item?.wholesalePrice || "",
    lowStockThreshold: item?.lowStockThreshold || 5,
    unit: item?.unit || "unit",
    stockQuantity: item?.stockQuantity || 0,
    trackInventory: item?.trackInventory ?? true,
    status: item?.status || "ACTIVE",
    imageUrl: item?.imageUrl || "",
    tags: item?.tags || "",
    imagesJson: item?.imagesJson || "",
    imageFiles: initialImages,
    variants: initialVariants,
  });
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const addVariant = () =>
    setD((x) => ({
      ...x,
      variants: [
        ...(x.variants || []),
        {
          name: "Size",
          value: "",
          sku: "",
          price: x.price || 0,
          quantity: 0,
          image: "",
        },
      ],
    }));
  const updateVariant = (i, k, v) =>
    setD((x) => ({
      ...x,
      variants: x.variants.map((a, n) => (n === i ? { ...a, [k]: v } : a)),
    }));
  const removeVariant = (i) =>
    setD((x) => ({ ...x, variants: x.variants.filter((_, n) => n !== i) }));
  const handleImages = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 8 * 1024 * 1024) continue;
        const r = await uploadProductImage(file);
        if (r?.data?.url) urls.push(r.data.url);
      }
      setD((x) => {
        const merged = [...(x.imageFiles || []), ...urls].filter(
          (u, i, a) => a.indexOf(u) === i,
        );
        return { ...x, imageFiles: merged, imageUrl: merged[0] || "" };
      });
    } finally {
      setUploading(false);
    }
  };
  const removeImage = (u) =>
    setD((x) => {
      const imageFiles = (x.imageFiles || []).filter((a) => a !== u);
      return { ...x, imageFiles, imageUrl: imageFiles[0] || "" };
    });
  const submit = () =>
    onSave({
      ...d,
      price: Number(d.price),
      costPrice: Number(d.costPrice || 0),
      stockQuantity: Number(d.stockQuantity || 0),
      lowStockThreshold: Number(d.lowStockThreshold || 5),
      imagesJson: JSON.stringify(d.imageFiles || []),
      imageUrl: d.imageFiles?.[0] || d.imageUrl,
      variantsJson: JSON.stringify(d.variants || []),
    });
  return (
    <Modal
      title={item ? "Edit product" : "Add product"}
      onClose={onClose}
      className={s.productModal}
    >
      <div className={s.productModalBody}>
        <div className={s.productIntro}>
          <div className={s.productIntroIcon}>▦</div>
          <div>
            <strong>
              {item
                ? "Update your product details"
                : "Create a product customers can buy"}
            </strong>
            <p>
              {item
                ? "Keep pricing, inventory and product information accurate."
                : "Add the essentials now. You can refine inventory later."}
            </p>
          </div>
        </div>
        <div className={s.productSection}>
          <div className={s.productSectionHead}>
            <span>01</span>
            <div>
              <h3>Product information</h3>
              <p>Give customers the details they need to identify this item.</p>
            </div>
          </div>
          <div className={s.formGrid}>
            <Field
              label="Product name"
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Classic Cotton T-Shirt"
            />
            <label className={s.field}>
              <span>Category</span>
              <select
                value={d.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">Select category</option>
                {RETAIL_CATEGORIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <Field
              label="Brand"
              value={d.brand}
              onChange={(e) => set("brand", e.target.value)}
              placeholder="Optional"
            />
            <Field
              label="SKU"
              value={d.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="Optional"
            />
            <Field
              label="Barcode"
              value={d.barcode}
              onChange={(e) => set("barcode", e.target.value)}
              placeholder="Optional"
            />
            <Field
              label="Tags"
              value={d.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="new, premium, popular"
            />
            <label className={`${s.fieldWide} ${s.descriptionField}`}>
              <span>
                Description <em>Optional</em>
              </span>
              <div className={s.descriptionBox}>
                <textarea
                  className={s.productDescription}
                  maxLength={2000}
                  value={d.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Tell customers what makes this product useful, distinctive, or worth buying. You can include features, materials, sizing, care instructions, or other helpful details."
                />
                <div className={s.descriptionMeta}>
                  <small>
                    Optional · A clear description helps customers understand
                    the product.
                  </small>
                  <small className={s.charCount}>
                    {d.description.length}/2000
                  </small>
                </div>
              </div>
            </label>
          </div>
        </div>
        <div className={s.productSection}>
          <div className={s.productSectionHead}>
            <span>02</span>
            <div>
              <h3>Product images</h3>
              <p>Use clear images that make the product easy to recognize.</p>
            </div>
          </div>
          <label className={s.imagePicker}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleImages(Array.from(e.target.files || []))}
            />
            <div className={s.imagePickerIcon}>＋</div>
            <div>
              <strong>
                {uploading ? "Uploading images…" : "Choose product images"}
              </strong>
              <small>
                PNG, JPG or WEBP · Up to 8 MB each · Multiple images supported
              </small>
            </div>
            <span className={s.imagePickerButton}>
              {uploading ? "Please wait" : "Choose images"}
            </span>
          </label>
          {(d.imageFiles || []).length > 0 && (
            <div className={s.productImageGrid}>
              {d.imageFiles.map((u, i) => (
                <div className={s.productImageCard} key={u}>
                  <img src={u} alt="Product preview" />
                  <button
                    type="button"
                    className={s.imageRemove}
                    onClick={() => removeImage(u)}
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                  {i === 0 && <span>Primary</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={s.productSection}>
          <div className={s.productSectionHead}>
            <span>03</span>
            <div>
              <h3>Pricing & inventory</h3>
              <p>
                Set customer pricing and the stock information used by your
                workspace.
              </p>
            </div>
          </div>
          <div className={s.formGrid}>
            <Field
              label={`Selling price (${d.currency || currency})`}
              type="number"
              min="0"
              step="0.01"
              value={d.price}
              onChange={(e) => set("price", e.target.value)}
            />
            <Field
              label={`Cost price (${d.currency || currency})`}
              type="number"
              min="0"
              step="0.01"
              value={d.costPrice}
              onChange={(e) => set("costPrice", e.target.value)}
              disabled={!canFinance}
            />
            {canFinance && (
              <Field
                label={`Wholesale price (${d.currency || currency})`}
                type="number"
                min="0"
                step="0.01"
                value={d.wholesalePrice}
                onChange={(e) => set("wholesalePrice", e.target.value)}
              />
            )}
            <Field
              label="Discount"
              type="number"
              min="0"
              step="0.01"
              value={d.discount}
              onChange={(e) => set("discount", e.target.value)}
            />
            <Field
              label="Tax per unit"
              type="number"
              min="0"
              step="0.01"
              value={d.tax}
              onChange={(e) => set("tax", e.target.value)}
            />
            <Field
              label={
                item
                  ? "Stock quantity (use Inventory to adjust)"
                  : "Initial stock quantity"
              }
              type="number"
              min="0"
              value={d.stockQuantity}
              disabled={!!item}
              onChange={(e) => set("stockQuantity", e.target.value)}
            />
            <Field
              label="Low-stock threshold"
              type="number"
              min="0"
              value={d.lowStockThreshold}
              onChange={(e) => set("lowStockThreshold", e.target.value)}
            />
            <Field
              label="Unit"
              value={d.unit}
              onChange={(e) => set("unit", e.target.value)}
              placeholder="unit, kg, litre…"
            />
          </div>
        </div>
        <div className={s.productSection}>
          <div className={s.productSectionHead}>
            <span>04</span>
            <div>
              <h3>Variants</h3>
              <p>
                Add sizes, colors or other variations when one product has
                multiple options.
              </p>
            </div>
          </div>
          <div className={s.variantList}>
            {(d.variants || []).map((v, i) => (
              <div className={s.variantCard} key={i}>
                <div className={s.variantHeader}>
                  <strong>Variant {i + 1}</strong>
                  <button
                    type="button"
                    className={s.textDanger}
                    onClick={() => removeVariant(i)}
                  >
                    Remove
                  </button>
                </div>
                <div className={s.formGrid}>
                  <Field
                    label="Name"
                    value={v.name || ""}
                    onChange={(e) => updateVariant(i, "name", e.target.value)}
                  />
                  <Field
                    label="Value"
                    value={v.value || ""}
                    onChange={(e) => updateVariant(i, "value", e.target.value)}
                  />
                  <Field
                    label="SKU"
                    value={v.sku || ""}
                    onChange={(e) => updateVariant(i, "sku", e.target.value)}
                  />
                  <Field
                    label="Price"
                    type="number"
                    value={v.price || 0}
                    onChange={(e) =>
                      updateVariant(i, "price", Number(e.target.value))
                    }
                  />
                  <div className={`${s.fieldWide} ${s.variantImageField}`}>
                    <span>
                      Variant image <em>Optional</em>
                    </span>
                    <label className={s.variantImagePicker}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (
                            !f.type.startsWith("image/") ||
                            f.size > 8 * 1024 * 1024
                          )
                            return;
                          const r = await uploadProductImage(f);
                          if (r?.data?.url)
                            updateVariant(i, "image", r.data.url);
                        }}
                      />
                      <div className={s.variantImagePreview}>
                        {v.image ? (
                          <img src={v.image} alt="Variant preview" />
                        ) : (
                          <span>＋</span>
                        )}
                      </div>
                      <div className={s.variantImageCopy}>
                        <strong>
                          {v.image
                            ? "Change variant image"
                            : "Add variant image"}
                        </strong>
                        <small>PNG, JPG or WEBP · Up to 8 MB</small>
                      </div>
                      <span className={s.variantImageButton}>
                        {v.image ? "Change image" : "Choose image"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={s.addVariantButton}
            onClick={addVariant}
          >
            ＋ Add variant
          </button>
        </div>
      </div>
      <div className={`${s.modalFoot} ${s.productModalFoot}`}>
        <button className={s.outline} onClick={onClose}>
          Cancel
        </button>
        <button
          className={s.primary}
          disabled={!d.name.trim() || !d.price || uploading}
          onClick={submit}
        >
          {item ? "Save changes" : "Save product"}
        </button>
      </div>
    </Modal>
  );
}

function PurchaseModal({ products, suppliers, onClose, onSave }) {
  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [paid, setPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([
    { productId: "", quantity: 1, unitCost: "" },
  ]);
  const update = (i, k, v) =>
    setItems((a) => a.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  const addRow = () =>
    setItems((a) => [...a, { productId: "", quantity: 1, unitCost: "" }]);
  const remove = (i) => setItems((a) => a.filter((_, n) => n !== i));
  const total = items.reduce(
    (n, x) => n + Number(x.quantity || 0) * Number(x.unitCost || 0),
    0,
  );
  return (
    <Modal title="Record purchase" onClose={onClose}>
      <div className={s.formGrid}>
        <label className={s.field}>
          <span>Supplier</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Select supplier</option>
            {(suppliers || []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Purchase date"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
        />
        <label className={s.field}>
          <span>Payment method</span>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option>CASH</option>
            <option>POS</option>
            <option>BANK_TRANSFER</option>
            <option>OTHER</option>
          </select>
        </label>
        <Field
          label="Paid now"
          type="number"
          min="0"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
        />
      </div>
      <div className={s.fieldWide}>
        <span>Items</span>
        {items.map((x, i) => (
          <div className={s.formGrid} key={i}>
            <label className={s.field}>
              <span>Product</span>
              <select
                value={x.productId}
                onChange={(e) => update(i, "productId", e.target.value)}
              >
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Quantity"
              type="number"
              min="0.001"
              step="0.001"
              value={x.quantity}
              onChange={(e) => update(i, "quantity", e.target.value)}
            />
            <Field
              label="Unit cost"
              type="number"
              min="0"
              step="0.01"
              value={x.unitCost}
              onChange={(e) => update(i, "unitCost", e.target.value)}
            />
            <button
              type="button"
              className={s.textDanger}
              onClick={() => remove(i)}
              disabled={items.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={s.outline} onClick={addRow}>
          ＋ Add item
        </button>
      </div>
      <Field
        label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className={s.modalFoot}>
        <strong>Total: {money(total)}</strong>
        <button className={s.outline} onClick={onClose}>
          Cancel
        </button>
        <button
          className={s.primary}
          disabled={
            !items.every(
              (x) =>
                x.productId &&
                Number(x.quantity) > 0 &&
                Number(x.unitCost) >= 0,
            )
          }
          onClick={() =>
            onSave({
              supplierId: supplierId ? Number(supplierId) : null,
              purchaseDate,
              paid: Number(paid || 0),
              paymentMethod,
              note,
              items: items.map((x) => ({
                productId: Number(x.productId),
                quantity: Number(x.quantity),
                unitCost: Number(x.unitCost),
              })),
            })
          }
        >
          Save purchase
        </button>
      </div>
    </Modal>
  );
}
function ExpenseModal({ item, onClose, onSave }) {
  const [d, setD] = useState({
    category: item?.category || "Other",
    amount: item?.amount || "",
    expenseDate: item?.expenseDate || today(),
    description: item?.description || "",
    recurring: item?.recurring || false,
    ownerWithdrawal: item?.ownerWithdrawal || false,
  });
  return (
    <Modal title={item ? "Edit expense" : "Add expense"} onClose={onClose}>
      <div className={s.formGrid}>
        <label className={s.field}>
          <span>Category</span>
          <select
            value={d.category}
            onChange={(e) => setD({ ...d, category: e.target.value })}
          >
            {[
              "Rent",
              "Salary",
              "Electricity",
              "Internet",
              "Transportation",
              "Marketing",
              "Repairs",
              "Supplies",
              "Taxes",
              "Bank Charges",
              "Delivery",
              "Other",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Field
          label="Amount"
          type="number"
          value={d.amount}
          onChange={(e) => setD({ ...d, amount: e.target.value })}
        />
        <Field
          label="Date"
          type="date"
          value={d.expenseDate}
          onChange={(e) => setD({ ...d, expenseDate: e.target.value })}
        />
        <Field
          label="Description"
          value={d.description}
          onChange={(e) => setD({ ...d, description: e.target.value })}
        />
      </div>
      <div className={s.modalFoot}>
        <button className={s.outline} onClick={onClose}>
          Cancel
        </button>
        <label className={s.toggle}>
          <input
            type="checkbox"
            checked={d.recurring}
            onChange={(e) => setD({ ...d, recurring: e.target.checked })}
          />
          <span>Recurring expense</span>
        </label>
        <label className={s.toggle}>
          <input
            type="checkbox"
            checked={d.ownerWithdrawal}
            onChange={(e) => setD({ ...d, ownerWithdrawal: e.target.checked })}
          />
          <span>Owner withdrawal, exclude from operating expenses</span>
        </label>
        <button
          className={s.primary}
          onClick={() => onSave({ ...d, amount: Number(d.amount) })}
        >
          {item ? "Update expense" : "Save expense"}
        </button>
      </div>
    </Modal>
  );
}
function PaymentModal({ title, max, onClose, onSave }) {
  const [d, setD] = useState({
    amount: max > 0 ? max : "",
    method: "CASH",
    reference: "",
    provider: "",
    providerTransactionId: "",
    note: "",
    status: "COMPLETED",
  });
  return (
    <Modal title={title} onClose={onClose}>
      <div className={s.formGrid}>
        <Field
          label="Amount"
          type="number"
          min="0.01"
          max={max}
          value={d.amount}
          onChange={(e) => setD({ ...d, amount: e.target.value })}
        />
        <label className={s.field}>
          <span>Payment method</span>
          <select
            value={d.method}
            onChange={(e) => setD({ ...d, method: e.target.value })}
          >
            <option>CASH</option>
            <option>POS</option>
            <option>BANK_TRANSFER</option>
            <option>OTHER</option>
          </select>
        </label>
        <Field
          label="Reference"
          value={d.reference}
          onChange={(e) => setD({ ...d, reference: e.target.value })}
        />
        <Field
          label="Provider"
          value={d.provider}
          onChange={(e) => setD({ ...d, provider: e.target.value })}
        />
        <Field
          label="Transaction ID"
          value={d.providerTransactionId}
          onChange={(e) =>
            setD({ ...d, providerTransactionId: e.target.value })
          }
        />
        <Field
          label="Note"
          value={d.note}
          onChange={(e) => setD({ ...d, note: e.target.value })}
        />
        <label className={s.field}>
          <span>Status</span>
          <select
            value={d.status}
            onChange={(e) => setD({ ...d, status: e.target.value })}
          >
            <option>COMPLETED</option>
            <option>PENDING</option>
            <option>FAILED</option>
          </select>
        </label>
      </div>
      <div className={s.modalFoot}>
        <button className={s.outline} onClick={onClose}>
          Cancel
        </button>
        <button
          className={s.primary}
          disabled={
            !d.amount || Number(d.amount) <= 0 || Number(d.amount) > max
          }
          onClick={() => onSave({ ...d, amount: Number(d.amount) })}
        >
          Record payment
        </button>
      </div>
    </Modal>
  );
}
function ReceiptModal({ sale, money, onClose }) {
  return (
    <Modal title={`Receipt ${sale?.saleNumber || ""}`} onClose={onClose}>
      <div id="ehral-receipt" className={s.receipt}>
        <h2>Ehral</h2>
        <p>
          Sale: {sale?.saleNumber} · {sale?.currency || "NGN"}
        </p>
        {(sale?.items || []).map((i) => (
          <div key={i.id}>
            <span>
              {i.productName} × {i.quantity}
            </span>
            <b>{money(i.lineTotal)}</b>
          </div>
        ))}
        <hr />
        <div>
          <strong>Total</strong>
          <strong>{money(sale?.total)}</strong>
        </div>
        <p>Paid: {money(sale?.amountPaid)}</p>
        <p>Status: {sale?.paymentStatus}</p>
      </div>
      <button className={s.primary} onClick={() => window.print()}>
        Print receipt
      </button>
    </Modal>
  );
}
function CustomerModal({ item, onClose, onSave }) {
  const [d, setD] = useState({
    firstName: item?.firstName || "",
    lastName: item?.lastName || "",
    phone: item?.phone || "",
    email: item?.email || "",
  });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={item ? "Edit customer" : "Add customer"} onClose={onClose}>
      <div className={s.formGrid}>
        <Field
          label="First name"
          value={d.firstName}
          onChange={(e) => set("firstName", e.target.value)}
        />
        <Field
          label="Last name"
          value={d.lastName}
          onChange={(e) => set("lastName", e.target.value)}
        />
        <Field
          label="Phone"
          value={d.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
        <Field
          label="Email"
          type="email"
          value={d.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>
      <div className={s.modalFoot}>
        <button className={s.outline} onClick={onClose}>
          Cancel
        </button>
        <button
          className={s.primary}
          disabled={!d.firstName || !d.phone}
          onClick={() => onSave(d)}
        >
          {item ? "Update customer" : "Save customer"}
        </button>
      </div>
    </Modal>
  );
}
function SupplierModal({ item, onClose, onSave }) {
  const [d, setD] = useState({
    name: item?.name || "",
    phone: item?.phone || "",
    email: item?.email || "",
    address: item?.address || "",
    notes: item?.notes || "",
  });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={item ? "Edit supplier" : "Add supplier"} onClose={onClose}>
      <div className={s.formGrid}>
        <Field
          label="Supplier name"
          value={d.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <Field
          label="Phone"
          value={d.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
        <Field
          label="Email"
          value={d.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <Field
          label="Address"
          value={d.address}
          onChange={(e) => set("address", e.target.value)}
        />
        <Field
          label="Notes"
          value={d.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
      <div className={s.modalFoot}>
        <button className={s.outline} onClick={onClose}>
          Cancel
        </button>
        <button
          className={s.primary}
          disabled={!d.name}
          onClick={() => onSave(d)}
        >
          {item ? "Update supplier" : "Save supplier"}
        </button>
      </div>
    </Modal>
  );
}

function ConfirmModal({
  title = "Confirm action",
  onClose,
  onConfirm,
  eyebrow = "PLEASE CONFIRM",
  children,
  confirmLabel = "Confirm",
  danger = true,
}) {
  return (
    <Modal title={title} onClose={onClose} className={s.confirmModal}>
      <div className={s.confirmBody}>
        <div className={danger ? s.confirmIconDanger : s.confirmIcon}>!</div>
        <span className={s.confirmEyebrow}>{eyebrow}</span>
        <div className={s.confirmMessage}>{children}</div>
      </div>
      <div className={s.modalFoot}>
        <button className={s.outline} onClick={onClose}>
          Cancel
        </button>
        <button
          className={danger ? s.dangerButton : s.primary}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export {
  ProductModal,
  PurchaseModal,
  ExpenseModal,
  PaymentModal,
  ReceiptModal,
  CustomerModal,
  SupplierModal,
  ConfirmModal,
};
