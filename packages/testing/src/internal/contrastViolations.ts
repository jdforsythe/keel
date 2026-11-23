import type { BaseRole, StyleProp, Tokens } from "@keel/ui";
import { contrast } from "@keel/ui/css";
import type { ClassMap } from "./ClassMap.ts";
import type { Violation } from "./Violation.ts";
import { inDisabledFieldset } from "./inDisabledFieldset.ts";
import { px } from "./px.ts";
import { styleIndex } from "./styleIndex.ts";
import { where } from "./where.ts";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SCHEMES = ["light", "dark"] as const;

const ownsText = (el: Element): boolean =>
  Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");

const exempt = (el: Element): boolean => {
  for (let n: Element | null = el; n !== null; n = n.parentElement)
    if (n.hasAttribute("hidden") || n.hasAttribute("disabled") || n.getAttribute("aria-disabled") === "true")
      return true;
  return inDisabledFieldset(el);
};

/** Role class -> `base` role (k.ui Base); `body`'s `page` set is what no element of the page sets. */
const ROLES: Readonly<Record<string, BaseRole>> = {
  "k-heading": "heading",
  "k-link": "link",
  "k-button": "button",
  "k-control": "control",
  "k-label": "label",
  "k-error": "fieldError",
  "k-summary": "summary",
};

/**
 * The token `prop` resolves to on `el` at the breakpoint index `at` (0 base, i + 1 breakpoint i): its own winning
 * class, else its role's `base` set (an atomic rule outranks the `keel.base` layer), else the nearest ancestor's, else
 * `base.page`'s. A value of breakpoint j applies when j's min-width is at most `at`'s; a later breakpoint in token
 * order wins, as its `min-width` block comes later in the CSS.
 */
function tokenAt(map: ClassMap, tokens: Tokens, el: Element, prop: StyleProp, at: number): string | undefined {
  const width = (i: number): number => map.breakpoints[i - 1]?.[1] ?? 0;
  const rankOf = (bp: string | undefined): number =>
    bp === undefined || bp === "base" ? 0 : 1 + map.breakpoints.findIndex(([b]) => b === bp);
  const fromSet = (role: BaseRole): string | undefined => {
    const v = tokens.base?.[role]?.[prop];
    if (typeof v === "string" || v === undefined) return v;
    let best: [string, number] | undefined;
    for (const [bp, token] of Object.entries(v)) {
      const rank = rankOf(bp);
      if (width(rank) <= width(at) && rank >= (best?.[1] ?? 0)) best = [token, rank];
    }
    return best?.[0];
  };
  for (let n: Element | null = el; n !== null; n = n.parentElement) {
    let best: [string, number] | undefined;
    for (const cls of Array.from(n.classList)) {
      const hit = map.byClass.get(cls);
      const rank = rankOf(hit?.bp);
      if (hit?.prop === prop && width(rank) <= width(at) && rank >= (best?.[1] ?? 0)) best = [hit.token, rank];
    }
    if (best !== undefined) return best[0];
    for (const cls of Array.from(n.classList)) {
      const role = ROLES[cls];
      const own = role === undefined ? undefined : fromSet(role);
      if (own !== undefined) return own;
    }
  }
  return fromSet("page");
}

/**
 * E1804 at render (k.a11y Contrast): every visible, enabled element holding text, per scheme and breakpoint, from
 * its atomic classes, its role's `base` set and `tokens` (no layout): `fg` its own or inherited, the background the
 * nearest painted ancestor's `bg` (itself included), else `base.page`'s, else `#FFFFFF`; text without an `fg` takes
 * `base.page`'s, else `#000000` in both schemes (the user agent's default text). 4.5:1, or 3:1 when large
 * (`fontSize` >= 24px, or >= 18.66px at `weight` >= 700). Text under `hidden` or disabled is exempt; `aria-hidden`
 * text is visible and judged. A color that is not hex is not judged. One violation per element.
 */
export function contrastViolations(root: Element, tokens: Tokens): Violation[] {
  const map = styleIndex(tokens);
  const colors = tokens.color ?? {};
  const out: Violation[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (!ownsText(el) || exempt(el)) continue;
    let help: string | undefined;
    for (let at = 0; at <= map.breakpoints.length && help === undefined; at++)
      for (const scheme of SCHEMES) {
        const fgTok = tokenAt(map, tokens, el, "fg", at);
        const bgTok = tokenAt(map, tokens, el, "bg", at);
        const pick = (t: string | undefined, none: string): string => {
          const c = t === undefined ? none : colors[t];
          return c === undefined || typeof c === "string" ? (c ?? "") : c[scheme];
        };
        const fg = pick(fgTok, "#000000");
        const bg = pick(bgTok, "#FFFFFF");
        if (!HEX.test(fg) || !HEX.test(bg)) continue;
        const sizeTok = tokenAt(map, tokens, el, "fontSize", at);
        const weightTok = tokenAt(map, tokens, el, "weight", at);
        const size = px(sizeTok === undefined ? "" : (tokens.fontSize?.[sizeTok] ?? ""));
        const weight = Number(weightTok === undefined ? 400 : tokens.weight?.[weightTok]);
        const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
        const ratio = contrast(fg, bg);
        if (ratio < need) {
          help = `is ${ratio.toFixed(2)}:1, below ${need}:1 (fg ${fgTok ?? fg} on ${bgTok ?? bg}, ${scheme})`;
          break;
        }
      }
    if (help !== undefined) out.push({ rule: "E1804", element: el.id, at: where(el), help });
  }
  return out;
}
