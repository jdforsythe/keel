// k.a11y Claims: items per page route of each project, the chain's module folders, W1731 for a layout no page wraps.
// Seed 1337 (the properties below).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { A11yCriteriaMap } from "../src/internal/A11yCriteriaMap.ts";
import { a11yClaims } from "../src/internal/a11yClaims.ts";
import { pagelessLayouts } from "../src/internal/pagelessLayouts.ts";

const MAP: A11yCriteriaMap = new Map([["1.1.1", { render: ["image-alt"], static: ["E1802"] }]]);
type Entry = { path?: string | null; layout?: string; api?: true; module?: string; actions?: string[] };
const routes = (data: Readonly<Record<string, Entry>>): string => JSON.stringify({ data, hash: "x" });
const passing = (...ids: string[]): string =>
  JSON.stringify(
    ids.map((route) => ({
      route,
      component: null,
      rules: ["image-alt"],
      violations: [],
      file: "t",
      test: route,
      passed: true,
    })),
  );

describe("a11y items per page route", () => {
  it("a page has items; a layout, an API entry and an entry without a path have none", () => {
    const files = [
      {
        path: ".keel/routes.json",
        source: routes({
          "m.p": { path: "/p", layout: "m.l", actions: ["POST"] },
          "m.l": { path: null },
          "m.api": { path: "/api", api: true },
          "m.bare": {},
        }),
      },
    ];
    expect(a11yClaims(files, MAP).map((c) => c.item)).toEqual(["a11y:.:m.p#1.1.1"]);
  });

  it("a static code under the module folder of any entry of the chain withholds the page's criterion", () => {
    const files = [
      {
        path: "apps/a/.keel/routes.json",
        source: routes({
          "m.p": { path: "/p", layout: "s.inner", module: "m" },
          "s.inner": { path: null, layout: "t.outer", module: "s" },
          "t.outer": { path: null, module: "t" },
          "o.q": { path: "/q", module: "o" },
        }),
      },
      { path: "apps/a/reports/a11y.json", source: passing("m.p", "o.q") },
    ];
    const rung = (findings: { code: string; path: string }[], item: string) =>
      a11yClaims(files, MAP, findings).find((c) => c.item === item)?.rung;
    expect(rung([], "a11y:apps/a:m.p#1.1.1")).toBe("example");
    for (const folder of ["m", "s", "t"])
      expect(rung([{ code: "E1802", path: `apps/a/modules/${folder}/X.ts` }], "a11y:apps/a:m.p#1.1.1")).toBe("none");
    expect(rung([{ code: "E1802", path: "apps/a/modules/o/X.ts" }], "a11y:apps/a:m.p#1.1.1")).toBe("example");
    expect(rung([{ code: "E1802", path: "apps/b/modules/m/X.ts" }], "a11y:apps/a:m.p#1.1.1")).toBe("example");
    expect(rung([{ code: "E1802", path: "apps/a/modules/t/X.ts" }], "a11y:apps/a:o.q#1.1.1")).toBe("example");
  });

  it("W1731 names each layout no page route's chain holds, at its project's routes.json", () => {
    const files = [
      {
        path: "examples/e/.keel/routes.json",
        source: routes({
          "m.p": { path: "/p", layout: "m.inner" },
          "m.inner": { path: null, layout: "m.outer" },
          "m.outer": { path: null },
          "m.alone": { path: null },
          "m.api": { path: "/api", api: true, layout: "m.apiFrame" },
          "m.apiFrame": { path: null },
        }),
      },
    ];
    const found = pagelessLayouts(files);
    expect(found.map((d) => [d.code, d.path])).toEqual([
      ["W1731", "examples/e/.keel/routes.json"],
      ["W1731", "examples/e/.keel/routes.json"],
    ]);
    expect(found.map((d) => d.message.split(" ")[1])).toEqual(["m.alone", "m.apiFrame"]);
  });

  it("a layout chain that loops ends the walk and the layouts in it count as held", () => {
    const files = [
      {
        path: ".keel/routes.json",
        source: routes({
          "m.p": { path: "/p", layout: "m.a" },
          "m.a": { path: null, layout: "m.b" },
          "m.b": { path: null, layout: "m.a" },
        }),
      },
    ];
    expect(pagelessLayouts(files)).toEqual([]);
    expect(a11yClaims(files, MAP).map((c) => c.item)).toEqual(["a11y:.:m.p#1.1.1"]);
  });

  it("each (project, page route) pair has its own key and another project's report never earns it (property, seed 1337)", () => {
    const dir = fc.constantFrom(".", "apps/a", "apps/b", "examples/a");
    const ids = fc.uniqueArray(fc.constantFrom("m.r", "m.s", "n.r"), { minLength: 1, maxLength: 3 });
    const projects = fc.uniqueArray(fc.tuple(dir, ids, fc.boolean()), {
      selector: ([d]) => d,
      minLength: 1,
      maxLength: 4,
    });
    fc.assert(
      fc.property(projects, (ps) => {
        const files = ps.flatMap(([d, routeIds, tested]) => {
          const at = d === "." ? "" : `${d}/`;
          const data = Object.fromEntries(routeIds.map((id) => [id, { path: `/${id}` }]));
          return [
            { path: `${at}.keel/routes.json`, source: routes(data) },
            ...(tested ? [{ path: `${at}reports/a11y.json`, source: passing(...routeIds) }] : []),
          ];
        });
        const claims = a11yClaims(files, MAP);
        expect(new Set(claims.map((c) => c.item)).size).toBe(claims.length);
        for (const [d, routeIds, tested] of ps)
          for (const id of routeIds)
            expect(claims.find((c) => c.item === `a11y:${d}:${id}#1.1.1`)?.rung).toBe(tested ? "example" : "none");
        expect(claims).toHaveLength(ps.reduce((n, [, r]) => n + r.length, 0));
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
