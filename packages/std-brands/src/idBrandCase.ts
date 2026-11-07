import { defineRule } from "@keel/check";
import type { RuleDef } from "@keel/check";
import { brandLiterals } from "./internal/brandLiterals.ts";
import { lineCol } from "./internal/lineCol.ts";
import { pascalCase } from "./internal/pascalCase.ts";

const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const LETTER_LED = /^[A-Za-z]/;
const clip = (s: string): string => (s.length > 24 ? `${s.slice(0, 21)}...` : s);

/**
 * E2101 (std.brands, k.check registry): an `s.id` or `ctx.random.id` brand literal that is not PascalCase. The
 * finding sits at the literal; `fix` rewrites it to its PascalCase form in the same quotes, when one exists.
 */
export const idBrandCase: RuleDef = defineRule({
  code: "E2101",
  see: "std.brands",
  message: (f) => {
    const brand = String(f.data?.brand ?? "");
    const fixed = String(f.data?.fixed ?? "");
    const base = `id brand '${clip(brand)}' is not PascalCase`;
    return fixed === "" ? base : `${base}; use '${clip(fixed)}'`;
  },
  explain:
    "id brand literal not PascalCase. A brand is a type name: s.id('order') and ctx.random.id('Order') are " +
    "different Id types. Fix: s.id('order_line') -> s.id('OrderLine').",
  check: ({ file, ast }) =>
    brandLiterals(ast, file.source)
      .filter((b) => !PASCAL.test(b.value))
      .map((b) => {
        const p = pascalCase(b.value);
        const fixed = LETTER_LED.test(p) ? p : "";
        return {
          path: file.path,
          ...lineCol(file.source, b.start),
          data: { brand: b.value, fixed, quote: b.quote, start: b.start, end: b.end },
        };
      }),
  fix: (f) => {
    const d = f.data;
    const fixed = d?.fixed;
    const start = d?.start;
    const end = d?.end;
    const quote = d?.quote;
    if (typeof fixed !== "string" || fixed === "" || typeof start !== "number" || typeof end !== "number") return null;
    const q = typeof quote === "string" ? quote : "'";
    return [{ start, end, text: `${q}${fixed}${q}` }];
  },
});
