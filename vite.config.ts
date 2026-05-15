import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React stays in the main vendor chunk
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/wouter/")
          ) {
            return "vendor";
          }
          // tRPC/query stack — needed on every page
          if (
            id.includes("@tanstack/react-query") ||
            id.includes("@trpc/")
          ) {
            return "query";
          }
          // Animation library — not needed on initial paint
          if (id.includes("node_modules/framer-motion")) {
            return "motion";
          }
          // Date utilities — only order/admin pages need these
          if (id.includes("node_modules/date-fns")) {
            return "date-fns";
          }
          // Icons — large but shared, gets cached quickly
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }
          // Radix UI primitives — split from main bundle
          if (id.includes("@radix-ui/")) {
            return "radix";
          }
          // Toast notifications
          if (id.includes("node_modules/sonner")) {
            return "ui-sonner";
          }
          // Superjson serialiser
          if (id.includes("node_modules/superjson")) {
            return "superjson";
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    hmr: {
      port: 24678,
      // clientPort: 443, // Uncomment this line if you are running this inside a cloud IDE like Replit or Codespaces
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
