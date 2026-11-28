import type { Ctx } from "@keel/ctx";
import { appearanceOf } from "./internal/appearanceOf.ts";
import type { Appearance } from "./types/Appearance.ts";

/** A year, a pick's cookie lifetime. */
const YEAR = 31536000;
const THEME_NAME = /^[a-z][A-Za-z0-9]{0,23}$/;

/** Write one cookie of a pick (k.schemes Choice): `<name>=<value>` for a year, or expired; it holds no identifier. */
const cookie = (doc: Document, name: string, value: string | undefined): void => {
  const secure = doc.location?.protocol === "https:" ? "; Secure" : "";
  doc.cookie =
    value === undefined
      ? `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      : `${name}=${value}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
};

/**
 * The person's pick of scheme and theme for `ctx` (k.schemes Choice), the one way app code, `SchemeSelect` and
 * `ThemeSelect` read and set it. `scheme()` is `<html>`'s `data-k-scheme` (`light`, `dark`) else `system`; `theme()`
 * is its `data-k-theme` when that names a `choice` theme the ctx knows, else `default`; both are reactive reads. `set`
 * writes the attributes and the `keel-scheme` and `keel-theme` cookies as a pick does (`system` and `default` remove
 * them) and returns `true`, or `false` with no change for a theme it does not know or with no document. It knows the
 * `choice` themes of its deployable's tokens or, under a sim ctx, of the harness render given that ctx, whose document
 * it uses; on a server it reads the document the request renders, whose attributes come from its cookies.
 */
export function appearance(ctx: Ctx): Appearance {
  const scheme = (): "system" | "light" | "dark" => {
    const a = appearanceOf(ctx);
    a.version.get();
    const v = a.document?.documentElement.getAttribute("data-k-scheme");
    return v === "light" || v === "dark" ? v : "system";
  };
  const theme = (): string => {
    const a = appearanceOf(ctx);
    a.version.get();
    const v = a.document?.documentElement.getAttribute("data-k-theme");
    return v !== null && v !== undefined && a.themes.includes(v) ? v : "default";
  };
  const set: Appearance["set"] = (pick) => {
    const a = appearanceOf(ctx);
    const doc = a.document;
    if (doc === undefined) return false;
    const t = pick.theme;
    if (t !== undefined && t !== "default" && !(THEME_NAME.test(t) && a.themes.includes(t))) return false;
    const s = pick.scheme;
    if (s !== undefined && s !== "system" && s !== "light" && s !== "dark") return false;
    const html = doc.documentElement;
    if (s === "light" || s === "dark") {
      html.setAttribute("data-k-scheme", s);
      cookie(doc, "keel-scheme", s);
    } else if (s === "system") {
      html.removeAttribute("data-k-scheme");
      cookie(doc, "keel-scheme", undefined);
    }
    if (t !== undefined && t !== "default") {
      html.setAttribute("data-k-theme", t);
      cookie(doc, "keel-theme", t);
    } else if (t === "default") {
      html.removeAttribute("data-k-theme");
      cookie(doc, "keel-theme", undefined);
    }
    a.version.set(a.version.get() + 1);
    return true;
  };
  return { scheme, theme, set };
}
