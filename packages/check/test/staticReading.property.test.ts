// k.contract Static reading: for generated contracts mixing literal entries with spreads, calls, names, computed keys,
// non-literal members and schemas through consts and imports, E1111 is at every part the reader does not read, the
// entries beside it are still read (a marked schema is found), and a literal entry with a clean schema has none;
// never a part neither read nor reported. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { check } from "../src/check.ts";

type Part =
  | { readonly kind: "literal"; readonly api: boolean; readonly path: string; readonly schema: string }
  | { readonly kind: "unread"; readonly source: string };

const MARKED = new Set(["Bad", "BadImported", "s.object({ q: s.string().pii('contact') })"]);
const literal = fc.record({
  kind: fc.constant("literal" as const),
  api: fc.boolean(),
  path: fc.stringMatching(/^[a-z]{1,5}$/).map((w) => `/${w}`),
  schema: fc.constantFrom("", "Local", "Imported", "s.object({ q: s.string() })", ...MARKED),
});
/** A part the reader reports, on its own line: an entry value or a part of the entries with no id. */
const unread = fc
  .constantFrom(
    "'app.c': mk(),",
    "'app.n': E,",
    "'app.s': { ...base, path: '/s' },",
    "'app.k': { [k]: '/k', path: '/c' },",
    "'app.p': { path: P },",
    "'app.b': { path: base + '/x' },",
    "'app.v': { method: verb, path: '/v', output: O },",
    "'app.l': { layout: flag },",
    "'app.ev': { method: 'GET', path: '/e', events: live, output: O },",
    "...more(),",
    "...TABLE,",
    "[k]: { path: '/k' },",
  )
  .map((source) => ({ kind: "unread" as const, source }));
const part: fc.Arbitrary<Part> = fc.oneof({ weight: 2, arbitrary: literal }, unread);

const HEAD = [
  "import { contract } from '@keel/router/contract'",
  "import { s } from '@keel/schema'",
  "import { Imported, BadImported } from './Q.schema.ts'",
  "declare const mk: () => { path: string }",
  "declare const more: () => Record<string, never>",
  "declare const verb: 'GET'",
  "declare const k: string",
  "declare const flag: boolean",
  "declare const live: boolean",
  "const O = s.object({})",
  "const Local = s.object({ q: s.string() })",
  "const Bad = s.object({ q: s.string().pii('contact') })",
  "const P = '/p'",
  "const base = { method: 'GET' } as const",
  "const E = { path: '/e' }",
  "const TABLE = { 'app.t': { path: '/t' } }",
];

function run(parts: readonly Part[], call: boolean) {
  const lines = parts.map((p, i) => {
    if (p.kind === "unread") return `  ${p.source}`;
    const member = p.schema === "" ? "" : `, ${p.api ? "query" : "search"}: ${p.schema}`;
    return p.api
      ? `  'app.e${i}': { method: 'GET', path: '${p.path}'${member}, output: O },`
      : `  'app.e${i}': { path: '${p.path}'${member} },`;
  });
  const source = `${HEAD.join("\n")}\nexport const app = contract('app', ${call ? "mk()" : `{\n${lines.join("\n")}\n}`})\n`;
  const files = [
    {
      path: "modules/app/module.ts",
      source:
        "import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [] } })\n",
    },
    { path: "modules/app/app.contract.ts", source },
    {
      path: "modules/app/Q.schema.ts",
      source:
        "import { s } from '@keel/schema'\nexport const Imported = s.object({ r: s.string() })\nexport const BadImported = s.object({ r: s.string().pii('contact') })\n",
    },
  ];
  const diags = check(files, { types: false }).diagnostics.filter((d) => d.code === "E1111");
  return { diags, first: HEAD.length + 2 };
}

describe("k.contract Static reading, E1111 from check", () => {
  test("E1111 is at every unread part and every marked schema, and on no literal entry with a clean schema", () => {
    fc.assert(
      fc.property(fc.array(part, { maxLength: 7 }), fc.boolean(), (parts, call) => {
        const { diags, first } = run(parts, call);
        if (call) {
          expect(diags.map((d) => [d.line, d.message.startsWith("route table not readable")])).toEqual([
            [first - 1, true],
          ]);
          return;
        }
        parts.forEach((p, i) => {
          const on = diags.filter((d) => d.line === first + i);
          if (p.kind === "unread") expect(on.length, p.source).toBeGreaterThan(0);
          else if (MARKED.has(p.schema)) expect(on.map((d) => d.message.startsWith("personal data"))).toEqual([true]);
          else expect(on).toEqual([]);
        });
        expect(diags.every((d) => d.line >= first && d.line < first + parts.length)).toBe(true);
      }),
      { seed: 1337, numRuns: 60 },
    );
  });
});
