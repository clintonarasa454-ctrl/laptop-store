import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Insert categories
await connection.execute(`
  INSERT IGNORE INTO categories (name, slug, description, imageUrl) VALUES
  ('Laptops', 'laptops', 'High-performance laptops for work, gaming, and creativity', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80'),
  ('Desktop PCs', 'desktops', 'Powerful desktop computers for every need', 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80'),
  ('Accessories', 'accessories', 'Keyboards, mice, monitors, and more', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80'),
  ('Monitors', 'monitors', 'Crystal-clear displays for work and gaming', 'https://images.unsplash.com/photo-1593640408182-31c228b6e5e8?w=800&q=80'),
  ('Components', 'components', 'CPUs, GPUs, RAM, and storage upgrades', 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&q=80')
`);
console.log("✅ Categories seeded");

// Get category IDs
const [cats] = await connection.execute("SELECT id, slug FROM categories");
const catMap = Object.fromEntries(cats.map(c => [c.slug, c.id]));
console.log("Category IDs:", catMap);

const laptopId = catMap['laptops'];
const desktopId = catMap['desktops'];
const accessoriesId = catMap['accessories'];
const monitorsId = catMap['monitors'];
const componentsId = catMap['components'];

// Insert products
const products = [
  // Laptops
  {
    categoryId: laptopId,
    name: 'MacBook Pro 16" M3 Pro',
    slug: 'macbook-pro-16-m3-pro',
    shortDescription: 'Apple M3 Pro chip with 18GB RAM and 512GB SSD',
    description: 'The MacBook Pro 16" with M3 Pro delivers extraordinary performance for professionals. Featuring the Apple M3 Pro chip, a stunning Liquid Retina XDR display, and up to 22 hours of battery life.',
    price: '2499.00',
    comparePrice: '2699.00',
    brand: 'Apple',
    sku: 'MBP16-M3PRO-512',
    stock: 15,
    images: JSON.stringify(['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80', 'https://images.unsplash.com/photo-1611186871525-b2e1e7e8e9e2?w=800&q=80']),
    specifications: JSON.stringify({ Chip: 'Apple M3 Pro', RAM: '18GB Unified Memory', Storage: '512GB SSD', Display: '16.2" Liquid Retina XDR', Battery: 'Up to 22 hours', Weight: '2.14 kg', OS: 'macOS Sonoma' }),
    featured: true,
  },
  {
    categoryId: laptopId,
    name: 'Dell XPS 15 OLED',
    slug: 'dell-xps-15-oled',
    shortDescription: 'Intel Core i9 with RTX 4060 and 4K OLED display',
    description: 'The Dell XPS 15 combines stunning OLED display technology with powerful Intel Core i9 performance. Perfect for creative professionals and power users.',
    price: '1899.00',
    comparePrice: '2099.00',
    brand: 'Dell',
    sku: 'XPS15-I9-4060',
    stock: 20,
    images: JSON.stringify(['https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80', 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&q=80']),
    specifications: JSON.stringify({ Processor: 'Intel Core i9-13900H', RAM: '32GB DDR5', Storage: '1TB NVMe SSD', GPU: 'NVIDIA RTX 4060 8GB', Display: '15.6" 3.5K OLED Touch', Battery: 'Up to 13 hours', Weight: '1.86 kg', OS: 'Windows 11 Pro' }),
    featured: true,
  },
  {
    categoryId: laptopId,
    name: 'ThinkPad X1 Carbon Gen 11',
    slug: 'thinkpad-x1-carbon-gen-11',
    shortDescription: 'Ultra-light business laptop with Intel vPro',
    description: 'The ThinkPad X1 Carbon Gen 11 is the ultimate business ultrabook. Weighing just 1.12kg, it delivers enterprise-grade security and all-day battery life.',
    price: '1599.00',
    comparePrice: '1799.00',
    brand: 'Lenovo',
    sku: 'X1C-G11-I7',
    stock: 25,
    images: JSON.stringify(['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&q=80']),
    specifications: JSON.stringify({ Processor: 'Intel Core i7-1365U vPro', RAM: '16GB LPDDR5', Storage: '512GB SSD', Display: '14" 2.8K OLED', Battery: 'Up to 15 hours', Weight: '1.12 kg', OS: 'Windows 11 Pro' }),
    featured: false,
  },
  {
    categoryId: laptopId,
    name: 'ASUS ROG Zephyrus G14',
    slug: 'asus-rog-zephyrus-g14',
    shortDescription: 'AMD Ryzen 9 gaming laptop with RTX 4060',
    description: 'The ROG Zephyrus G14 packs incredible gaming performance into a compact 14" chassis. With AMD Ryzen 9 and RTX 4060, it handles any game with ease.',
    price: '1449.00',
    comparePrice: '1599.00',
    brand: 'ASUS',
    sku: 'ROG-G14-R9-4060',
    stock: 18,
    images: JSON.stringify(['https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800&q=80']),
    specifications: JSON.stringify({ Processor: 'AMD Ryzen 9 7940HS', RAM: '16GB DDR5', Storage: '1TB NVMe SSD', GPU: 'NVIDIA RTX 4060 8GB', Display: '14" QHD+ 165Hz', Battery: 'Up to 10 hours', Weight: '1.65 kg', OS: 'Windows 11 Home' }),
    featured: true,
  },
  {
    categoryId: laptopId,
    name: 'HP Spectre x360 14',
    slug: 'hp-spectre-x360-14',
    shortDescription: '2-in-1 convertible with Intel Evo platform',
    description: 'The HP Spectre x360 14 is a premium 2-in-1 laptop with a gorgeous OLED display and Intel Evo platform certification for responsiveness and battery life.',
    price: '1349.00',
    comparePrice: '1499.00',
    brand: 'HP',
    sku: 'SPECTRE-X360-14',
    stock: 22,
    images: JSON.stringify(['https://images.unsplash.com/photo-1544731612-de7f96afe55f?w=800&q=80']),
    specifications: JSON.stringify({ Processor: 'Intel Core i7-1355U', RAM: '16GB LPDDR5', Storage: '512GB SSD', Display: '13.5" 3K2K OLED Touch', Battery: 'Up to 17 hours', Weight: '1.36 kg', OS: 'Windows 11 Home' }),
    featured: false,
  },
  {
    categoryId: laptopId,
    name: 'Razer Blade 15',
    slug: 'razer-blade-15',
    shortDescription: 'Premium gaming laptop with RTX 4070',
    description: "The Razer Blade 15 is the world's smallest 15\" gaming laptop. Featuring RTX 4070 graphics and a 240Hz QHD display for the ultimate gaming experience.",
    price: '2299.00',
    comparePrice: '2499.00',
    brand: 'Razer',
    sku: 'BLADE15-4070',
    stock: 10,
    images: JSON.stringify(['https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80']),
    specifications: JSON.stringify({ Processor: 'Intel Core i9-13950HX', RAM: '32GB DDR5', Storage: '1TB SSD', GPU: 'NVIDIA RTX 4070 8GB', Display: '15.6" QHD 240Hz', Battery: 'Up to 8 hours', Weight: '2.01 kg', OS: 'Windows 11 Home' }),
    featured: true,
  },
  // Desktops
  {
    categoryId: desktopId,
    name: 'Apple Mac Studio M2 Ultra',
    slug: 'apple-mac-studio-m2-ultra',
    shortDescription: 'Extreme performance in a compact desktop form',
    description: 'The Mac Studio with M2 Ultra delivers workstation-class performance in a remarkably compact design. Perfect for video editors, 3D artists, and developers.',
    price: '3999.00',
    comparePrice: '4299.00',
    brand: 'Apple',
    sku: 'MACSTUDIO-M2U',
    stock: 8,
    images: JSON.stringify(['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80']),
    specifications: JSON.stringify({ Chip: 'Apple M2 Ultra', RAM: '64GB Unified Memory', Storage: '1TB SSD', GPU: '60-core GPU', Ports: 'Thunderbolt 4, USB-A, HDMI, SD Card', OS: 'macOS Sonoma' }),
    featured: true,
  },
  {
    categoryId: desktopId,
    name: 'Custom Gaming PC RTX 4090',
    slug: 'custom-gaming-pc-rtx-4090',
    shortDescription: 'Intel i9 + RTX 4090 ultimate gaming desktop',
    description: 'Our flagship custom gaming PC features the latest Intel Core i9 processor paired with the NVIDIA RTX 4090 for unmatched 4K gaming performance.',
    price: '3499.00',
    comparePrice: '3799.00',
    brand: 'Custom Build',
    sku: 'GAMING-I9-4090',
    stock: 5,
    images: JSON.stringify(['https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80']),
    specifications: JSON.stringify({ Processor: 'Intel Core i9-14900K', RAM: '64GB DDR5', Storage: '2TB NVMe SSD', GPU: 'NVIDIA RTX 4090 24GB', Cooling: '360mm AIO Liquid Cooler', Case: 'Lian Li O11 Dynamic', OS: 'Windows 11 Pro' }),
    featured: true,
  },
  // Monitors
  {
    categoryId: monitorsId,
    name: 'LG UltraWide 34" OLED',
    slug: 'lg-ultrawide-34-oled',
    shortDescription: '34" curved OLED ultrawide with 240Hz refresh',
    description: 'The LG UltraWide 34" OLED monitor delivers stunning visuals with perfect blacks and vibrant colors. The 240Hz refresh rate ensures buttery-smooth gaming.',
    price: '1299.00',
    comparePrice: '1499.00',
    brand: 'LG',
    sku: 'LG-34OLED-240',
    stock: 12,
    images: JSON.stringify(['https://images.unsplash.com/photo-1593640408182-31c228b6e5e8?w=800&q=80']),
    specifications: JSON.stringify({ Size: '34"', Resolution: '3440x1440 UWQHD', Panel: 'OLED', 'Refresh Rate': '240Hz', 'Response Time': '0.03ms', HDR: 'HDR10', Connectivity: 'HDMI 2.1, DisplayPort 1.4, USB-C' }),
    featured: false,
  },
  {
    categoryId: monitorsId,
    name: 'Samsung Odyssey G9 49"',
    slug: 'samsung-odyssey-g9-49',
    shortDescription: 'Super ultrawide 49" curved gaming monitor',
    description: 'The Samsung Odyssey G9 is the ultimate gaming monitor with a massive 49" curved display that immerses you completely in your games.',
    price: '1799.00',
    comparePrice: '1999.00',
    brand: 'Samsung',
    sku: 'ODYSSEY-G9-49',
    stock: 7,
    images: JSON.stringify(['https://images.unsplash.com/photo-1593640408182-31c228b6e5e8?w=800&q=80']),
    specifications: JSON.stringify({ Size: '49"', Resolution: '5120x1440 DQHD', Panel: 'VA Curved', 'Refresh Rate': '240Hz', 'Response Time': '1ms', HDR: 'HDR1000', Connectivity: 'HDMI 2.1, DisplayPort 1.4' }),
    featured: true,
  },
  // Accessories
  {
    categoryId: accessoriesId,
    name: 'Logitech MX Keys S',
    slug: 'logitech-mx-keys-s',
    shortDescription: 'Advanced wireless keyboard for professionals',
    description: 'The Logitech MX Keys S is the ultimate productivity keyboard with smart backlighting, multi-device connectivity, and a premium typing experience.',
    price: '119.00',
    comparePrice: '139.00',
    brand: 'Logitech',
    sku: 'MX-KEYS-S',
    stock: 50,
    images: JSON.stringify(['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80']),
    specifications: JSON.stringify({ Type: 'Wireless Keyboard', Connectivity: 'Bluetooth, USB Receiver', Battery: 'Up to 10 days', Backlight: 'Smart Adaptive Backlight', Compatibility: 'Windows, macOS, Linux' }),
    featured: false,
  },
  {
    categoryId: accessoriesId,
    name: 'Logitech MX Master 3S',
    slug: 'logitech-mx-master-3s',
    shortDescription: 'Precision wireless mouse for power users',
    description: 'The MX Master 3S is the most advanced mouse for creators and power users. With 8K DPI tracking and MagSpeed scroll wheel, it redefines precision.',
    price: '99.00',
    comparePrice: '119.00',
    brand: 'Logitech',
    sku: 'MX-MASTER-3S',
    stock: 45,
    images: JSON.stringify(['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80']),
    specifications: JSON.stringify({ Type: 'Wireless Mouse', DPI: '200-8000 DPI', Buttons: '7 programmable', Battery: 'Up to 70 days', Connectivity: 'Bluetooth, USB Receiver', Compatibility: 'Windows, macOS, Linux' }),
    featured: false,
  },
  // Components
  {
    categoryId: componentsId,
    name: 'NVIDIA RTX 4080 Super',
    slug: 'nvidia-rtx-4080-super',
    shortDescription: 'High-end GPU for 4K gaming and AI workloads',
    description: 'The NVIDIA GeForce RTX 4080 Super delivers exceptional 4K gaming performance with DLSS 3 and ray tracing capabilities for stunning visuals.',
    price: '999.00',
    comparePrice: '1099.00',
    brand: 'NVIDIA',
    sku: 'RTX-4080-SUPER',
    stock: 14,
    images: JSON.stringify(['https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&q=80']),
    specifications: JSON.stringify({ VRAM: '16GB GDDR6X', 'CUDA Cores': '10240', 'Boost Clock': '2550 MHz', 'Memory Bandwidth': '736 GB/s', TDP: '320W', Connectivity: 'HDMI 2.1, 3x DisplayPort 1.4a' }),
    featured: true,
  },
  {
    categoryId: componentsId,
    name: 'Samsung 990 Pro 2TB NVMe',
    slug: 'samsung-990-pro-2tb-nvme',
    shortDescription: 'PCIe 4.0 NVMe SSD with 7450 MB/s read speed',
    description: 'The Samsung 990 Pro delivers blazing-fast PCIe 4.0 performance for gaming and professional workloads. With 2TB capacity and up to 7450 MB/s sequential read speeds.',
    price: '179.00',
    comparePrice: '219.00',
    brand: 'Samsung',
    sku: 'SAM-990PRO-2TB',
    stock: 35,
    images: JSON.stringify(['https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&q=80']),
    specifications: JSON.stringify({ Capacity: '2TB', Interface: 'PCIe 4.0 x4 NVMe', 'Sequential Read': '7450 MB/s', 'Sequential Write': '6900 MB/s', 'Form Factor': 'M.2 2280', Warranty: '5 years' }),
    featured: false,
  },
];

for (const product of products) {
  try {
    await connection.execute(
      `INSERT IGNORE INTO products (categoryId, name, slug, shortDescription, description, price, comparePrice, brand, sku, stock, images, specifications, featured, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
      [product.categoryId, product.name, product.slug, product.shortDescription, product.description, product.price, product.comparePrice || null, product.brand, product.sku, product.stock, product.images, product.specifications, product.featured ? 1 : 0]
    );
    console.log(`✅ Inserted: ${product.name}`);
  } catch (err) {
    console.error(`❌ Failed: ${product.name}`, err.message);
  }
}

console.log("\n🎉 Seeding complete!");
await connection.end();
