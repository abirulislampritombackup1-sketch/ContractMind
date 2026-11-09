import { defineConfig, loadEnv, ProxyOptions } from "vite";
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
    plugins: [react()],
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
