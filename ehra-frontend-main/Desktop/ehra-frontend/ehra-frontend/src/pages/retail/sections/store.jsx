import { useEffect, useMemo, useRef, useState } from "react";
import s from "../../RetailWorkspace.module.css";
import {
  getStorefrontSlugAvailability,
  saveStorefront,
  uploadStorefrontCover,
} from "../../../api/commerceApi";
import { updateBusinessProfile } from "../../../api/businessApi";
import { Panel, Field, RETAIL_CATEGORIES } from "./shared";
import { GlassSelect, buildTimeOptions } from "./GlassSelect";

const TIME_OPTIONS = buildTimeOptions(15);

const CURRENCY_OPTIONS = [
  { value: "NGN", label: "NGN — Nigerian Naira" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
  { value: "AUD", label: "AUD — Australian Dollar" },
  { value: "GHS", label: "GHS — Ghanaian Cedi" },
  { value: "KES", label: "KES — Kenyan Shilling" },
  { value: "ZAR", label: "ZAR — South African Rand" },
];

const DAYS = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
];

function parseHours(value) {
  try {
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function OpeningHours({ value, onChange }) {
  const [hours, setHours] = useState(() => parseHours(value));

  useEffect(() => setHours(parseHours(value)), [value]);

  const commit = (next) => {
    setHours(next);
    onChange(JSON.stringify(next));
  };

  const updateDay = (day, key, val) => {
    const current = hours[day] || {};
    commit({ ...hours, [day]: { ...current, [key]: val } });
  };

  const setClosed = (day) => {
    const next = { ...hours };
    delete next[day];
    commit(next);
  };

  const copyMondayToWeekdays = () => {
    const monday = hours.monday || {};
    const next = { ...hours };
    DAYS.slice(1, 5).forEach(([day]) => {
      next[day] = { ...monday };
    });
    commit(next);
  };

  return (
    <div className={`${s.fieldWide} ${s.hoursEditor}`}>
      <div className={s.hoursHeader}>
        <div>
          <span className={s.sectionLabel}>Opening hours</span>
          <small>
            Set when customers can visit or place orders. Leave a day closed
            when the store is not operating.
          </small>
        </div>
        <button
          type="button"
          className={s.smallAction}
          onClick={copyMondayToWeekdays}
        >
          Copy Monday to weekdays
        </button>
      </div>

      <div className={s.hoursList}>
        {DAYS.map(([day, label]) => {
          const row = hours[day] || {};
          const isOpen = Boolean(row.open && row.close);
          return (
            <div
              className={`${s.hoursRowCard} ${!isOpen ? s.hoursClosed : ""}`}
              key={day}
            >
              <div className={s.hoursDay}>
                <strong>{label}</strong>
                <span>{isOpen ? `${row.open} – ${row.close}` : "Closed"}</span>
              </div>
              <GlassSelect
                label="Opens"
                value={row.open || ""}
                onChange={(v) => updateDay(day, "open", v)}
                options={TIME_OPTIONS}
                placeholder="Opens"
              />
              <GlassSelect
                label="Closes"
                value={row.close || ""}
                onChange={(v) => updateDay(day, "close", v)}
                options={TIME_OPTIONS}
                placeholder="Closes"
              />
              <button
                type="button"
                className={s.hoursStatus}
                onClick={() => setClosed(day)}
                aria-label={`Mark ${label} closed`}
              >
                {isOpen ? "Close" : "Closed"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function getPublicStoreUrl(slug) {
  if (!slug) return "";
  const configured = import.meta.env.VITE_PUBLIC_APP_URL;
  const base = (configured || "https://ehral.com").replace(/\/$/, "");
  return `${base}/store/${encodeURIComponent(slug)}`;
}

function StoreUrl({ slug, availability, onCopy }) {
  const url = getPublicStoreUrl(slug);
  return (
    <div className={s.storeUrlCard}>
      <div className={s.storeUrlTop}>
        <div>
          <span className={s.sectionLabel}>Public storefront URL</span>
          <small>Share this complete address with customers.</small>
        </div>
        {slug && (
          <span
            className={`${s.urlStatus} ${availability === true ? s.urlAvailable : availability === false ? s.urlTaken : ""}`}
          >
            {availability === true
              ? "Available"
              : availability === false
                ? "Already in use"
                : ""}
          </span>
        )}
      </div>
      <div className={s.urlCopyRow}>
        <input
          readOnly
          value={
            url || "Save your store profile to generate the public address."
          }
          aria-label="Public storefront URL"
        />
        <button
          type="button"
          className={s.outline}
          disabled={!url}
          onClick={onCopy}
        >
          <i className="ti ti-copy" /> Copy
        </button>
      </div>
    </div>
  );
}

function Store({ store, setStore, business, owner, onCurrencyChange }) {
  const [currency, setCurrency] = useState(
    business?.currency || store?.currency || "NGN",
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [slugAvailability, setSlugAvailability] = useState(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const slugTimer = useRef(null);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: store?.name || business?.name || "",
    description: store?.description || "",
    slug: store?.slug || "",
    coverImage: store?.coverImage || "",
    businessCategory: store?.businessCategory || "",
    enabled: store?.status === "ACTIVE",
    openingHoursJson: store?.openingHoursJson || "",
    pickupEnabled: !!store?.pickupEnabled,
    deliveryEnabled: !!store?.deliveryEnabled,
  });

  useEffect(() => {
    if (business?.currency) setCurrency(business.currency);
    if (store) {
      setForm({
        name: store.name || business?.name || "",
        description: store.description || "",
        slug: store.slug || "",
        coverImage: store.coverImage || "",
        businessCategory: store.businessCategory || "",
        enabled: store.status === "ACTIVE",
        openingHoursJson: store.openingHoursJson || "",
        pickupEnabled: !!store.pickupEnabled,
        deliveryEnabled: !!store.deliveryEnabled,
      });
    }
  }, [store, business?.currency, business?.name]);

  useEffect(() => {
    const slug = slugify(form.slug);
    if (!slug) {
      setSlugAvailability(null);
      return undefined;
    }
    setSlugChecking(true);
    clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      try {
        const r = await getStorefrontSlugAvailability(slug);
        setSlugAvailability(Boolean(r.data?.available));
      } catch {
        setSlugAvailability(null);
      } finally {
        setSlugChecking(false);
      }
    }, 350);
    return () => clearTimeout(slugTimer.current);
  }, [form.slug]);

  const publicUrl = useMemo(
    () => getPublicStoreUrl(store?.slug),
    [store?.slug],
  );

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSlugChange = (e) => setField("slug", slugify(e.target.value));

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        "Your browser could not copy the storefront URL. Please select and copy it manually.",
      );
    }
  };

  const handleImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Please choose an image smaller than 8 MB.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const r = await uploadStorefrontCover(file);
      setField("coverImage", r.data.url);
    } catch (e) {
      setError(
        e?.response?.data?.message || "Could not upload the cover image.",
      );
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError("");
    const cleanSlug = slugify(form.slug || form.name);
    if (slugAvailability === false && cleanSlug !== store?.slug) {
      setError("That storefront URL is already in use. Choose another slug.");
      return;
    }
    setSaving(true);
    try {
      if (owner) await updateBusinessProfile({ currency });
      const saved = (await saveStorefront({ ...form, slug: cleanSlug })).data;
      setStore(saved);
      setField("slug", saved.slug);
      onCurrencyChange?.(owner ? currency : business?.currency || currency);
      setSlugAvailability(true);
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          "Could not save store settings. Please check the storefront URL and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={s.toolbar}>
        <div>
          <h2>Store profile</h2>
          <p>
            Configure the public identity, customer-facing information and
            fulfilment options for your retail storefront.
          </p>
        </div>
        <button
          className={s.primary}
          disabled={saving || uploading}
          onClick={save}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className={s.grid2}>
        <Panel
          title="Store identity"
          sub="Everything customers see before they browse your products."
        >
          <div className={s.formGrid}>
            <Field
              label="Store name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
            <GlassSelect
              label="Business currency"
              value={currency}
              onChange={setCurrency}
              options={CURRENCY_OPTIONS}
              disabled={!owner}
            />
            <GlassSelect
              label="Business category"
              value={form.businessCategory || ""}
              onChange={(v) => setField("businessCategory", v)}
              options={RETAIL_CATEGORIES}
              placeholder="Select category"
            />

            <div className={`${s.field} ${s.slugField}`}>
              <span>Store URL slug</span>
              <div className={s.slugInputWrap}>
                <span className={s.slugPrefix}>/store/</span>
                <input
                  value={form.slug}
                  onChange={handleSlugChange}
                  placeholder="your-store-name"
                  autoComplete="off"
                />
              </div>
              <div className={s.fieldHint}>
                {slugChecking
                  ? "Checking availability…"
                  : slugAvailability === true
                    ? "This storefront address is available."
                    : slugAvailability === false
                      ? "This address is already used by another storefront."
                      : "Use letters, numbers and hyphens for a simple customer-friendly address."}
              </div>
            </div>

            <Field
              label="Business phone"
              value={store?.phone || business?.phone || ""}
              disabled
            />
            <Field
              label="Business address"
              value={store?.address || business?.address || ""}
              disabled
            />

            <label className={`${s.fieldWide} ${s.descriptionField}`}>
              <div className={s.fieldLabelRow}>
                <span>Description</span>
                <small>{form.description.length}/2000</small>
              </div>
              <textarea
                maxLength={2000}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Tell customers what your store sells, what makes it different, and what they can expect."
              />
              <div className={s.fieldHint}>
                A short, clear description works well on phones and desktop
                storefronts.
              </div>
            </label>

            <div className={`${s.fieldWide} ${s.imagePicker}`}>
              <div className={s.fieldLabelRow}>
                <span>Store cover image</span>
                <small>Recommended: landscape image, up to 8 MB</small>
              </div>
              <button
                type="button"
                className={s.imageDropzone}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {form.coverImage ? (
                  <img src={form.coverImage} alt="Store cover preview" />
                ) : (
                  <div className={s.imagePlaceholder}>
                    <i className="ti ti-photo-plus" />
                    <strong>
                      {uploading ? "Uploading image…" : "Choose a cover image"}
                    </strong>
                    <small>Click to browse your device</small>
                  </div>
                )}
                {form.coverImage && (
                  <span className={s.imageOverlay}>
                    {uploading ? "Uploading…" : "Change image"}
                  </span>
                )}
              </button>
              <input
                ref={fileRef}
                className={s.hiddenFileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  handleImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>

            <OpeningHours
              value={form.openingHoursJson}
              onChange={(v) => setField("openingHoursJson", v)}
            />

            <div className={s.deliveryOptions}>
              <label className={s.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.pickupEnabled}
                  onChange={(e) => setField("pickupEnabled", e.target.checked)}
                />
                <span>
                  <b>Offer pickup</b>
                  <small>Customers can collect orders from your store.</small>
                </span>
              </label>
              <label className={s.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.deliveryEnabled}
                  onChange={(e) =>
                    setField("deliveryEnabled", e.target.checked)
                  }
                />
                <span>
                  <b>Offer delivery</b>
                  <small>Customers can request delivery at checkout.</small>
                </span>
              </label>
              <label className={s.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setField("enabled", e.target.checked)}
                />
                <span>
                  <b>Publish storefront</b>
                  <small>Make your public store visible to customers.</small>
                </span>
              </label>
            </div>

            {error && <div className={s.error}>{error}</div>}
          </div>
        </Panel>

        <Panel
          title="Public channel"
          sub="Your storefront is a shareable customer-facing page on Ehral."
        >
          <StoreUrl
            slug={
              store?.slug ||
              (form.slug && slugAvailability === true ? slugify(form.slug) : "")
            }
            availability={
              store?.slug === slugify(form.slug) ? true : slugAvailability
            }
            onCopy={handleCopy}
          />
          {copied && (
            <div className={s.copyConfirmation}>
              <i className="ti ti-check" /> Storefront URL copied to clipboard.
            </div>
          )}
          <div className={s.channelInfo}>
            <i className="ti ti-world" />
            <div>
              <b>Customer access</b>
              <small>
                Customers do not need an Ehral account just to view your
                storefront.
              </small>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

export { OpeningHours, Store };
