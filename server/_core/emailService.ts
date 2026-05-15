import nodemailer from "nodemailer";
import { TRPCError } from "@trpc/server";

export interface EmailConfig {
  smtpHost?: string;
  smtpPort?: string | number;
  smtpUser?: string;
  smtpPassword?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Validates email configuration
 */
export function isEmailConfigured(config: EmailConfig): boolean {
  return !!(config.smtpHost && config.smtpUser && config.smtpPassword && config.smtpPort);
}

/**
 * Validates email port
 */
export function validateEmailPort(port?: string | number): number | null {
  if (!port) return null;
  const portNum = typeof port === "string" ? parseInt(port, 10) : port;
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) return null;
  return portNum;
}

/**
 * Sends an email with proper error handling and diagnostics
 */
export async function sendEmail(
  config: EmailConfig,
  options: EmailOptions,
  storeName: string = "Store"
): Promise<{ success: boolean; error?: string }> {
  // Check if email is configured
  if (!isEmailConfigured(config)) {
    console.log(
      `📧 No SMTP configured. Email to ${options.to}:\n` +
      `   Subject: ${options.subject}\n` +
      `   (Would be sent in production)`
    );
    return { success: false, error: "SMTP_NOT_CONFIGURED" };
  }

  // Validate port
  const smtpPort = validateEmailPort(config.smtpPort);
  if (!smtpPort) {
    const error = `Invalid SMTP port: ${config.smtpPort}. Expected a number between 1-65535.`;
    console.error(`❌ Email config error: ${error}`);
    return { success: false, error };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify connection before sending
    await transporter.verify();

    // Send email
    const result = await transporter.sendMail({
      from: options.from || `"${storeName}" <${config.smtpUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`✅ Email sent successfully to ${options.to} (Message ID: ${result.messageId})`);
    return { success: true };
  } catch (err: any) {
    const errorCode = err.code || "UNKNOWN";
    const errorMessage = err.message || "Unknown error";

    // Provide helpful diagnostics
    let diagnostic = "";
    if (errorCode === "ECONNREFUSED") {
      diagnostic = `Cannot connect to SMTP server at ${config.smtpHost}:${smtpPort}. Check host and port.`;
    } else if (errorCode === "ENOTFOUND") {
      diagnostic = `SMTP host "${config.smtpHost}" not found. Check hostname spelling.`;
    } else if (errorCode === "ETIMEDOUT") {
      diagnostic = `Connection to ${config.smtpHost}:${smtpPort} timed out (10s). Server may be unreachable.`;
    } else if (errorMessage.includes("Invalid login") || errorMessage.includes("Authentication failed")) {
      diagnostic = `SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD.`;
    } else if (errorMessage.includes("bad response on DATA command")) {
      diagnostic = `Email was rejected by SMTP server. Check recipient and email format.`;
    }

    const fullError = diagnostic ? `${errorMessage} - ${diagnostic}` : errorMessage;
    console.error(`❌ Failed to send email to ${options.to}: ${fullError}`);

    return { success: false, error: fullError };
  }
}
