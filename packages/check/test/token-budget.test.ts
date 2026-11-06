// Seed 1337
// OUTPUT.md budget: `keel check` with 10 injected errors <= 600 tokens (chars/4), compact mode.
import fc from "fast-check";
import { expect, it } from "vitest";
import { check, format } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";

const NOW = ["Date", "now"].join(".");
const tokens = (s: string): number => Math.ceil(s.length / 4);

/** Ten files, each with one injected error from a different rule family (fix-bearing ones included). */
const INJECTED: SourceFile[] = [
  {
    path: "src/cart/total.ts",
    source: `export function total(n: number) {\n  if (n < 0) throw new Error("neg")\n  return n\n}\n`,
  },
  {
    path: "src/cart/load.ts",
    source: "export function load() {\n  try {\n    return 1\n  } catch (e) {\n    return 2\n  }\n}\n",
  },
  { path: "src/cart/stamp.ts", source: `export const stamp = () => ${NOW}()\n` },
  { path: "src/cart/Badge.tsx", source: "export default function Badge() {\n  return <span>new</span>\n}\n" },
  {
    path: "src/cart/List.tsx",
    source: "export default function List(props) {\n  return <ul>{props.open && <li>x</li>}</ul>\n}\n",
  },
  { path: "src/cart/Name.tsx", source: "export default function Name({ name }) {\n  return <p>{name}</p>\n}\n" },
  { path: "src/cart/count.ts", source: 'export const count: number = "three"\n' },
  { path: "src/cart/pair.ts", source: "export const pair = 1\nexport const other = 2\n" },
  {
    path: "src/cart/Field.tsx",
    source: "import { Input } from '@keel/ui'\nexport default function Field() {\n  return <Input />\n}\n",
  },
  { path: "test/cart.test.ts", source: "const el = document.querySelector('#total')\nvoid el\n" },
];

it("compact output for 10 injected errors stays within 600 tokens", () => {
  const { diagnostics } = check(INJECTED, {});
  expect(new Set(diagnostics.map((d) => d.path)).size).toBe(10);
  const out = format(diagnostics, { mode: "compact" });
  expect(tokens(out)).toBeLessThanOrEqual(600);
});

it("any 10-file subset of repeated injections stays within 600 tokens", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: INJECTED.length - 1 }), { minLength: 10, maxLength: 10 }),
      (picks) => {
        const files = picks.map((p, i) => {
          const src = INJECTED[p] ?? { path: "x.ts", source: "" };
          return { path: src.path.replace(/(\.[a-z]+)$/, `${i}$1`), source: src.source };
        });
        expect(tokens(format(check(files, {}).diagnostics, { mode: "compact" }))).toBeLessThanOrEqual(600);
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});
