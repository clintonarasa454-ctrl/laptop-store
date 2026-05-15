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
 * Validates email configuration - checks for placeholder values too
 */
export function isEmailConfigured(config: EmailConfig): boolean {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword || !config.smtpPort) {
    return false;
  }
  
  // Check if using placeholder values (common mistake in production)
  const placeholders = [
    "your-email@gmail.com",
    "your-app-password",
    "your_email@gmail.com",
    "smtp.gmail.com",
    "placeholder",
    "example@example.com"
  ];
  
  const lowerUser = config.smtpUser.toLowerCase();
  if (placeholders.some(p => lowerUser.includes(p) || config.smtpPassword === p)) {
    return false;
  }
  
  return true;
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
    console.warn(
      `⚠️ Email not configured or using placeholder values. Email to ${options.to}:\n` +
      `   Subject: ${options.subject}\n` +
      `   (Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD in environment)`
    );
    // Don't throw error - allow app to continue
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
      // Reduced timeouts for Railway environment
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      // Pool connections to avoid exhaustion
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 14,
    });

    // Skip verification on first send to avoid timeout delays
    // Just send directly
    const result = await transporter.sendMail({
      from: options.from || `"${storeName}" <${config.smtpUser}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`✅ Email sent successfully to ${options.to} (Message ID: ${result.messageId})`);
    await transporter.close();
    return { success: true };
  } catch (err: any) {
    const errorCode = err.code || "UNKNOWN";
    const errorMessage = err.message || "Unknown error";

    // Provide helpful diagnostics
    let diagnostic = "";
    if (errorCode === "ECONNREFUSED") {
      diagnostic = `Cannot connect to SMTP server at ${config.smtpHost}:${smtpPort}. Check SMTP_HOST and SMTP_PORT environment variables.`;
    } else if (errorCode === "ENOTFOUND") {
      diagnostic = `SMTP host "${config.smtpHost}" not found. Check SMTP_HOST spelling in environment.`;
    } else if (errorCode === "ETIMEDOUT" || errorMessage.includes("timeout")) {
      diagnostic = `Connection to ${config.smtpHost}:${smtpPort} timed out. SMTP server may be unreachable or misconfigured. Ensure SMTP is enabled and firewall allows connection.`;
    } else if (errorMessage.includes("Invalid login") || errorMessage.includes("Authentication failed") || errorCode === "EAUTH") {
      diagnostic = `SMTP authentication failed. Check SMTP_USER and SMTP_PASSWORD are correct and match your provider's requirements.`;
    } else if (errorMessage.includes("bad response on DATA command")) {
      diagnostic = `Email was rejected by SMTP server. Check recipient and email format.`;
    } else if (errorMessage.includes("Unexpected server response")) {
      diagnostic = `SMTP server rejected the command. Verify SMTP_HOST, SMTP_PORT, and secure setting match your provider.`;
    }

    const fullError = diagnostic ? `${errorMessage} - ${diagnostic}` : errorMessage;
    console.error(`❌ Failed to send email to ${options.to}: ${fullError}`);

    return { success: false, error: fullError };
  }
}
