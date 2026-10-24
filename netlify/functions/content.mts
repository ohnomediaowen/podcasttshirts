import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";
import { json } from "../lib/auth.mts";

// Public: returns the saved edits (text, links, images) that the page applies on load.
export default async () => {
  const store = getStore({ name: "site-content", consistency: "strong" });
  const content = (await store.get("content", { type: "json" })) ?? {};
  return json(content);
};

export const config: Config = { path: "/api/content", method: "GET" };
