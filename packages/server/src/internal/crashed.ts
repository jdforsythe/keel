import type { KeelError } from "@keel/schema";
import type { Handled } from "./Handled.ts";
import type { Mode } from "./Mode.ts";
import { escapeHtml } from "./escapeHtml.ts";
import { publicError } from "./publicError.ts";

/**
 * Last resort when the request flow itself threw (a server bug): `status` (default 500, 502 for an unreachable peer)
 * `keel.unexpected`, scrubbed in production.
 */
export function crashed(mode: Mode, e: KeelError<string, unknown>, status = 500): Handled {
  const shown = publicError(e, mode);
  const body = `<!doctype html><html lang="en"><body><main><div role="alert" data-keel-error="${escapeHtml(shown.code)}">${escapeHtml(shown.message)}</div></main></body></html>`;
  return {
    response: new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } }),
    route: undefined,
    diags: [],
  };
}
