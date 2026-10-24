import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** True when the request carries the correct edit password. */
export function isAuthorized(req: Request): boolean {
  const expected = Netlify.env.get("EDIT_PASSWORD");
  if (!expected) return false;
  const given = req.headers.get("x-edit-password") ?? "";
  return timingSafeEqual(digest(given), digest(expected));
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
