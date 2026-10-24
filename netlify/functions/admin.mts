import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import { isAuthorized, json } from "../lib/auth.mts";

const KEY = /^[a-z0-9-]{1,80}$/;
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_CONTENT = 300 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Password-protected: check login, save shop edits, upload shirt photos.
// The page sanitizes every field again when it applies the saved edits.
export default async (req: Request, context: Context) => {
  if (!isAuthorized(req)) return json({ error: "Wrong password" }, 401);
  const url = new URL(req.url);

  if (url.pathname === "/api/auth") return json({ ok: true });

  if (url.pathname === "/api/save") {
    const raw = await req.text();
    if (raw.length > MAX_CONTENT) return json({ error: "Too much content" }, 413);
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Bad request" }, 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Bad request" }, 400);
    const content = {
      site: body.site && typeof body.site === "object" ? body.site : {},
      shows: body.shows && typeof body.shows === "object" ? body.shows : {},
      savedAt: new Date().toISOString(),
    };
    const store = getStore({ name: "site-content", consistency: "strong" });
    const prev = await store.get("content", { type: "json" });
    if (prev) await store.setJSON("content-previous", prev);
    await store.setJSON("content", content);
    return json({ ok: true });
  }

  if (url.pathname.startsWith("/api/upload/")) {
    const { key } = context.params;
    if (!KEY.test(key ?? "")) return json({ error: "Bad key" }, 400);
    const type = (req.headers.get("content-type") ?? "").split(";")[0];
    if (!IMAGE_TYPES.includes(type)) return json({ error: "Use a PNG, JPG, WebP or GIF" }, 415);
    const data = await req.arrayBuffer();
    if (data.byteLength > MAX_IMAGE) return json({ error: "Image must be under 4 MB" }, 413);
    const store = getStore({ name: "site-images", consistency: "strong" });
    await store.set(key, data, { metadata: { contentType: type } });
    return json({ ok: true, url: `/api/image/${key}?v=${Date.now()}` });
  }

  return json({ error: "Not found" }, 404);
};

export const config: Config = {
  path: ["/api/auth", "/api/save", "/api/upload/:key"],
  method: ["POST", "PUT"],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
