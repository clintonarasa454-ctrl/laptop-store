# Railway SMTP Configuration Guide

## Problem
You're getting email timeout errors on Railway:
```
Email sending failed: Connection timeout. Please check your SMTP settings.
```

This happens because SMTP is either:
1. Not configured in Railway environment variables
2. Using placeholder values instead of real credentials
3. Using a blocked SMTP server from your provider

---

## Solution: Configure SMTP on Railway

### Step 1: Get SMTP Credentials

Choose one of these free SMTP providers:

#### Option A: Gmail (Free)
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an **App Password** (not your regular password):
   - Go to https://myaccount.google.com/apppasswords
   - Select Mail and Windows Computer (or your device)
   - Copy the generated 16-character password
3. Settings:
   - **SMTP_HOST**: `smtp.gmail.com`
   - **SMTP_PORT**: `465` (secure) or `587` (TLS)
   - **SMTP_USER**: `your-email@gmail.com`
   - **SMTP_PASSWORD**: `xxxx xxxx xxxx xxxx` (16-char app password, remove spaces)

#### Option B: SendGrid (Free 100 emails/day)
1. Sign up at https://sendgrid.com
2. Create API key in Settings → API Keys
3. Settings:
   - **SMTP_HOST**: `smtp.sendgrid.net`
   - **SMTP_PORT**: `587`
   - **SMTP_USER**: `apikey`
   - **SMTP_PASSWORD**: `SG.xxxxxx...` (your API key)

#### Option C: Brevo (Free 300 emails/day)
1. Sign up at https://www.brevo.com
2. Get SMTP credentials from Settings → SMTP & API
3. Settings:
   - **SMTP_HOST**: `smtp-relay.brevo.com`
   - **SMTP_PORT**: `587`
   - **SMTP_USER**: `your-email@example.com`
   - **SMTP_PASSWORD**: `your-brevo-smtp-password`

---

### Step 2: Set Environment Variables on Railway

1. Go to your Railway project dashboard
2. Click on your deployment
3. Go to **Variables** tab
4. Add these new variables:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password-without-spaces
```

> **Important**: 
> - For Gmail: Use **App Password**, NOT your regular password
> - For PORT 465: Use `secure: true` (automatic)
> - For PORT 587: Use `secure: false` (automatic)
> - Remove any spaces from passwords

### Step 3: Verify Configuration

After setting variables, Railway will automatically redeploy. Test by:

1. Navigate to your Railway app
2. Try password reset or signup (triggers email)
3. Check Railway logs for:
   - ✅ `✅ Email sent successfully` = Success
   - ❌ `Email config error` = Wrong variables
   - ❌ `ETIMEDOUT` = Firewall/server issue

### Step 4: Check Logs

In Railway Dashboard:
1. Click your deployment
2. Go to **Logs** tab
3. Look for email-related messages (search for "Email")
4. Check for configuration or connection errors

---

## Common Issues & Fixes

### Issue: "SMTP_NOT_CONFIGURED or using placeholder values"
**Solution**: You haven't set the environment variables on Railway. Follow Step 2 above.

### Issue: "Authentication failed"
**Solution**: 
- Gmail users: Make sure you're using **App Password**, not your regular password
- Remove spaces from password: `xxxx xxxx xxxx xxxx` → `xxxxxxxxxxxxxxxx`
- Verify SMTP_USER matches your email exactly

### Issue: "Connection timeout"
**Solution**:
1. Try a different SMTP provider (Gmail → SendGrid)
2. Change SMTP_PORT: `465` (secure) → `587` (TLS)
3. Check provider's firewall settings allow outbound connections

### Issue: "ENOTFOUND - SMTP host not found"
**Solution**: 
- Double-check SMTP_HOST spelling
- Make sure it's not a local `smtp://localhost` (won't work on Railway)

### Issue: "Unexpected server response"
**Solution**: 
- PORT 465 requires `secure: true` (automatic)
- PORT 587 requires `secure: false` (automatic)
- Make sure PORT matches your provider

---

## Provider-Specific Recommendations

| Provider | Free Limit | Reliability | Setup Complexity |
|----------|-----------|-------------|------------------|
| **Gmail** | Unlimited | ⭐⭐⭐⭐ | Medium (App Password) |
| **SendGrid** | 100/day | ⭐⭐⭐⭐⭐ | Easy |
| **Brevo** | 300/day | ⭐⭐⭐⭐ | Easy |
| **Mailgun** | 10/day | ⭐⭐⭐⭐⭐ | Medium |

**Recommended for production**: SendGrid or Brevo (better deliverability)

---

## Testing Your Configuration Locally

Before pushing to Railway, test locally:

1. Update your `.env` file with real credentials:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-actual-email@gmail.com
SMTP_PASSWORD=your-actual-app-password
```

2. Restart your local dev server

3. Try a password reset or signup to trigger email

4. Check console logs for success/error messages

---

## After Configuration

Once SMTP is working:
- Users can reset passwords
- Verification emails will be sent
- Order confirmations work
- Password recovery works
- All email features are enabled

---

## Need Help?

If you're still having issues:

1. **Check Railway logs** - Most errors are logged with solutions
2. **Verify variables are set** - Go to Variables tab, confirm values are there
3. **Test credentials locally first** - Make sure SMTP works before pushing
4. **Try a different provider** - Sometimes it's the provider, not your config
5. **Reduce timeouts** - If provider is slow, might need longer timeouts

---

## Environment Variables Reference

Complete list of email-related variables:

```env
# SMTP Configuration (Required for email)
SMTP_HOST=smtp.gmail.com          # Your provider's SMTP server
SMTP_PORT=465                      # 465 (secure) or 587 (TLS)
SMTP_USER=your-email@gmail.com    # Your SMTP username
SMTP_PASSWORD=app-password        # Your SMTP password/API key

# Optional: Already set defaults (don't change unless needed)
SMTP_HOST=smtp.gmail.com           # Default SMTP host
SMTP_PORT=587                      # Default SMTP port (TLS)
```

---

**Last Updated**: May 15, 2026  
**Status**: Email configuration guide for Railway deployment
