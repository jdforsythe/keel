import { ENTRY_PATH } from "@keel/compiler/entry/ENTRY_PATH";
import { RESUME_ENTRY } from "@keel/compiler/entry/RESUME_ENTRY";
import type { Handled } from "./Handled.ts";

/**
 * The generated resume entry a document with islands loads (k.runtime, RFC 0046): a GET or HEAD of
 * `/@keel/entry.ts` answers 200 JavaScript (the compiler's `RESUME_ENTRY`, the text the Vite plugin serves; Vite
 * resolves its imports). Null for any other request, which takes the request flow.
 */
export function servedEntry(raw: Request, path: string): Handled | null {
  if (path !== ENTRY_PATH || (raw.method !== "GET" && raw.method !== "HEAD")) return null;
  const response = new Response(raw.method === "HEAD" ? null : RESUME_ENTRY, {
    status: 200,
    headers: { "content-type": "text/javascript; charset=utf-8" },
  });
  return { response, route: undefined, diags: [] };
}
