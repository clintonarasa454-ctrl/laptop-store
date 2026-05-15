# Configuration & Diagnostic Utilities

This directory contains utilities for validating and monitoring server configuration.

## Files

### `configValidator.ts`
Validates critical configuration on server startup.

**Usage:**
```typescript
import { validateConfiguration, logConfigurationStatus } from "./configValidator";

const status = validateConfiguration();
logConfigurationStatus(status);
```

**Returns:** Configuration status object with `database`, `email`, `storage`, and `currencyApi` info.

### `emailService.ts`
Enhanced email sending with configuration validation and error diagnostics.

**Usage:**
```typescript
import { sendEmail, isEmailConfigured } from "./emailService";

const emailConfig = {
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
};

if (isEmailConfigured(emailConfig)) {
  const result = await sendEmail(emailConfig, {
    to: "user@example.com",
    subject: "Welcome",
    html: "<p>Hello!</p>",
  });
  
  if (result.success) {
    console.log("Email sent!");
  } else {
    console.error("Failed:", result.error);
  }
}
```

**Key Functions:**
- `isEmailConfigured()` - Checks if SMTP is configured
- `validateEmailPort()` - Validates port number
- `sendEmail()` - Sends email with detailed error handling

### `storageValidator.ts`
Validates storage backend configuration.

**Usage:**
```typescript
import { checkStorageConfiguration } from "./storageValidator";

const storage = checkStorageConfiguration();
if (storage.configured) {
  console.log(`Using ${storage.type} storage`);
} else {
  console.warn(storage.warning);
}
```

**Supports:**
- Forge/Manus (`BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`)
- AWS S3 (`AWS_*` variables)

---

## Integration

All validation runs on server startup in `server/_core/index.ts`:

```typescript
const config = validateConfiguration();
logConfigurationStatus(config);

// If there are critical errors, consider stopping the server
// based on your requirements
```

---

## Configuration Status Output

### ✅ Development (Minimal Config)
```
============================================================
🔍 CONFIGURATION STATUS
============================================================
✅ DATABASE: ✅ Database configured (supabase)
⚠️  EMAIL: ⚠️  SMTP not configured (development mode)
⚠️  STORAGE: ⚠️  No storage backend configured
✅ CURRENCYAPI: ✅ Currency API: Uses fallback if main API fails
============================================================
```

### ❌ Production (Full Config Required)
```
============================================================
🔍 CONFIGURATION STATUS
============================================================
✅ DATABASE: ✅ Database configured (supabase)
✅ EMAIL: ✅ SMTP email configured (smtp.gmail.com:587)
✅ STORAGE: ✅ Storage: AWS S3 configured
✅ CURRENCYAPI: ✅ Currency API: Uses fallback if main API fails
============================================================
```

---

## Error Examples

### Email Connection Failed
```
❌ Failed to send email to user@example.com:
   connect ECONNREFUSED 127.0.0.1:587 - Cannot connect to SMTP server
   at localhost:587. Check host and port.
```

### SMTP Auth Failed
```
❌ Failed to send email to user@example.com:
   Invalid login - SMTP authentication failed.
   Check SMTP_USER and SMTP_PASSWORD.
```

### Exchange Rates API Timeout
```
⚠️  Exchange rates API request timeout (5s)
   Using cached or default rates.
```

---

## Environment Variables

Required for each component:

**Database:**
- `DATABASE_URL` (Required)
- `DATABASE_TYPE` (optional, defaults to mysql)

**Email (Optional):**
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`

**Storage (One of):**
- `BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY` (Forge)
- `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_S3_BUCKET` (S3)

**Currency:**
- Uses `https://open.er-api.com/v6/latest/KES` (cached, with fallback)

---

## Testing

To test configuration validation:

```bash
# Start server and watch startup logs
npm run dev

# All config checks will run and print to console
```

---

## Adding New Configuration Checks

To add a new validation check:

1. Add to `validateConfiguration()` in `configValidator.ts`
2. Update `ConfigurationStatus` interface
3. Add log message to `logConfigurationStatus()`
4. Document in `CONFIGURATION_GUIDE.md`

Example:
```typescript
// In configValidator.ts
export interface ConfigurationStatus {
  // ... existing
  newService: { status: "ok" | "warning" | "error"; message: string };
}

function validateConfiguration(): ConfigurationStatus {
  // ... existing checks
  
  status.newService = { 
    status: "ok", 
    message: "✅ New service configured" 
  };
}
```

---

## Best Practices

1. **Use on startup** - Run validation early before accepting connections
2. **Log warnings** - Help developers catch configuration issues early
3. **Fail gracefully** - Services should handle unconfigured backends
4. **Provide diagnostics** - Include helpful error messages and solutions
5. **Cache validation results** - Don't re-validate on every request

