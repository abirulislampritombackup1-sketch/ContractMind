import { defineConfig, loadEnv, Plugin, ProxyOptions } from "vite";
import fs from "node:fs";
import path from "node:path";

// Dev only: saves a live analysis of a sample contract as its demo run (public/demo/<id>.<lang>.json).
// In the browser console, after analysing a sample: await window.__cmSaveDemoRun()
function saveDemoRuns(): Plugin {
  return {
    name: "contractmind-save-demo-runs",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__demo/save", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const run = JSON.parse(body);
            if (!/^(CUAD|MAUD)-\d{4}$/.test(run.sampleId) || !["en", "bn"].includes(run.lang) || !run.result?.contractTitle) throw new Error("Not a sample run.");
            const dir = path.resolve("public/demo");
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${run.sampleId}.${run.lang}.json`), JSON.stringify(run));
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ saved: `public/demo/${run.sampleId}.${run.lang}.json` }));
          } catch (e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e?.message || String(e) }));
          }
        });
      });
    },
  };
}
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load ALL env vars (no VITE_ prefix filter) on the server side only.
  // GEMINI_API_KEY has no VITE_ prefix, so Vite never inlines it into the bundle.
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.GEMINI_API_KEY || "";
  if (!apiKey) {
    console.warn("[contractmind] GEMINI_API_KEY is not set in .env — AI analysis will fail until it is.");
  }

  // Browser calls /api/gemini/...; the server forwards to Google with the key attached.
  const geminiProxy: Record<string, ProxyOptions> = {
    "/api/gemini": {
      target: "https://generativelanguage.googleapis.com",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/gemini/, "/v1beta"),
      headers: { "x-goog-api-key": apiKey },
    },
  };

  return {
    plugins: [react(), saveDemoRuns()],
    // docx is loaded lazily (on "Download Word redline"); pre-bundle it so the
    // dev server doesn't re-optimise and reload the page on first click.
    optimizeDeps: { include: ["docx"] },
    server: {
      proxy: geminiProxy,
      watch: {
        ignored: ["**/*.rar", "**/*.zip", "**/*.tar.gz", "**/*.7z", "**/.git/**", "**/dist/**"],
      },
    },
    preview: {
      proxy: geminiProxy,
    },
  };
});
