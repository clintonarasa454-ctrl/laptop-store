import { useEffect } from "react";

export default function PaypalReturn() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") || params.get("paypalOrderId");
      const orderId = params.get("order_id") || params.get("orderId");
      const cancelled = params.get("paypal_cancel") || params.get("cancel");

      if (window.opener) {
        if (cancelled) {
          window.opener.postMessage({ type: "PAYPAL_CANCEL" }, "*");
        } else if (token) {
          window.opener.postMessage({ type: "PAYPAL_SUCCESS", token, orderId }, "*");
        }
      }
    } catch (e) {
      // ignore
    }
      // close the popup after a short delay to allow message to be received
      setTimeout(() => {
        try { window.close(); } catch (e) { /* ignore */ }
      }, 500);
  }, []);

  return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 20, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <img src={(document.querySelector("link[rel~='icon']") as HTMLLinkElement)?.href || "/favicon.ico"} alt="logo" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{document.title || 'Store'}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Completing PayPal Checkout…</div>
          </div>
        </div>
        <p style={{ color: '#6b7280' }}>This window will close automatically. If it doesn't, you can safely close it.</p>
      </div>
  );
}
