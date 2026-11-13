// serverOnlyCalls (E1558, k.topology Rules): server-only route work in a module a `client` or `static` deployable
// serves, at the call. Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { serverOnlyCalls } from "../src/serverOnlyCalls.ts";
import type { Topology } from "../src/types/Topology.ts";

const SEED = 1337;
const HEAD = "import { action, loader } from '@keel/router'\nimport { ok, s } from '@keel/schema'\n";
const CALLS = {
  loaderStores: { flagged: true, src: "loader({ output: s.object({}), stores: () => ({}) }, async () => ok({}))" },
  actionStores: { flagged: true, src: "action({ input: s.object({}), 'stores': () => ({}) }, async () => ok(null))" },
  live: { flagged: true, src: "loader({ output: s.object({}) }, async function* () {\n  yield ok({})\n})" },
  plain: { flagged: false, src: "loader({ output: s.object({}) }, async () => ok({}))" },
  plainAction: { flagged: false, src: "action({ input: s.object({}) }, async () => ok(null))" },
  syncGenerator: { flagged: false, src: "loader({ output: s.object({}) }, function* () {})" },
  computed: { flagged: false, src: "loader({ output: s.object({}), ['stores']: () => ({}) }, async () => ok({}))" },
  spread: { flagged: false, src: "loader({ output: s.object({}), ...extra }, async () => ok({}))" },
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
          const source = `${HEAD}const extra = {}\n${body}`;
          const found = serverOnlyCalls([{ path: "modules/a/a.server.ts", source }], topo(adapter));
          const want = adapter === "node" ? 0 : kinds.filter((k) => CALLS[k].flagged).length;
          expect(found).toHaveLength(want);
          for (const d of found) {
            expect(d).toMatchObject({ code: "E1558", path: "modules/a/a.server.ts", see: "k.topology" });
            expect(source.split("\n")[d.line - 1]?.slice(d.col - 1)).toMatch(/^(loader|action)\(/);
            expect(d.message).toMatch(
              new RegExp(
                `^${adapter} deployable web: (loader|action) (names stores|is live); serve module a from a node deployable$`,
              ),
            );
          }
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  test("reads only *.server.ts(x) under the module's folder, names imported from @keel/router, aliases included", () => {
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
    const aliased = `import { loader as l } from '@keel/router'\nexport const L = l({ stores: () => ({}) }, async () => 1)\n`;
    expect(serverOnlyCalls([{ path: "modules/a/deep/x.server.tsx", source: aliased }], t)).toEqual([
      expect.objectContaining({ code: "E1558", line: 2, col: 18 }),
    ]);
  });
});
