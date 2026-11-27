// Seed 1337. Properties of k.looks over generated shipped objects: the shipped file read as text, and E1810's count.
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import { readShipped } from "../src/internal/looks/readShipped.ts";

const SEED = 1337;
const part = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);
const program = (source: string) => parseSync("acmeTokens.ts", source, { sourceType: "module", lang: "ts" }).program;
const shipped = (color: readonly (readonly [string, string])[]): string =>
  `import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens({ color: { ${color.map(([n, v]) => `'${n}': '${v}'`).join(", ")} } })\n`;

describe("readShipped", () => {
  it("collects every color name in order, and is in form exactly when each begins `acme.`", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.tuple(fc.boolean(), part), { minLength: 1, maxLength: 6, selector: ([, p]) => p }),
        hex,
        (names, v) => {
          const written = names.map(([own, p]) => (own ? `acme.${p}` : p));
          const r = readShipped(program(shipped(written.map((n) => [n, v]))), "acme");
          expect(r.names.get("color")).toEqual(written);
          const bad = written.find((n) => !n.startsWith("acme."));
          expect(r.problem?.message ?? null).toBe(
            bad === undefined ? null : `acmeTokens names color "${bad}" without acme.`,
          );
        },
      ),
      { seed: SEED, numRuns: 40 },
    );
  });

  it("a spread anywhere among the entries is the problem, and the names around it are still read", () => {
    fc.assert(
      fc.property(fc.uniqueArray(part, { minLength: 1, maxLength: 5 }), fc.nat(), (parts, at) => {
        const entries = parts.map((p) => `'acme.${p}': '#000000'`);
        entries.splice(at % (entries.length + 1), 0, "...other");
        const source = `import { defineTokens } from '@keel/ui'\nexport const acmeTokens = defineTokens({ color: { ${entries.join(", ")} } })\n`;
        const r = readShipped(program(source), "acme");
        expect(r.problem?.message).toBe("acmeTokens.ts holds a spread; it is one defineTokens literal");
        expect(r.names.get("color")).toEqual(parts.map((p) => `acme.${p}`));
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("E1810", () => {
  const files = (tokensSource: string, names: readonly string[]) => [
    {
      path: "modules/shop/module.ts",
      source:
        "import { defineModule } from '@keel/compiler'\nexport default defineModule({ id: 'shop', deps: ['@acme/ui'], capabilities: [] })\n",
    },
    { path: "tokens.ts", source: tokensSource },
    {
      path: "node_modules/@acme/ui/package.json",
      source: JSON.stringify({
        name: "@acme/ui",
        version: "1.0.0",
        type: "module",
        keel: "library",
        exports: { ".": { keel: "./src/index.ts" }, "./tokens": { keel: "./src/acmeTokens.ts" } },
      }),
    },
    {
      path: "node_modules/@acme/ui/module.ts",
      source:
        "import { defineModule } from '@keel/compiler'\nexport default defineModule({ id: 'acme', deps: [], capabilities: [] })\n",
    },
    { path: "node_modules/@acme/ui/src/index.ts", source: "export {}\n" },
    { path: "node_modules/@acme/ui/src/acmeTokens.ts", source: shipped(names.map((n) => [n, "#000000"])) },
  ];

  it("names the first missing color and counts the rest, whichever the app holds", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(part, { minLength: 1, maxLength: 6 }).chain((ps) => fc.tuple(fc.constant(ps), fc.subarray(ps))),
        ([parts, held]) => {
          const names = parts.map((p) => `acme.${p}`);
          const color = Object.fromEntries(held.map((p) => [`acme.${p}`, "#000000"]));
          const d = check(files("export const tokens = {}\n", names), {
            types: false,
            artifacts: { tokens: { color } },
          }).diagnostics.filter((x) => x.code === "E1810");
          const missing = names.filter((n) => !Object.hasOwn(color, n));
          if (missing.length === 0) expect(d).toEqual([]);
          else {
            const more = missing.length > 1 ? ` and ${missing.length - 1} more` : "";
            expect(d.map((x) => x.message)).toEqual([
              `@acme/ui needs color "${missing[0] ?? ""}"${more}; import acmeTokens from @acme/ui/tokens`,
            ]);
          }
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});
