#!/usr/bin/env node

/**
 * SMTP Diagnostic Tool
 * Tests SMTP connectivity and configuration
 * 
 * Usage:
 *   node test-smtp.js
 *   node test-smtp.js smtp.gmail.com 465 test@gmail.com app-password
 */

import nodemailer from "nodemailer";
import chalk from "chalk";

const args = process.argv.slice(2);

const host = args[0] || process.env.SMTP_HOST || "smtp.gmail.com";
const port = args[1] ? parseInt(args[1]) : (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465);
const user = args[2] || process.env.SMTP_USER || "your-email@gmail.com";
const password = args[3] || process.env.SMTP_PASSWORD || "your-app-password";

console.log(chalk.blue("\n📧 SMTP Diagnostic Tool"));
console.log(chalk.blue("========================\n"));

console.log("Configuration to test:");
console.log(chalk.gray(`  Host:     ${host}`));
console.log(chalk.gray(`  Port:     ${port}`));
console.log(chalk.gray(`  User:     ${user}`));
console.log(chalk.gray(`  Password: ${password ? "***" + password.slice(-3) : "NOT SET"}`));
console.log();

// Check for placeholder values
const hasPlaceholders = 
  user.includes("your-email") || 
  user.includes("placeholder") ||
  user.includes("example.com") ||
  password.includes("your-") ||
  password.includes("placeholder");

if (hasPlaceholders) {
  console.log(chalk.red("❌ ERROR: Using placeholder values"));
  console.log(chalk.yellow("\nPlease replace with real SMTP credentials:"));
  console.log(chalk.yellow("  • Gmail: Use an app password (not regular password)"));
  console.log(chalk.yellow("  • SendGrid: Use your API key"));
  console.log(chalk.yellow("  • Brevo: Use your SMTP password"));
  process.exit(1);
}

async function testSMTP() {
  try {
    console.log(chalk.blue("Step 1: Creating transporter..."));
    
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass: password,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    console.log(chalk.green("✅ Transporter created\n"));

    console.log(chalk.blue("Step 2: Testing connection..."));
    await transporter.verify();
    console.log(chalk.green("✅ Connection verified\n"));

    console.log(chalk.blue("Step 3: Sending test email..."));
    const info = await transporter.sendMail({
      from: `"Test" <${user}>`,
      to: user,
      subject: "SMTP Test - If you see this, SMTP is working!",
      html: `
        <h1>✅ SMTP is Working!</h1>
        <p>If you received this email, your SMTP configuration is correct.</p>
        <p>Configuration used:</p>
        <ul>
          <li>Host: ${host}</li>
          <li>Port: ${port}</li>
          <li>User: ${user}</li>
        </ul>
        <p>You can now use this configuration on Railway:</p>
        <pre>
SMTP_HOST=${host}
SMTP_PORT=${port}
SMTP_USER=${user}
SMTP_PASSWORD=your-password
        </pre>
      `,
    });

    console.log(chalk.green("✅ Email sent successfully!\n"));
    console.log("Message ID:", chalk.cyan(info.messageId));

    console.log(chalk.green("\n✅ ALL TESTS PASSED!\n"));
    console.log(chalk.green("Your SMTP configuration is working correctly."));
    console.log(chalk.green("Use these values on Railway:\n"));
    console.log(chalk.cyan(`  SMTP_HOST=${host}`));
    console.log(chalk.cyan(`  SMTP_PORT=${port}`));
    console.log(chalk.cyan(`  SMTP_USER=${user}`));
    console.log(chalk.cyan(`  SMTP_PASSWORD=${password}`));

    await transporter.close();
  } catch (err: any) {
    console.error(chalk.red("\n❌ TEST FAILED\n"));

    const errorCode = err.code || "UNKNOWN";
    const errorMessage = err.message || "Unknown error";

    console.error(chalk.red("Error Code:"), chalk.yellow(errorCode));
    console.error(chalk.red("Error Message:"), chalk.yellow(errorMessage));

    // Provide helpful diagnostics
    console.log("\n" + chalk.yellow("📋 Diagnosis:\n"));

    if (errorCode === "ECONNREFUSED") {
      console.log(chalk.yellow("• Cannot connect to SMTP server"));
      console.log(chalk.yellow("• Check SMTP_HOST and SMTP_PORT are correct"));
      console.log(chalk.yellow("• Make sure SMTP server is running and accessible"));
    } else if (errorCode === "ENOTFOUND") {
      console.log(chalk.yellow("• SMTP host not found: " + host));
      console.log(chalk.yellow("• Check SMTP_HOST spelling (e.g., smtp.gmail.com)"));
      console.log(chalk.yellow("• Make sure you have internet connection"));
    } else if (errorCode === "ETIMEDOUT" || errorMessage.includes("timeout")) {
      console.log(chalk.yellow("• Connection timed out"));
      console.log(chalk.yellow("• SMTP server may be unreachable"));
      console.log(chalk.yellow("• Try a different port (465 vs 587)"));
      console.log(chalk.yellow("• Check if firewall is blocking the connection"));
      console.log(chalk.yellow("• If on Railway: your provider may block SMTP"));
    } else if (errorMessage.includes("Invalid login") || errorMessage.includes("Authentication failed")) {
      console.log(chalk.yellow("• SMTP authentication failed"));
      console.log(chalk.yellow("• Check SMTP_USER and SMTP_PASSWORD"));
      console.log(chalk.yellow("• For Gmail: use app password, not regular password"));
      console.log(chalk.yellow("• For Gmail: enable 2-Factor Authentication first"));
    } else if (errorMessage.includes("WRONG_VERSION_NUMBER") || errorMessage.includes("unexpected end-of-file")) {
      console.log(chalk.yellow("• SSL/TLS version mismatch"));
      console.log(chalk.yellow("• Try changing SMTP_PORT (465 ↔ 587)"));
      console.log(chalk.yellow("• Port 465 uses SSL, port 587 uses TLS"));
    } else if (errorMessage.includes("Unexpected server response")) {
      console.log(chalk.yellow("• Server responded unexpectedly"));
      console.log(chalk.yellow("• Check if you're using the correct protocol"));
      console.log(chalk.yellow("• Try a different port or SMTP provider"));
    }

    console.log("\n" + chalk.blue("💡 Tips:\n"));
    console.log(chalk.blue("1. Gmail users:"));
    console.log(chalk.blue("   • Go to https://myaccount.google.com/apppasswords"));
    console.log(chalk.blue("   • Generate an app password (not your regular password)"));
    console.log(chalk.blue("   • Use port 465 (secure) or 587 (TLS)"));
    console.log();
    console.log(chalk.blue("2. SendGrid users:"));
    console.log(chalk.blue("   • Host: smtp.sendgrid.net"));
    console.log(chalk.blue("   • Port: 587"));
    console.log(chalk.blue("   • User: apikey"));
    console.log(chalk.blue("   • Password: SG.xxxxxx... (your API key)"));
    console.log();
    console.log(chalk.blue("3. Try a different provider:"));
    console.log(chalk.blue("   • SendGrid (100 free emails/day)"));
    console.log(chalk.blue("   • Brevo (300 free emails/day)"));
    console.log();

    process.exit(1);
  }
}

testSMTP();
