import { rendered } from "@keel/runtime-dom/internal";
import type { Req } from "./Req.ts";
import { schemeOf } from "./schemeOf.ts";
import { themeOf } from "./themeOf.ts";

/**
 * Run a synchronous render with `<html>` of the server document carrying the request's scheme and theme picks
 * (k.schemes First paint), so a `SchemeSelect` and a `ThemeSelect` show them and `appearance(ctx)` reads them, the
 * render's ctx knowing the app's `choice` themes; the attributes are removed after, whatever `fn` does.
 */
export function withScheme<T>(r: Req, fn: () => T): T {
  if (typeof document === "undefined") return fn();
  const scheme = r.sv.schemes === true ? schemeOf(r.raw) : undefined;
  const theme = themeOf(r.raw, r.sv.themes);
  rendered.set(r.sv.ctx, { document, artifacts: { themes: r.sv.themes ?? [] } });
  const root = document.documentElement;
  if (scheme !== undefined) root.setAttribute("data-k-scheme", scheme);
  if (theme !== undefined) root.setAttribute("data-k-theme", theme);
  try {
    return fn();
  } finally {
    root.removeAttribute("data-k-scheme");
    root.removeAttribute("data-k-theme");
  }
}
