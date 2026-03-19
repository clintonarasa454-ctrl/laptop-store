export async function getPaypalAccessToken(clientId: string, secret: string) {
  const PAYPAL_API_BASE = process.env.PAYPAL_ENV === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "PayPal Auth failed");
  return data.access_token;
}

export async function getMpesaAccessToken(consumerKey: string, consumerSecret: string, env: string = "sandbox") {
  const baseUrl = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.errorMessage || "M-Pesa Auth failed");
  return data.access_token;
}

export function getMpesaTimestamp() {
  const pad = (n: number) => (n < 10 ? '0' + n : n.toString());
  const date = new Date();
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function formatMpesaPhone(phone: string) {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
  else if (cleaned.startsWith("+254")) cleaned = cleaned.slice(1);
  else if (cleaned.length === 9) cleaned = "254" + cleaned;
  return cleaned;
}