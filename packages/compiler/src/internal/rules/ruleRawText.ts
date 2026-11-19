import type { Analysis } from "../Analysis.ts";
import { RAW_TEXT_TAGS } from "../RAW_TEXT_TAGS.ts";
import { attrNameOf } from "../attrNameOf.ts";
import { endsRawText } from "../endsRawText.ts";
import { literalTextOf } from "../literalTextOf.ts";
import { staticValueOf } from "../staticValueOf.ts";
import { tagNameOf } from "../tagNameOf.ts";

/**
 * E1002 (rfc:0058): data inside `<script>` or `<style>` runs as code or CSS. Reported through `report(at,
 * message)`: a child that is not literal text (`literalTextOf`), a bound or spread attribute, and literal text
 * that would end the element early (`endsRawText`). Literal text and literal attributes stay allowed: they are
 * the author's code, like any other source. The lowering drops what is reported here.
 */
export function ruleRawText(a: Analysis, report: (at: number, message: string) => void): void {
  for (const j of a.jsx) {
    if (j.type !== "JSXElement") continue;
    const tag = tagNameOf(j.openingElement.name);
    if (!RAW_TEXT_TAGS.has(tag)) continue;
    for (const at of j.openingElement.attributes) {
      if (at.type === "JSXSpreadAttribute") report(at.start, `spread on <${tag}>; give literal attributes only`);
      else if (staticValueOf(at.value) === undefined)
        report(at.start, `bound ${attrNameOf(at.name)} on <${tag}>; give a literal value`);
    }
    const runs = tag === "script" ? "code" : "CSS";
    let text = "";
    for (const c of j.children) {
      const t = literalTextOf(c);
      if (t === null) report(c.start, `data in <${tag}> runs as ${runs}; write literal text`);
      else text += t;
    }
    const end = tag === "script" ? "</script or <!--" : `</${tag}`;
    if (endsRawText(tag, text)) report(j.start, `literal ${end} ends <${tag}> early; remove it`);
  }
}
