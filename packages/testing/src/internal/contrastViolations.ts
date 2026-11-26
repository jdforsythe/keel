import type { BaseRole, StyleProp, Tokens } from "@keel/ui";
import { type Combination, combinations, composite, contrast } from "@keel/ui/css";
import type { ClassMap } from "./ClassMap.ts";
import type { Violation } from "./Violation.ts";
import { inDisabledFieldset } from "./inDisabledFieldset.ts";
import { px } from "./px.ts";
import { styleIndex } from "./styleIndex.ts";
import { where } from "./where.ts";

/** The ratio of two colors in any k.values form, or undefined when either reads as none (left unjudged). */
const ratioOf = (fg: string, bg: string): number | undefined => {
  try {
    return contrast(fg, bg);
  } catch {
    return undefined;
  }
};
/** An overlay over its backdrop, or `""` (unjudged) when either reads as none. */
const blend = (top: string, under: string): string => {
  try {
    return composite(top, under);
  } catch {
    return "";
  }
};
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

/** The combinations judged at render (k.themes Combinations); tokens `combinations` refuses are judged per scheme as written. */
function combosOf(tokens: Tokens): readonly Combination[] {
  try {
    return combinations(tokens);
  } catch {
    return SCHEMES.map((scheme) => {
      const color: Record<string, string> = {};
      for (const [n, v] of Object.entries(tokens.color ?? {})) color[n] = typeof v === "string" ? v : v[scheme];
      return {
        name: scheme,
        tokens: { ...tokens, color },
        scheme,
        printing: false,
        contrast: false,
        choice: undefined,
      };
    });
  }
}

/** The element of `el`'s chain whose own class paints `bg` with `token`, or undefined. */
function painter(map: ClassMap, el: Element, token: string): Element | undefined {
  for (let n: Element | null = el; n !== null; n = n.parentElement)
    for (const cls of Array.from(n.classList)) {
      const hit = map.byClass.get(cls);
      if (hit?.prop === "bg" && hit.token === token) return n;
    }
  return undefined;
}

/** Whether a combination applies to `el` inside `root`: its closest `data-k-scheme` and `media` class (k.aria Scheme, Print). */
function applies(root: Element, el: Element, c: Combination): boolean {
  const media = el.closest(".k-media-screen, .k-media-print");
  if (media !== null && root.contains(media)) {
    if (media.classList.contains("k-media-screen") && c.printing) return false;
    if (media.classList.contains("k-media-print") && !c.printing) return false;
  }
  const fixed = el.closest("[data-k-scheme]");
  if (fixed === null || !root.contains(fixed) || c.printing) return true;
  return fixed.getAttribute("data-k-scheme") === c.scheme;
}

/**
 * E1804 at render (k.a11y Contrast): every visible, enabled element holding text, per combination (k.themes; its
 * closest `data-k-scheme` and `media` class choose which apply) and breakpoint, from
 * its atomic classes, its role's `base` set and `tokens` (no layout): `fg` its own or inherited, the background the
 * nearest painted ancestor's `bg` (itself included), else `base.page`'s, else `#FFFFFF`; text without an `fg` takes
 * `base.page`'s, else `#000000` in both schemes (the user agent's default text). 4.5:1, or 3:1 when large
 * (`fontSize` >= 24px, or >= 18.66px at `weight` >= 700). Text under `hidden` or disabled is exempt; `aria-hidden`
 * text is visible and judged. Under the `contrast` theme text needs 7:1, or 4.5:1 when large. A `bg` overlay is
 * composited over the background painted under it, an `fg` overlay over the `bg`. A value no color form reads is not
 * judged. One violation per element.
 */
export function contrastViolations(root: Element, tokens: Tokens): Violation[] {
  const map = styleIndex(tokens);
  const combos = combosOf(tokens);
  const out: Violation[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (!ownsText(el) || exempt(el)) continue;
    let help: string | undefined;
    for (let at = 0; at <= map.breakpoints.length && help === undefined; at++)
      for (const c of combos) {
        if (!applies(root, el, c)) continue;
        const colors = c.tokens.color ?? {};
        const overlays = c.tokens.overlay ?? {};
        const pick = (t: string | undefined, none: string): string => {
          const v = t === undefined ? none : (colors[t] ?? overlays[t]?.value);
          return typeof v === "string" ? v : "";
        };
        const fgTok = tokenAt(map, tokens, el, "fg", at);
        const bgTok = tokenAt(map, tokens, el, "bg", at);
        let bg = pick(bgTok, "#FFFFFF");
        // A `bg` overlay is composited over the background painted under the element that paints it.
        if (bgTok !== undefined && overlays[bgTok] !== undefined) {
          const holder = painter(map, el, bgTok)?.parentElement ?? null;
          const under = holder === null ? undefined : tokenAt(map, tokens, holder, "bg", at);
          const base = under !== undefined && overlays[under] !== undefined ? "" : pick(under, "#FFFFFF");
          bg = blend(bg, base);
        }
        let fg = pick(fgTok, "#000000");
        if (fgTok !== undefined && overlays[fgTok] !== undefined) fg = blend(fg, bg);
        const sizeTok = tokenAt(map, tokens, el, "fontSize", at);
        const weightTok = tokenAt(map, tokens, el, "weight", at);
        const size = px(sizeTok === undefined ? "" : (tokens.fontSize?.[sizeTok] ?? ""));
        const weight = Number(weightTok === undefined ? 400 : tokens.weight?.[weightTok]);
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const need = c.contrast ? (large ? 4.5 : 7) : large ? 3 : 4.5;
        const ratio = ratioOf(fg, bg);
        if (ratio !== undefined && ratio < need) {
          help = `is ${ratio.toFixed(2)}:1, below ${need}:1 (fg ${fgTok ?? fg} on ${bgTok ?? bg}, ${c.name})`;
          break;
        }
      }
    if (help !== undefined) out.push({ rule: "E1804", element: el.id, at: where(el), help });
  }
  return out;
}
