import { ENV } from "./env";

export interface ConfigurationStatus {
  database: { status: "ok" | "error"; message: string };
  email: { status: "ok" | "warning" | "error"; message: string };
  storage: { status: "ok" | "warning" | "error"; message: string };
  currencyApi: { status: "ok" | "warning"; message: string };
}

/**
 * Validates critical configuration settings on server startup
 * Returns warnings for optional services, errors for required ones
 */
export function validateConfiguration(): ConfigurationStatus {
  const status: ConfigurationStatus = {
    database: { status: "ok", message: "No validation yet" },
    email: { status: "ok", message: "Not configured (development mode)" },
    storage: { status: "ok", message: "Not configured (development mode)" },
    currencyApi: { status: "ok", message: "Will use cached rates or fallback" },
  };

  // ===== DATABASE VALIDATION =====
  if (!process.env.DATABASE_URL) {
    status.database = { 
      status: "error", 
      message: "❌ DATABASE_URL is not set. Check your .env file." 
    };
  } else {
    status.database = { 
      status: "ok", 
      message: `✅ Database configured (${process.env.DATABASE_TYPE || "mysql"})` 
    };
  }

  // ===== EMAIL VALIDATION =====
  const emailSettings = {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
  };

  const isEmailConfigured = emailSettings.smtpHost && emailSettings.smtpUser && emailSettings.smtpPassword;
  
  if (isEmailConfigured) {
    // Validate email configuration
    if (!emailSettings.smtpPort) {
      status.email = { 
        status: "error", 
        message: "❌ SMTP_PORT is missing. Email sending will fail." 
      };
    } else if (isNaN(Number(emailSettings.smtpPort)) || Number(emailSettings.smtpPort) < 1 || Number(emailSettings.smtpPort) > 65535) {
      status.email = { 
        status: "error", 
        message: `❌ SMTP_PORT "${emailSettings.smtpPort}" is invalid. Use a port between 1-65535.` 
      };
    } else {
      status.email = { 
        status: "ok", 
        message: `✅ SMTP email configured (${emailSettings.smtpHost}:${emailSettings.smtpPort})` 
      };
    }
  } else {
    status.email = { 
      status: "warning", 
      message: "⚠️  SMTP not configured. Email features disabled (OTP codes will be logged to console)." 
    };
  }

  // ===== STORAGE VALIDATION =====
  const hasForgeConfig = process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY;

  const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
  const awsBucket = process.env.AWS_S3_BUCKET;

  const placeholders = ["your_access_key", "your_secret_key", "your_bucket"];
  const isValidValue = (val: string | undefined): boolean =>
    !!val && !placeholders.includes(val.toLowerCase());

  const hasS3Config =
    isValidValue(awsAccessKey) && isValidValue(awsSecret) && isValidValue(awsBucket);

  if (hasForgeConfig) {
    status.storage = { 
      status: "ok", 
      message: "✅ Storage: Forge/Manus configured" 
    };
  } else if (hasS3Config) {
    status.storage = { 
      status: "ok", 
      message: "✅ Storage: AWS S3 configured" 
    };
  } else {
    const missing: string[] = [];
    if (!isValidValue(awsAccessKey)) missing.push(`AWS_ACCESS_KEY_ID${awsAccessKey ? ` (placeholder: "${awsAccessKey}")` : " (not set)"}`);
    if (!isValidValue(awsSecret)) missing.push(`AWS_SECRET_ACCESS_KEY${awsSecret ? ` (placeholder: "${awsSecret}")` : " (not set)"}`);
    if (!isValidValue(awsBucket)) missing.push(`AWS_S3_BUCKET${awsBucket ? ` (placeholder: "${awsBucket}")` : " (not set)"}`);

    status.storage = { 
      status: "warning", 
      message: `⚠️  No S3 storage backend configured. Image uploads will fall back to Base64. Missing/invalid: ${missing.join(", ")}` 
    };
  }

  // ===== CURRENCY API VALIDATION =====
  status.currencyApi = { 
    status: "ok", 
    message: "✅ Currency API: Uses fallback if main API fails" 
  };

  return status;
}

/**
 * Logs configuration status on startup
 */
export function logConfigurationStatus(status: ConfigurationStatus): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 CONFIGURATION STATUS");
  console.log("=".repeat(60));

  Object.entries(status).forEach(([key, info]) => {
    const icon = info.status === "error" ? "❌" : info.status === "warning" ? "⚠️ " : "✅";
    console.log(`${icon} ${key.toUpperCase()}: ${info.message}`);
  });

  console.log("=".repeat(60) + "\n");

  // Check for critical errors
  const hasErrors = Object.values(status).some(s => s.status === "error");
  if (hasErrors) {
    console.warn("⚠️  WARNING: Some critical services are not configured.");
    console.warn("The application may not work correctly until they are fixed.\n");
  }
}
