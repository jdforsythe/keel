import type { Shipped } from "./Shipped.ts";
import type { ThemeGap } from "./ThemeGap.ts";

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * For each of the app's themes whose `when` is `contrast` or `print` (`themes` the evaluated `themes` of the tokens,
 * in order written), the names the shipped theme of that key holds per group that the app's theme does not hold in
 * the same group, in the shipped order. An app with no such theme is asked for nothing; a theme missing nothing is
 * not listed.
 */
export function themeGaps(shipped: Shipped, themes: unknown): ThemeGap[] {
  const out: ThemeGap[] = [];
  if (!isRec(themes)) return out;
  for (const [theme, value] of Object.entries(themes)) {
    const when = isRec(value) ? value.when : undefined;
    if (when !== "contrast" && when !== "print") continue;
    const held = shipped.themes.get(when);
    if (held === undefined || !isRec(value)) continue;
    const missing: [string, string][] = [];
    for (const [group, names] of held) {
      const have = value[group];
      for (const n of names) if (!isRec(have) || !Object.hasOwn(have, n)) missing.push([group, n]);
    }
    if (missing.length > 0) out.push({ theme, key: when, missing });
  }
  return out;
}
