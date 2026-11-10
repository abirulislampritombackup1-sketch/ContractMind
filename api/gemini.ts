// Production counterpart of the /api/gemini proxy in vite.config.ts.
// The browser calls /api/gemini/models/<model>:generateContent; vercel.json
// rewrites that to this function, which attaches GEMINI_API_KEY server-side
// and forwards the request to Google. The key never reaches the browser.

export const config = { maxDuration: 60 };

const UPSTREAM = "https://generativelanguage.googleapis.com/v1beta/";
// Only allow the calls the app makes (generation + batch embeddings for retrieval),
// so this can't be used as an open proxy.
const ALLOWED_PATH = /^models\/[A-Za-z0-9.\-]+:(generateContent|batchEmbedContents)$/;

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(500, "GEMINI_API_KEY is not set in the Vercel project's environment variables.");
  }

  const path = new URL(request.url).searchParams.get("path") || "";
  if (!ALLOWED_PATH.test(path)) return json(400, "Unsupported Gemini API path.");

  const upstream = await fetch(UPSTREAM + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: await request.text(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}
