// serverOnlyCalls (E1558, k.topology Rules): server-only route work in a module a `client` or `static` deployable
// serves, at the call. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { serverOnlyCalls } from "../src/serverOnlyCalls.ts";
import type { Topology } from "../src/types/Topology.ts";

const SEED = 1337;
const HEAD =
  "import { action, loader } from '@keel/router'\nimport * as r from '@keel/router'\nimport { ok, s } from '@keel/schema'\nimport { load } from './load'\n";
const LOCALS =
  "const extra = {}\nexport async function* feed() {}\nconst stream = async function* () {}\nasync function plain() {}\nconst arrow = async () => ok({})\n";
// why: what the message says, or null for no finding.
const CALLS = {
  loaderStores: {
    why: "names stores; serve module a from a node deployable",
    src: "loader({ output: s.object({}), stores: () => ({}) }, async () => ok({}))",
  },
  actionStores: {
    why: "names stores; serve module a from a node deployable",
    src: "action({ input: s.object({}), 'stores': () => ({}) }, async () => ok(null))",
  },
  live: {
    why: "is live; serve module a from a node deployable",
    src: "loader({ output: s.object({}) }, async function* () {\n  yield ok({})\n})",
  },
  plain: { why: null, src: "loader({ output: s.object({}) }, async () => ok({}))" },
  plainAction: { why: null, src: "action({ input: s.object({}) }, async () => ok(null))" },
  actionNamedFn: { why: null, src: "action({ input: s.object({}) }, load)" },
  syncGenerator: { why: null, src: "loader({ output: s.object({}) }, function* () {})" },
  namedGenerator: {
    why: "is live; serve module a from a node deployable",
    src: "loader({ output: s.object({}) }, feed)",
  },
  namedConstGenerator: {
    why: "is live; serve module a from a node deployable",
    src: "loader({ output: s.object({}) }, stream)",
  },
  namedPlain: { why: null, src: "loader({ output: s.object({}) }, plain)" },
  namedArrow: { why: null, src: "loader({ output: s.object({}) }, arrow)" },
  namespaceStores: {
    why: "names stores; serve module a from a node deployable",
    src: "r.loader({ output: s.object({}), stores: () => ({}) }, async () => ok({}))",
  },
  namespacePlain: { why: null, src: "r.action({ input: s.object({}) }, async () => ok(null))" },
  computed: {
    why: "options spread or computed; write an object literal",
    src: "loader({ output: s.object({}), ['stores']: () => ({}) }, async () => ok({}))",
  },
  spread: {
    why: "options spread or computed; write an object literal",
    src: "loader({ output: s.object({}), ...extra }, async () => ok({}))",
  },
  optionsIdentifier: {
    why: "options not an object literal; write one inline",
    src: "action(extra, async () => ok(null))",
  },
  optionsCall: {
    why: "options not an object literal; write one inline",
    src: "loader(Object.assign({}, extra), async () => ok({}))",
  },
  spreadArgument: { why: "options not an object literal; write one inline", src: "loader(...[extra, plain])" },
  importedFn: { why: "fn not a function of this file; define it here", src: "loader({ output: s.object({}) }, load)" },
  calledFn: { why: "fn not a function of this file; define it here", src: "loader({ output: s.object({}) }, make())" },
} as const;
type Kind = keyof typeof CALLS;
const KINDS = Object.keys(CALLS).filter((k): k is Kind => k in CALLS);
const topo = (adapter: "client" | "static" | "node"): Topology => ({ web: { modules: ["a"], adapter } });

describe("serverOnlyCalls", () => {
  test("one E1558 per flagged call in a client or static module, at the call; none in a node module", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...KINDS), { maxLength: 6 }),
        fc.constantFrom<"client" | "static" | "node">("client", "static", "node"),
        (kinds, adapter) => {
          const body = kinds.map((k, i) => `export const X${i} = ${CALLS[k].src}\n`).join("");
          const source = `${HEAD}${LOCALS}${body}`;
          const found = serverOnlyCalls([{ path: "modules/a/a.server.ts", source }], topo(adapter));
          const want = adapter === "node" ? [] : kinds.flatMap((k) => (CALLS[k].why === null ? [] : [CALLS[k].why]));
          expect(found.map((d) => d.message.replace(/^\w+ deployable web: (loader|action) /, ""))).toEqual(want);
          for (const d of found) {
            expect(d).toMatchObject({ code: "E1558", path: "modules/a/a.server.ts", see: "k.topology" });
            expect(source.split("\n")[d.line - 1]?.slice(d.col - 1)).toMatch(/^(r\.)?(loader|action)\(/);
            expect(d.message).toMatch(new RegExp(`^${adapter} deployable web: (loader|action) `));
            expect(d.message.length).toBeLessThan(90);
          }
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  test("reads only *.server.ts(x) under the module's folder, calls of loader and action from @keel/router, renamed imports included", () => {
    const t = topo("client");
    const call = CALLS.loaderStores.src;
    expect(serverOnlyCalls([{ path: "modules/a/a.ts", source: `${HEAD}export const L = ${call}` }], t)).toEqual([]);
    expect(serverOnlyCalls([{ path: "modules/b/b.server.ts", source: `${HEAD}export const L = ${call}` }], t)).toEqual(
      [],
    );
    const local = "const loader = (o: unknown, f: unknown) => [o, f]\nexport const L = loader({ stores: 1 }, 2)\n";
    expect(serverOnlyCalls([{ path: "modules/a/a.server.ts", source: local }], t)).toEqual([]);
    const typeOnly = `import type { loader } from '@keel/router'\ndeclare const f: typeof loader\nexport const L = f({ stores: 1 }, 2)\n`;
    expect(serverOnlyCalls([{ path: "modules/a/a.server.ts", source: typeOnly }], t)).toEqual([]);
    const helper =
      "import { loader } from '@keel/router'\nconst withStores = (o: object) => ({ ...o, stores: () => ({}) })\nexport const L = loader(withStores({}), async () => 1)\n";
    expect(serverOnlyCalls([{ path: "modules/a/a.server.ts", source: helper }], t)).toEqual([
      expect.objectContaining({ code: "E1558", line: 3, col: 18 }),
    ]);
    const alias =
      "import { loader } from '@keel/router'\nconst l = loader\nexport const L = l({ stores: 1 }, async () => 1)\n";
    expect(serverOnlyCalls([{ path: "modules/a/a.server.ts", source: alias }], t)).toEqual([]);
    const aliased = `import { loader as l } from '@keel/router'\nexport const L = l({ stores: () => ({}) }, async () => 1)\n`;
    expect(serverOnlyCalls([{ path: "modules/a/deep/x.server.tsx", source: aliased }], t)).toEqual([
      expect.objectContaining({ code: "E1558", line: 2, col: 18 }),
    ]);
  });
});
