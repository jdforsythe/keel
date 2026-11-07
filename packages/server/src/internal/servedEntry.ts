import { ENTRY_PATH } from "@keel/compiler/entry/ENTRY_PATH";
import { RESUME_ENTRY } from "@keel/compiler/entry/RESUME_ENTRY";
import type { BuiltClient } from "./BuiltClient.ts";
import type { Handled } from "./Handled.ts";

/**
 * The client code a document with islands loads, for a GET or HEAD (k.server Build). With a production client build
 * (`built`, RFC 0048), each of its files by decoded URL path (`/assets/*`; a malformed escape matches none), 200 with
 * its content type, its weak `etag`, and `cache-control` `immutable` for a hashed name the manifest records, else
 * `no-cache`; an `if-none-match` naming the etag (or `*`) gets 304 without a body (RFC 0057). Else `/@keel/entry.ts`:
 * 200 JavaScript, the compiler's `RESUME_ENTRY`, the text the Vite plugin serves, which Vite resolves (RFC 0046). Every
 * such response is `nosniff`. Null for any other request, which takes the request flow. A path is only a key into the
 * set read at startup, so no request reaches the filesystem.
 */
export function servedEntry(raw: Request, path: string, built: BuiltClient | undefined): Handled | null {
  if (raw.method !== "GET" && raw.method !== "HEAD") return null;
  let key = path;
  try {
    key = decodeURIComponent(path);
  } catch {
    return null;
  }
  const file = built === undefined ? undefined : built.files.get(key);
  if (built === undefined ? path !== ENTRY_PATH : file === undefined) return null;
  const headers: Record<string, string> = {
    "content-type": file?.type ?? "text/javascript; charset=utf-8",
    "x-content-type-options": "nosniff",
  };
  let status = 200;
  if (file !== undefined) {
    headers["cache-control"] = file.immutable ? "public, max-age=31536000, immutable" : "no-cache";
    headers.etag = file.etag;
    const tags = (raw.headers.get("if-none-match") ?? "").split(",").map((t) => t.trim().replace(/^W\//, ""));
    if (tags.includes("*") || tags.includes(file.etag.slice(2))) status = 304;
  }
  const body = raw.method === "HEAD" || status === 304 ? null : (file?.body ?? RESUME_ENTRY);
  return { response: new Response(body, { status, headers }), route: undefined, diags: [] };
}
