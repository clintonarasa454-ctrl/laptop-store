import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";

let _db: any = null;
let _connection: any = null;

async function initializeDatabase() {
  if (_db) return _db;

  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL not configured for PostgreSQL");
    }

    console.log("📚 Initializing PostgreSQL database...");
    _connection = postgres(databaseUrl, { 
      prepare: false,      // Required for Supabase connection pooler (pgbouncer/Supavisor)
      max: 20,             // Max number of connections per Node instance
      idle_timeout: 20,    // Close idle connections after 20 seconds
      connect_timeout: 10, // Timeout if connection fails to establish within 10s
    });
    _db = drizzle(_connection, { schema });
    console.log("✅ Connected to PostgreSQL");
    _connection`SELECT 1`.catch(() => {});
    
    return _db;
  } catch (error) {
    console.error("❌ Database connection error:", error);
    throw error;
  }
}

export async function getDb() {
  if (!_db) {
    await initializeDatabase();
  }
  return _db;
}

export async function closeDatabase() {
  if (_connection) {
    await _connection.end();
    _db = null;
    _connection = null;
    console.log("Database connection closed");
  }
}

export { schema };
