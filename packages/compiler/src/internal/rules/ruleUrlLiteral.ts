import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { URL_ATTRS } from "../URL_ATTRS.ts";
import { attrNameOf } from "../attrNameOf.ts";
import { dangerousUrl } from "../dangerousUrl.ts";
import { decodeEntities } from "../decodeEntities.ts";
import { diag } from "../diag.ts";
import { isHtmlTag } from "../isHtmlTag.ts";
import { staticValueOf } from "../staticValueOf.ts";
import { tagNameOf } from "../tagNameOf.ts";

/** Absolute URL (has a scheme or is protocol-relative) or a same-page fragment. */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** E1003 literal `javascript:`/`data:` URL in a URL attribute; E1501 literal string path (k.router). */
export function ruleUrlLiteral(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const j of a.jsx) {
    if (j.type !== "JSXElement" || !isHtmlTag(tagNameOf(j.openingElement.name))) continue;
    for (const at of j.openingElement.attributes) {
      if (at.type !== "JSXAttribute") continue;
      const name = attrNameOf(at.name);
      if (!URL_ATTRS.has(name)) continue;
      const v = staticValueOf(at.value);
      if (v === undefined || v.bare) continue;
      const text = (v.encoded ? decodeEntities(v.text) : v.text).trim();
      if (dangerousUrl(text)) {
        out.push(
          diag(a, "E1003", at.start, `${name} is a literal script/data URL; it renders as about:blank`, "k.compiler"),
        );
      } else if (!ABSOLUTE.test(text)) {
        out.push(diag(a, "E1501", at.start, `${name} is a string path; use href(routeId, params)`, "k.router"));
      }
    }
  }
  return out;
}
