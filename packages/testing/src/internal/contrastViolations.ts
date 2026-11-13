import type { Tokens } from "@keel/ui";
import { contrast } from "@keel/ui/css";
import type { ClassMap } from "./ClassMap.ts";
import type { Violation } from "./Violation.ts";
import { inDisabledFieldset } from "./inDisabledFieldset.ts";
import { isHidden } from "./isHidden.ts";
import { px } from "./px.ts";
import { styleIndex } from "./styleIndex.ts";
import { where } from "./where.ts";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SCHEMES = ["light", "dark"] as const;

const ownsText = (el: Element): boolean =>
  Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");

const exempt = (el: Element): boolean => {
  for (let n: Element | null = el; n !== null; n = n.parentElement)
    if (isHidden(n) || n.hasAttribute("disabled") || n.getAttribute("aria-disabled") === "true") return true;
  return inDisabledFieldset(el);
};

/** The token `prop` resolves to on `el` at viewport width `w`: its own winning class, else the nearest ancestor's. */
function tokenAt(map: ClassMap, el: Element, prop: string, w: number): string | undefined {
  const rank = (bp: string | undefined): number =>
    bp === undefined ? 0 : 1 + map.breakpoints.findIndex(([n]) => n === bp);
  const minOf = (bp: string | undefined): number =>
    bp === undefined ? 0 : (map.breakpoints.find(([n]) => n === bp)?.[1] ?? Number.POSITIVE_INFINITY);
  for (let n: Element | null = el; n !== null; n = n.parentElement) {
    let best: { token: string; rank: number } | undefined;
    for (const cls of Array.from(n.classList)) {
      const hit = map.byClass.get(cls);
      if (hit === undefined || hit.prop !== prop || minOf(hit.bp) > w) continue;
      if (best === undefined || rank(hit.bp) >= best.rank) best = { token: hit.token, rank: rank(hit.bp) };
    }
    if (best !== undefined) return best.token;
  }
  return undefined;
}

/**
 * E1804 at render (k.a11y Contrast): every visible, enabled element holding text, per scheme and breakpoint, from
 * its atomic classes and `tokens` (no layout): `fg` its own or inherited, the background the nearest painted
 * ancestor's `bg` (itself included), else `#FFFFFF`; 4.5:1, or 3:1 when large (`fontSize` >= 24px, or >= 18.66px at
 * `weight` >= 700). Text without an `fg` token, or a color that is not hex, is not judged. One violation per element.
 */
export function contrastViolations(root: Element, tokens: Tokens): Violation[] {
  const map = styleIndex(tokens);
  const colors = tokens.color ?? {};
  const widths = [0, ...map.breakpoints.map(([n, w]): number => (Number.isNaN(w) ? 0 : w))];
  const out: Violation[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (!ownsText(el) || exempt(el)) continue;
    const found = widths.flatMap((w, i) =>
      SCHEMES.flatMap((scheme) => {
        const fgTok = tokenAt(map, el, "fg", w);
        if (fgTok === undefined) return [];
        const bgTok = tokenAt(map, el, "bg", w);
        const pick = (t: string | undefined): string => {
          const c = t === undefined ? "#FFFFFF" : colors[t];
          return c === undefined ? "" : typeof c === "string" ? c : c[scheme];
        };
        const fg = pick(fgTok);
        const bg = pick(bgTok);
        if (!HEX.test(fg) || !HEX.test(bg)) return [];
        const sizeTok = tokenAt(map, el, "fontSize", w);
        const weightTok = tokenAt(map, el, "weight", w);
        const size = sizeTok === undefined ? 0 : px(tokens.fontSize?.[sizeTok] ?? "");
        const weight = weightTok === undefined ? 400 : Number(tokens.weight?.[weightTok]);
        const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
        const ratio = contrast(fg, bg);
        if (ratio >= need) return [];
        const bp = i === 0 ? "" : `, ${map.breakpoints[i - 1]?.[0] ?? ""}`;
        const on = bgTok === undefined ? "#FFFFFF" : `bg ${bgTok}`;
        return [`is ${ratio.toFixed(2)}:1, below ${need}:1 (fg ${fgTok} on ${on}, ${scheme}${bp})`];
      }),
    );
    const [help] = found;
    if (help !== undefined) out.push({ rule: "E1804", element: el.id, at: where(el), help });
  }
  return out;
}
