import { ENTRY_PATH } from "@keel/compiler/entry/ENTRY_PATH";
import { RESUME_ENTRY } from "@keel/compiler/entry/RESUME_ENTRY";
import type { BuiltClient } from "./BuiltClient.ts";
import type { Handled } from "./Handled.ts";

const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * The client code a document with islands loads, for a GET or HEAD (k.server Build). With a production client build
 * (`built`, RFC 0048), each of its files by URL path (`/assets/*`, the entry), 200 with its content type and
 * `cache-control` immutable (hashed names). Else `/@keel/entry.ts`: 200 JavaScript, the compiler's `RESUME_ENTRY`, the
 * text the Vite plugin serves, which Vite resolves (RFC 0046). Null for any other request, which takes the request flow.
 */
export function servedEntry(raw: Request, path: string, built: BuiltClient | undefined): Handled | null {
  if (raw.method !== "GET" && raw.method !== "HEAD") return null;
  const file = built === undefined ? undefined : built.files.get(path);
  if (built === undefined ? path !== ENTRY_PATH : file === undefined) return null;
  const headers: Record<string, string> =
    file === undefined
      ? { "content-type": "text/javascript; charset=utf-8" }
      : { "content-type": file.type, "cache-control": IMMUTABLE };
  const body = raw.method === "HEAD" ? null : (file?.body ?? RESUME_ENTRY);
  return { response: new Response(body, { status: 200, headers }), route: undefined, diags: [] };
}
