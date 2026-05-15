import "dotenv/config";
import { getDb, getSetting, upsertSetting } from "./server/db";

async function fixEmailSettings() {
  const db = await getDb();
  if (!db) return console.error("Database connection failed");

  const currentData = await getSetting("email");
  
  if (currentData) {
    currentData.smtpPort = 465; // Force the secure port
    await upsertSetting("email", currentData);
    console.log("✅ Database email settings successfully updated to use secure port 465!");
  } else {
    console.log("⚠️ No email settings found. Please configure them in the Admin Panel.");
  }
  process.exit(0);
}

fixEmailSettings();