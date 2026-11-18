// The static reads of the caller option and the identity source (k.user Rules: E1578, E1579). Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { callerDays } from "../src/hosting/callerDays.ts";
import { identityDiags } from "../src/hosting/identityDiags.ts";
import { identitySource } from "../src/hosting/identitySource.ts";
import { topologyReadProblems } from "../src/hosting/topologyReadProblems.ts";

const topo = (body: string) => `import { topology } from '@keel/server'\nexport default topology({ ${body} })\n`;
const e1578 = (src: string) => topologyReadProblems(src).filter(([code]) => code === "E1578");

describe("callerDays", () => {
  it("reads each deployable's caller days and adapter, and skips deployables without caller", () => {
    expect(
      callerDays(
        topo(
          "web: { modules: ['a'], adapter: 'node', caller: { days: 30 } }, app: { modules: ['b'], adapter: 'client' }",
        ),
      ),
    ).toEqual([["web", "node", 30]]);
    expect(callerDays(topo("'web-1': { modules: ['a'], adapter: 'node', caller: { days: n } }"))[0]?.[2]).toBeNaN();
    expect(callerDays("export default {}\n")).toEqual([]);
  });

  it("E1578 holds exactly when days is not an integer 1 to 400 or the deployable is not node", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -5, max: 500 }), fc.double({ min: 0, max: 500, noNaN: true })),
        fc.constantFrom("node", "client", "static"),
        (days, adapter) => {
          const good = adapter === "node" && Number.isInteger(days) && days >= 1 && days <= 400;
          const src = topo(`web: { modules: ['a'], adapter: '${adapter}', caller: { days: ${String(days)} } }`);
          expect(e1578(src)).toHaveLength(good ? 0 : 1);
        },
      ),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("identitySource", () => {
  const src = (p: string) =>
    `import { identity } from '@keel/server'\nexport default identity({ identify: async () => '', handle: { path: '${p}', fn: () => new Response('') } })\n`;

  it("gives the handle path of lowercase segments and a problem for any other", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z0-9-]{1,6}$/), { minLength: 1, maxLength: 3 }), (segs) => {
        const p = `/${segs.join("/")}`;
        expect(identitySource(src(p))).toEqual({ path: p });
        if (p !== p.toUpperCase()) expect(identitySource(src(p.toUpperCase())).problem ?? "").toMatch(/lowercase/);
        expect(identitySource(src(`${p}/`)).problem).toBeDefined();
      }),
      { seed: 1337, numRuns: 30 },
    );
  });

  it("needs a default identity(...) call, and reads no path from a non-literal", () => {
    expect(identitySource("export const x = 1\n").problem).toBeDefined();
    expect(identitySource("export default other({ identify })\n").problem).toBeDefined();
    expect(identitySource("export default identity(...opts)\n").problem).toBeDefined();
    expect(identitySource("export default identity({ identify, handle: { path: p, fn } })\n")).toEqual({});
  });

  it("identityDiags names each route at or under the path, and the file's own problem only when asked", () => {
    const files = [
      { path: "identity.server.ts", source: src("/auth") },
      {
        path: "modules/a/routes.ts",
        source:
          "import { manifest } from '@keel/router'\nconst P = () => null\nexport const routes = manifest({ 'a.in': { path: '/auth/x', component: P }, 'a.out': { path: '/authx', component: P } })\n",
      },
    ];
    expect(identityDiags(files).map((d) => [d.code, d.path, d.message.split(" ")[1]])).toEqual([
      ["E1579", "modules/a/routes.ts", "a.in"],
    ]);
    const bad = [{ path: "identity.server.ts", source: "export default 1\n" }];
    expect(identityDiags(bad)).toEqual([]);
    expect(identityDiags(bad, undefined, true).map((d) => d.code)).toEqual(["E1579"]);
  });
});
