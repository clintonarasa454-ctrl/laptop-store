import { config } from "dotenv";
config(); // Load environment variables from .env

import { randomBytes, scryptSync } from "crypto";
import { getDb, upsertCategory, getCategoryBySlug, upsertProduct } from "./db";
import { deliveryAgents } from "../drizzle/schema";

async function seed() {
  console.log("⏳ Connecting to the database...");
  const db = await getDb();
  if (!db) {
    console.error("❌ Failed to connect to the database. Check your DATABASE_URL.");
    process.exit(1);
  }

  console.log("🌱 Seeding Categories...");
  const categories = [
    { name: "Laptops", slug: "laptops", description: "High-performance laptops for work and play.", imageUrl: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500" },
    { name: "Desktops", slug: "desktops", description: "Powerful desktop computers and workstations.", imageUrl: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=500" },
    { name: "Accessories", slug: "accessories", description: "Essential computer accessories and peripherals.", imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500" }
  ];

  for (const cat of categories) {
    await upsertCategory(cat);
  }

  console.log("🔍 Fetching Category IDs...");
  const laptopsCat = await getCategoryBySlug("laptops");
  const desktopsCat = await getCategoryBySlug("desktops");

  if (!laptopsCat || !desktopsCat) {
    console.error("❌ Failed to retrieve categories. Did the insertion fail?");
    process.exit(1);
  }

  console.log("🌱 Seeding Products...");
  const products = [
    {
      categoryId: laptopsCat.id,
      name: "MacBook Pro 16-inch",
      slug: "macbook-pro-16",
      description: "The most powerful MacBook Pro ever is here. With the blazing-fast M2 Max chip.",
      shortDescription: "M2 Max chip, 32GB RAM, 1TB SSD",
      price: "2499.00",
      comparePrice: "2699.00",
      stock: 15,
      brand: "Apple",
      sku: "MBP-16-M2",
      images: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800"],
      specifications: { "Processor": "M2 Max", "RAM": "32GB", "Storage": "1TB SSD", "Display": "16.2-inch Liquid Retina XDR" },
      featured: true,
      active: true
    },
    {
      categoryId: desktopsCat.id,
      name: "Dell XPS Desktop",
      slug: "dell-xps-desktop",
      description: "A desktop that grows with you. Packed with the latest NVIDIA RTX graphics.",
      shortDescription: "Intel Core i9, 64GB RAM, RTX 4080",
      price: "1899.00",
      stock: 8,
      brand: "Dell",
      sku: "DELL-XPS-01",
      images: ["https://images.unsplash.com/photo-1587831990711-23ca6441447b?w=800"],
      specifications: { "Processor": "Intel Core i9", "RAM": "64GB", "Graphics": "NVIDIA RTX 4080", "Storage": "2TB NVMe" },
      featured: true,
      active: true
    }
  ];

  for (const prod of products) {
    await upsertProduct(prod);
  }

  function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derivedKey}`;
  }

  console.log("🌱 Seeding Delivery Agents...");
  const agents = [
    { id: 1, name: "John Kamau", phone: "+254712345678", vehicleNumber: "KDA 123X", vehicleType: "bike", isAvailable: true, pin: hashPassword("1111") },
    { id: 2, name: "Peter Ochieng", phone: "+254723456789", vehicleNumber: "KBC 456Y", vehicleType: "truck", isAvailable: true, pin: hashPassword("2222") },
    { id: 3, name: "Sarah Wanjiku", phone: "+254734567890", vehicleNumber: "KCA 789Z", vehicleType: "bike", isAvailable: false, pin: hashPassword("3333") }
  ];

  for (const agent of agents) {
    await db.insert(deliveryAgents)
      .values(agent)
      .onDuplicateKeyUpdate({ set: agent });
  }

  console.log("✅ Database seeded successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});