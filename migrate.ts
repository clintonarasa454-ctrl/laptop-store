import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("🔴 DATABASE_URL is not set in .env file.");
    process.exit(1);
  }

  try {
    console.log(`🗄️  Connecting to PostgreSQL database...`);
    
    const connection = postgres(connectionString, { prepare: false });
    const db = drizzle(connection, {});
    console.log("🚀 Starting PostgreSQL migration...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✅ Migrations applied successfully!");
    await connection.end();
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigrations();