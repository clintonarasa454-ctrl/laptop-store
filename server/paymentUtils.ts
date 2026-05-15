import crypto from "crypto";

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
  else if (cleaned.length === 9) cleaned = "254" + cleaned;
  return cleaned;
}

export type MpesaSettings = {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  initiatorName: string;
  initiatorPassword: string;
  certContent: string;
  apiHost: "sandbox" | "production";
};

export async function initiateB2CPayout(settings: MpesaSettings, params: { amount: number; phone: string; remarks: string; occasion: string }) {
  const token = await getMpesaAccessToken(settings.consumerKey, settings.consumerSecret, settings.apiHost);
  
  // Clean up the certificate content to ensure valid PEM format for Node.js Crypto
  let formattedCert = settings.certContent.trim();
  const base64Match = formattedCert.match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/);
  
  if (base64Match) {
    // Extract raw base64, remove all whitespace/newlines, then re-wrap at 64 chars
    const rawBase64 = base64Match[1].replace(/\s+/g, '');
    const wrappedBase64 = rawBase64.match(/.{1,64}/g)?.join('\n') || rawBase64;
    formattedCert = `-----BEGIN CERTIFICATE-----\n${wrappedBase64}\n-----END CERTIFICATE-----`;
  } else {
    // Fallback: If headers are missing, assume the whole string is the raw base64
    const rawBase64 = formattedCert.replace(/\s+/g, '');
    const wrappedBase64 = rawBase64.match(/.{1,64}/g)?.join('\n') || rawBase64;
    formattedCert = `-----BEGIN CERTIFICATE-----\n${wrappedBase64}\n-----END CERTIFICATE-----`;
  }

  let encryptedPassword;
  try {
    // Encrypt the initiator password using the Safaricom Public Key Certificate
    encryptedPassword = crypto.publicEncrypt(
      { key: formattedCert, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(settings.initiatorPassword)
    ).toString("base64");
  } catch (err: any) {
    console.error("M-Pesa Cert Encryption Error:", err.message);
    throw new Error("Failed to encrypt password. Please check your B2C Certificate format in the Admin Settings.");
  }

  const partyB = formatMpesaPhone(params.phone);
  const host = settings.apiHost === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  
  const payload = {
    InitiatorName: settings.initiatorName,
    SecurityCredential: encryptedPassword,
    CommandID: "BusinessPayment",
    Amount: Math.round(params.amount),
    PartyA: settings.shortcode,
    PartyB: partyB,
    Remarks: params.remarks,
    QueueTimeOutURL: `${process.env.PUBLIC_URL || "http://localhost:3000"}/api/webhooks/mpesa/b2c/timeout`,
    ResultURL: `${process.env.PUBLIC_URL || "http://localhost:3000"}/api/webhooks/mpesa/b2c/result`,
    Occasion: params.occasion,
  };

  const response = await fetch(`${host}/mpesa/b2c/v1/paymentrequest`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.errorMessage || data.CustomerMessage || "Failed to initiate B2C Payout check your M-Pesa credentials.");
  }
  return data;
}