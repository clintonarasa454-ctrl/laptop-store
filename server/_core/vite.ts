import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server, port?: number) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
    port,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // If the request is for a static asset that wasn't found by Vite, return 404 
    // instead of serving index.html to prevent confusing MIME type errors in the browser.
    if (url.split('?')[0].match(/\.(js|jsx|ts|tsx|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|eot)$/)) {
      return res.status(404).send("Asset not found");
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // ── Hashed assets — cache forever ──────────────────────────────────────────
  // Vite content-hashes every file in /assets/*, so it's safe to cache them
  // for a full year. When code changes, new hashes are generated automatically.
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      etag: false,     // hash in filename is better than ETag for these
    })
  );

  // ── Everything else (favicon, robots.txt, etc.) — short cache ──────────────
  app.use(
    express.static(distPath, {
      maxAge: "1h",
      etag: true,
      setHeaders(res, filePath) {
        // HTML must never be cached — the entry point changes on every deploy
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );

  // ── SPA fallback — serve index.html for any unmatched route ────────────────
  app.use("*", (req, res) => {
    const url = req.originalUrl.split('?')[0];
    if (url.match(/\.(js|jsx|ts|tsx|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|eot)$/)) {
      return res.status(404).send("Asset not found");
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
