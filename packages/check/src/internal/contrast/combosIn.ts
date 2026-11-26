import { type Theme, TokenSchema, type Tokens } from "@keel/ui";
import { combinations } from "@keel/ui/css";
import type { Combo } from "./Combo.ts";

const memo = new WeakMap<object, Map<string, readonly Combo[]>>();
const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** Tokens `TokenSchema` refuses are judged in both schemes as written, a pair's value per scheme, and no theme. */
const fallback = (tokens: unknown): readonly Combo[] =>
  (["light", "dark"] as const).map((scheme) => ({
    name: scheme,
    tokens,
    contrast: false,
    printing: false,
    scheme,
    layers: [],
  }));

/** The tokens judged in a library's own folder: its schemes, and its shipped `contrast` and `print` in place of the root's. */
function own(
  t: Tokens,
  schemes: readonly ("light" | "dark")[] | undefined,
  themes: Readonly<Record<string, Theme>> | undefined,
): Tokens {
  if (schemes === undefined && themes === undefined) return t;
  const whens = new Set(Object.values(themes ?? {}).map((x) => x.when));
  const kept = Object.entries(t.themes ?? {}).filter(([, x]) => !whens.has(x.when ?? "choice"));
  const merged = { ...Object.fromEntries(kept), ...(themes ?? {}) };
  return {
    ...t,
    ...(schemes === undefined ? {} : { schemes }),
    ...(Object.keys(merged).length === 0 ? {} : { themes: merged }),
  };
}

/**
 * The combinations contrast is judged in (k.themes Combinations, `combinations` from `@keel/ui/css`), each with its
 * flat values and the themes on; in a library's own folder, with its own schemes and shipped `contrast` and `print`
 * themes (k.themes Library themes). Tokens `TokenSchema` refuses are judged in `light` and `dark` as written.
 * Memoized per tokens object.
 */
export function combosIn(
  tokens: unknown,
  schemes?: readonly ("light" | "dark")[],
  themes?: Readonly<Record<string, Theme>>,
): readonly Combo[] {
  if (!isRec(tokens)) return fallback(tokens);
  const key = JSON.stringify([schemes ?? null, themes ?? null]);
  const hit = memo.get(tokens)?.get(key);
  if (hit !== undefined) return hit;
  const parsed = TokenSchema.parse(tokens);
  let out: readonly Combo[];
  if (!parsed.ok) out = fallback(tokens);
  else {
    const t = own(parsed.value, schemes, themes);
    const all = Object.entries(t.themes ?? {});
    const hc = all.find(([, x]) => x.when === "contrast")?.[0];
    const paper = all.find(([, x]) => x.when === "print")?.[0];
    try {
      out = combinations(t).map((c) => ({
        name: c.name,
        tokens: c.tokens,
        contrast: c.contrast,
        printing: c.printing,
        scheme: c.scheme,
        layers: [
          ...(c.choice === undefined ? [] : [c.choice]),
          ...(c.contrast && hc !== undefined ? [hc] : []),
          ...(c.printing && paper !== undefined ? [paper] : []),
        ],
      }));
    } catch {
      out = fallback(tokens);
    }
  }
  const per = memo.get(tokens) ?? new Map<string, readonly Combo[]>();
  per.set(key, out);
  memo.set(tokens, per);
  return out;
}
