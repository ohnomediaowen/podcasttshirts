import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

// Public: serves an uploaded replacement image.
export default async (_req: Request, context: Context) => {
  const { key } = context.params;
  if (!/^[a-z0-9-]{1,80}$/.test(key)) return new Response("Not found", { status: 404 });
  const store = getStore({ name: "site-images", consistency: "strong" });
  const entry = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!entry) return new Response("Not found", { status: 404 });
  const type = String(entry.metadata?.contentType ?? "application/octet-stream");
  return new Response(entry.data as ArrayBuffer, {
    headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" },
  });
};

export const config: Config = { path: "/api/image/:key", method: "GET" };
