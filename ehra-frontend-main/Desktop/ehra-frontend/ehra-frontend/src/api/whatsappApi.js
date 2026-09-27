import API from "./authApi";
export const getWhatsAppSettings = () => API.get("/business/whatsapp");
export const saveWhatsAppSettings = (data) => API.put("/business/whatsapp", data);
export const deleteWhatsAppSettings = () => API.delete("/business/whatsapp");
export const buildWhatsAppLink = (number, message) => { if (!number) return null; return `https://wa.me/${String(number).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`; };

// Charges the business's Ehral Credits for a WHATSAPP_CLICK before the
// storefront actually navigates to WhatsApp. The backend endpoint is
// public (resolves the business from the slug, no auth needed) — it works
// the same whether this fires from the anonymous public storefront or the
// in-app customer view. Rejects with the backend's reason on insufficient
// credit, so callers should await this before navigating and catch the
// rejection to show why the click didn't go through.
export const chargeWhatsAppClick = (slug) =>
  API.post(`/public/storefronts/${slug}/whatsapp-click`);