// k.contract Static reading: for generated contracts mixing literal entries with spreads, calls, names, computed keys,
// non-literal members and schemas through consts and imports, `routeLiterals` reads every entry with exactly its
// literal `method` and `path`, or names it in `unread` (W1005); never neither. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { routeLiterals } from "../src/routeLiterals.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

/** An entry of a generated contract: written out literally, or with one part the readers do not read. */
type Part =
  | {
      readonly kind: "literal";
      readonly api: boolean;
      readonly method: string;
      readonly path: string;
      readonly schema: string;
    }
  | { readonly kind: "unread"; readonly source: string }
  | { readonly kind: "gap"; readonly source: string };

const word = fc.stringMatching(/^[a-z]{1,5}$/);
const SCHEMAS = ["", "Local", "Imported", "s.object({ q: s.string() })", "wrap(s.object({}))"];
const literal = fc.record({
  kind: fc.constant("literal" as const),
  api: fc.boolean(),
  method: fc.constantFrom("GET", "POST", "PUT", "DELETE"),
  path: word.map((w) => `/${w}`),
  schema: fc.constantFrom(...SCHEMAS),
});
/** An entry value (for a key) the readers report: a call, a name, a spread, a computed key, a non-literal member. */
const unreadEntry = fc
  .constantFrom(
    "mk()",
    "E",
    "{ ...base, path: '/s' }",
    "{ [k]: '/k', path: '/c' }",
    "{ path: P }",
    "{ path: base + '/x' }",
    "{ path: `/t/${x}` }",
    "{ method: verb, path: '/v', output: O }",
    "{ method: 'GET', path, output: O }",
    "{ layout: flag }",
    "{ method: 'GET', path: '/e', events: live, output: O }",
  )
  .map((source) => ({ kind: "unread" as const, source }));
/** A part of the entries with no id the readers report: a spread or a computed key. */
const gap = fc
  .constantFrom("...more()", "...TABLE", "...imported", "[k]: { path: '/k' }")
  .map((source) => ({ kind: "gap" as const, source }));
const part: fc.Arbitrary<Part> = fc.oneof({ weight: 3, arbitrary: literal }, unreadEntry, gap);

const C = "modules/m/m.contract.ts";
const PRE = [
  'import { contract } from "@keel/router/contract";',
  'import { s } from "@keel/schema";',
  'import { Imported, imported } from "./Imported.schema.ts";',
  "declare const mk: () => { path: string };",
  "declare const more: () => Record<string, never>;",
  "declare const wrap: <T>(t: T) => T;",
  "declare const verb: 'GET';",
  "declare const k: string;",
  "declare const x: string;",
  "declare const flag: boolean;",
  "declare const live: boolean;",
  "const O = s.object({});",
  "const Local = s.object({ q: s.string() });",
  "const P = '/p';",
  "const path = '/n';",
  "const base = { method: 'GET' } as const;",
  "const E = { path: '/e' };",
  "const TABLE = { 'm.t': { path: '/t' } };",
].join("\n");

/** The project of `parts`, entry `i` keyed `m.e<i>`, each part on its own line; with `call`, the entries a call. */
function project(parts: readonly Part[], call: boolean): SourceFile[] {
  const lines = parts.map((p, i) => {
    if (p.kind === "gap") return `  ${p.source},`;
    if (p.kind === "unread") return `  "m.e${i}": ${p.source},`;
    const member = p.schema === "" ? "" : `, ${p.api ? "query" : "search"}: ${p.schema}`;
    return p.api
      ? `  "m.e${i}": { method: "${p.method}", path: "${p.path}"${member}, output: O },`
      : `  "m.e${i}": { path: "${p.path}"${member} },`;
  });
  const entries = call ? "mk()" : `{\n${lines.join("\n")}\n}`;
  return [
    {
      path: "modules/m/module.ts",
      source:
        "import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: [], capabilities: [], public: { exports: [] } })\n",
    },
    { path: C, source: `${PRE}\nexport const m = contract("m", ${entries});\n` },
    {
      path: "modules/m/Imported.schema.ts",
      source:
        'import { s } from "@keel/schema";\nexport const Imported = s.object({ r: s.string() });\nexport const imported = { "m.i": { path: "/i" } };\n',
    },
    {
      path: "modules/m/routes.ts",
      source:
        'import { manifest } from "@keel/router";\nimport { m } from "./m.contract.ts";\nexport const routes = manifest(m, {});\n',
    },
  ];
}

describe("k.contract Static reading, the compiler's reading", () => {
  test("every entry is read with exactly its literal method and path, or named unread; every gap is named", () => {
    fc.assert(
      fc.property(fc.array(part, { maxLength: 8 }), fc.boolean(), (parts, call) => {
        const r = routeLiterals(project(parts, call));
        expect(r).toBeDefined();
        if (r === undefined) return;
        const names = (id: string) => r.unread.some((u) => u === id || u.startsWith(`${id} `));
        if (call) {
          expect(r.unread).toEqual([`${C} mk()`]);
          expect(r.routes).toEqual({});
          return;
        }
        parts.forEach((p, i) => {
          const id = `m.e${i}`;
          if (p.kind === "gap")
            expect(r.unread.some((u) => u.endsWith(p.source) || (p.source.startsWith("[") && u === `${C} ids`))).toBe(
              true,
            );
          else if (p.kind === "unread") expect(names(id), p.source).toBe(true);
          else if (!names(id)) {
            const want = p.api ? { path: p.path, method: p.method, api: true } : { path: p.path };
            expect(r.routes[id]).toMatchObject({ ...want, search: p.schema !== "" });
          }
        });
        // Nothing beyond the generated ids is read, and the id set is closed only when nothing is unread.
        expect(Object.keys(r.routes).every((id) => /^m\.e\d+$/.test(id))).toBe(true);
        expect(r.closed).toBe(r.unread.length === 0);
        // A literal entry is reported only when a gap of the entries comes after it (it may override it).
        parts.forEach((p, i) => {
          if (p.kind === "literal" && names(`m.e${i}`))
            expect(parts.slice(i + 1).some((q) => q.kind === "gap")).toBe(true);
        });
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
