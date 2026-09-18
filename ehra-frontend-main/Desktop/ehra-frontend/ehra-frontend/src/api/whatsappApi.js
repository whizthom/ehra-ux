import API from "./authApi";
export const getWhatsAppSettings = () => API.get("/business/whatsapp");
export const saveWhatsAppSettings = (data) => API.put("/business/whatsapp", data);
export const deleteWhatsAppSettings = () => API.delete("/business/whatsapp");
export const buildWhatsAppLink = (number, message) => { if (!number) return null; return `https://wa.me/${String(number).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`; };
