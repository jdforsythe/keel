import { RAW_HTML_ATTRS, URL_ATTRS, isSafeUrl } from "@keel/runtime-dom/url";
import type { JSXAttribute } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { attrNameOf } from "../attrNameOf.ts";
import { decodeEntities } from "../decodeEntities.ts";
import { diag } from "../diag.ts";
import { isHtmlTag } from "../isHtmlTag.ts";
import { matchesRoute } from "../matchesRoute.ts";
import { staticValueOf } from "../staticValueOf.ts";
import { tagNameOf } from "../tagNameOf.ts";
import { uiBaseElements } from "../uiBaseElements.ts";
import { unifiedPatch } from "../unifiedPatch.ts";

/** Absolute URL (has a scheme or is protocol-relative) or a same-page fragment. */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** Navigation attributes: a literal path in them is a route reference (E1501). `src`, `poster`, `ping`, and `xlink:href` are assets. */
const NAVIGATION: ReadonlySet<string> = new Set(["href", "action", "formaction"]);

/** A URL prop of a `@keel/ui` base element: the DOM attribute it renders to; `required` props get no removal fix. */
type UrlProp = { readonly attr: string; readonly required: boolean };

/** URL props of `@keel/ui` base elements (k.ui, k.router `Link to`). */
const BASE_URL_PROPS: ReadonlyMap<string, ReadonlyMap<string, UrlProp>> = new Map<string, ReadonlyMap<string, UrlProp>>(
  [
    ["Link", new Map([["to", { attr: "href", required: true }]])],
    ["Image", new Map([["src", { attr: "src", required: false }]])],
  ],
);

/** The DOM attribute a URL-bearing attribute or prop of `tag` renders to, if any (URL or raw-HTML table). */
function urlTarget(html: boolean, base: string | undefined, name: string): UrlProp | undefined {
  if (html) {
    const n = name.toLowerCase();
    return URL_ATTRS.has(n) || RAW_HTML_ATTRS.has(n) ? { attr: n, required: false } : undefined;
  }
  return BASE_URL_PROPS.get(base ?? "")?.get(name);
}

/** Fix: delete the attribute and the whitespace before it. */
function removal(a: Analysis, at: JSXAttribute): string {
  let start = at.start;
  while (start > 0 && /\s/.test(a.source.charAt(start - 1))) start--;
  return unifiedPatch(a.path, a.source, [{ start, end: at.end, text: "" }]);
}

/**
 * E1003 a literal value the runtime would render as `about:blank` (`isSafeUrl` from `@keel/runtime-dom/url`,
 * the one URL policy: scheme outside http/https/mailto/tel in a URL attribute, or any `srcdoc`), in URL attributes
 * of DOM elements and URL props of base elements (`Link to`, `Image src`). E1501 (k.router) a literal path in a
 * navigation attribute (`href`, `action`, `formaction`, `Link to`) that starts with `/` or matches one of the route
 * path `patterns`; asset attributes take relative URLs. Absolute URLs (allowed scheme, `//`) and `#fragment`s are not
 * paths; E1003 takes precedence, so a literal gets at most one diagnostic (D32). E1003's fix removes the attribute
 * unless it is required.
 */
export function ruleUrlLiteral(a: Analysis, patterns: readonly string[] = []): Diagnostic[] {
  const out: Diagnostic[] = [];
  const base = uiBaseElements(a);
  for (const j of a.jsx) {
    if (j.type !== "JSXElement") continue;
    const tag = tagNameOf(j.openingElement.name);
    const html = isHtmlTag(tag);
    for (const at of j.openingElement.attributes) {
      if (at.type !== "JSXAttribute") continue;
      const name = attrNameOf(at.name);
      const target = urlTarget(html, base.get(tag), name);
      if (target === undefined) continue;
      const fix = target.required ? undefined : removal(a, at);
      if (RAW_HTML_ATTRS.has(target.attr)) {
        out.push(diag(a, "E1003", at.start, `${name} is raw HTML; it renders as about:blank`, "k.compiler", fix));
        continue;
      }
      const v = staticValueOf(at.value);
      if (v === undefined || v.bare) continue;
      const text = v.encoded ? decodeEntities(v.text) : v.text;
      if (!isSafeUrl(target.attr, text)) {
        const message = `${name} is a literal script/data URL; it renders as about:blank`;
        out.push(diag(a, "E1003", at.start, message, "k.compiler", fix));
      } else if (
        NAVIGATION.has(target.attr) &&
        !ABSOLUTE.test(text.trim()) &&
        (text.trim().startsWith("/") || matchesRoute(text, patterns))
      ) {
        out.push(diag(a, "E1501", at.start, `${name} is a string path; use href(routeId, params)`, "k.router"));
      }
    }
  }
  return out;
}
