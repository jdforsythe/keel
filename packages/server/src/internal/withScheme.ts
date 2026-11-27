import type { Req } from "./Req.ts";
import { schemeOf } from "./schemeOf.ts";

/**
 * Run a synchronous render with `<html>` of the server document carrying the request's scheme pick (k.schemes First
 * paint), so a `SchemeSelect` shows it; the attribute is removed after, whatever `fn` does. One scheme: `fn` alone.
 */
export function withScheme<T>(r: Req, fn: () => T): T {
  const scheme = r.sv.schemes === true ? schemeOf(r.raw) : undefined;
  if (scheme === undefined || typeof document === "undefined") return fn();
  const root = document.documentElement;
  root.setAttribute("data-k-scheme", scheme);
  try {
    return fn();
  } finally {
    root.removeAttribute("data-k-scheme");
  }
}
