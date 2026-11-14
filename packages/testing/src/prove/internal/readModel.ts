import type { Sexp } from "./Sexp.ts";
import type { Solver } from "./Solver.ts";
import type { Ty } from "./Ty.ts";
import { parseSexp } from "./parseSexp.ts";

/** How many items of one array a counterexample shows at most. */
const MAX_ITEMS = 64;

/**
 * Read the values of `terms` (each of its sort) from a `sat` model as JSON. A string is its literal when the model
 * equals one, else a fresh name (`a`, `b`, ..., `aa`) in order of first appearance, avoiding every literal.
 */
export async function readModel(
  solver: Solver,
  terms: readonly (readonly [Ty, string])[],
  lits: ReadonlyMap<string, string>,
): Promise<unknown[]> {
  const get = async (e: string): Promise<Sexp> => {
    const top = parseSexp(await solver.run(`(get-value (${e}))`));
    const pair = typeof top === "string" ? undefined : top[0];
    return typeof pair === "string" || pair === undefined ? "" : (pair[1] ?? "");
  };
  const names = new Map<string, string>();
  for (const [value, constant] of lits) {
    const atom = JSON.stringify(await get(constant));
    if (!names.has(atom)) names.set(atom, value);
  }
  const taken = new Set(lits.keys());
  let next = 0;
  const fresh = (): string => {
    for (;;) {
      let n = next++;
      let s = "";
      do {
        s = String.fromCharCode(97 + (n % 26)) + s;
        n = Math.floor(n / 26) - 1;
      } while (n >= 0);
      if (!taken.has(s)) return s;
    }
  };
  const number = (x: Sexp): number => {
    if (typeof x === "string") return Number(x);
    const [op, a, b] = x;
    if (op === "-" && a !== undefined) return b === undefined ? -number(a) : number(a) - number(b);
    if (op === "/" && a !== undefined && b !== undefined) return number(a) / number(b);
    return Number.NaN;
  };
  const read = async (t: Ty, e: string): Promise<unknown> => {
    switch (t.k) {
      case "bool":
        return (await get(e)) === "true";
      case "int":
      case "real":
        return number(await get(e));
      case "str": {
        const atom = JSON.stringify(await get(e));
        const name = names.get(atom) ?? fresh();
        names.set(atom, name);
        return name;
      }
      case "obj": {
        const o: Record<string, unknown> = {};
        for (const [i, [k, ft]] of t.f.entries()) {
          const v = await read(ft, `(${t.s}.${i} ${e})`);
          if (v !== undefined) o[k] = v;
        }
        return o;
      }
      case "opt":
        if ((await get(`((_ is ${t.s}.none) ${e})`)) === "true") return t.nul ? null : undefined;
        return read(t.v, `(${t.s}.v ${e})`);
      case "arr": {
        const n = Math.min(number(await get(`(${t.s}.n ${e})`)), MAX_ITEMS);
        const items: unknown[] = [];
        for (let i = 0; i < n; i++) items.push(await read(t.v, `(select (${t.s}.a ${e}) ${i})`));
        return items;
      }
      default:
        return {};
    }
  };
  const values: unknown[] = [];
  for (const [t, e] of terms) values.push(await read(t, e));
  return values;
}
