import { schemesOf } from "../css/schemesOf.ts";
import type { ColorValue } from "../types/ColorValue.ts";
import type { Combination } from "../types/Combination.ts";
import type { Scheme } from "../types/Scheme.ts";
import type { Theme } from "../types/Theme.ts";
import type { Tokens } from "../types/Tokens.ts";

const pick = (v: ColorValue, scheme: Scheme): string => (typeof v === "string" ? v : v[scheme]);
const SCALES = ["space", "size", "radius", "font", "fontSize", "weight", "shadow", "border"] as const;

/** One combination's values: the top level at `scheme`, then each theme in `on`, a later value winning. */
function flatten(tokens: Tokens, scheme: Scheme, on: readonly Theme[]): Tokens {
  const color: Record<string, string> = {};
  for (const [n, v] of Object.entries(tokens.color ?? {})) color[n] = pick(v, scheme);
  const overlay: Record<string, { value: string; over: readonly string[] }> = {};
  for (const [n, o] of Object.entries(tokens.overlay ?? {}))
    overlay[n] = { value: pick(o.value, scheme), over: o.over };
  const scales: Record<string, Record<string, string>> = {};
  for (const g of SCALES) scales[g] = { ...(tokens[g] ?? {}) };
  for (const t of on) {
    for (const [n, v] of Object.entries(t.color ?? {})) color[n] = pick(v, scheme);
    for (const [n, v] of Object.entries(t.overlay ?? {})) {
      const o = overlay[n];
      if (o !== undefined) overlay[n] = { value: pick(v, scheme), over: o.over };
    }
    for (const g of SCALES) Object.assign(scales[g] ?? {}, t[g] ?? {});
  }
  const { themes: _themes, schemes: _schemes, ...rest } = tokens;
  const out: Tokens = { ...rest, color, ...scales };
  return tokens.overlay === undefined ? out : { ...out, overlay };
}

/**
 * The app's combinations in order (k.themes Combinations), for tokens `TokenSchema` admits: per scheme in `schemes`
 * order, then printing when there is a `print` theme; within each, no `choice` theme and then each in `themes` order;
 * within each, the `contrast` theme off and then, when there is one, on.
 */
export function combine(tokens: Tokens): Combination[] {
  const themes = Object.entries(tokens.themes ?? {});
  const choice = themes.filter(([, t]) => (t.when ?? "choice") === "choice");
  const hc = themes.find(([, t]) => t.when === "contrast");
  const paper = themes.find(([, t]) => t.when === "print");
  const bases: { name: string; scheme: Scheme; printing: boolean }[] = schemesOf(tokens).map((s) => ({
    name: s,
    scheme: s,
    printing: false,
  }));
  if (paper !== undefined) bases.push({ name: "print", scheme: "light", printing: true });
  const out: Combination[] = [];
  for (const base of bases)
    for (const c of [undefined, ...choice])
      for (const contrast of hc === undefined ? [false] : [false, true]) {
        const on: Theme[] = [];
        const names = [base.name];
        if (c !== undefined) {
          on.push(c[1]);
          names.push(c[0]);
        }
        if (contrast && hc !== undefined) {
          on.push(hc[1]);
          names.push(hc[0]);
        }
        if (base.printing && paper !== undefined) on.push(paper[1]);
        out.push({
          name: names.join("+"),
          tokens: flatten(tokens, base.scheme, on),
          scheme: base.scheme,
          printing: base.printing,
          contrast,
          choice: c?.[0],
        });
      }
  return out;
}
