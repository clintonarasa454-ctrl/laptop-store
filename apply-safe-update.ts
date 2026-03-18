import "dotenv/config";
import mysql from "mysql2/promise";

async function safeUpdate() {
  let dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl) {
    console.error("🔴 DATABASE_URL is not set.");
    process.exit(1);
  }
  
  dbUrl = dbUrl.trim();
  if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
    dbUrl = dbUrl.slice(1, -1);
  }

  let connection;
  try {
    console.log("🗄️ Connecting to database...");
    connection = await mysql.createConnection(dbUrl);
    
    console.log("🚀 Applying safe schema updates without dropping data...");
    
    await connection.query("ALTER TABLE `users` MODIFY COLUMN `name` varchar(256);");
    console.log("✅ Users table updated.");

    await connection.query("ALTER TABLE `payments` MODIFY COLUMN `method` enum('mpesa','paypal','stripe','card','cod') NOT NULL;");
    console.log("✅ Payments table updated.");

    await connection.query("ALTER TABLE `orders` MODIFY COLUMN `paymentMethod` enum('mpesa','paypal','stripe','card','cod');");
    console.log("✅ Orders table updated.");

    console.log("🎉 All safe updates applied successfully!");
  } catch (error) {
    console.error("❌ Update failed:", error);
  } finally {
    if (connection) await connection.end();
    process.exit(0);
  }
}

safeUpdate();