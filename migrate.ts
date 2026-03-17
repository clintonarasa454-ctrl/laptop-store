import "dotenv/config";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("🔴 DATABASE_URL is not set in .env file.");
    process.exit(1);
  }

  let connection: mysql.Connection | undefined;
  try {
    console.log("🗄️  Connecting to database...");
    connection = await mysql.createConnection(connectionString);
    const db = drizzle(connection);
    console.log("🚀 Starting database migration...");

    await migrate(db, { migrationsFolder: "./drizzle" });
    
    console.log("✅ Migrations applied successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
    process.exit(0);
  }
}

runMigrations();