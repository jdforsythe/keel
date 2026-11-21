// pathCollisions (E1559, k.topology Route table). Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { serverEntryCode } from "../src/internal/serverEntryCode.ts";
import { pathCollisions } from "../src/pathCollisions.ts";

const routes = (id: string, p: string) => [
  {
    path: `modules/${id}/${id}.contract.ts`,
    source: `import { contract } from '@keel/router/contract'\nexport const ${id} = contract('${id}', { '${id}.page': { path: '${p}' } })\n`,
  },
  {
    path: `modules/${id}/routes.ts`,
    source: `import { manifest } from '@keel/router'\nimport { ${id} } from './${id}.contract.ts'\nconst V = () => null\nexport const routes = manifest(${id}, { '${id}.page': { component: V } })\n`,
  },
];
const seg = fc.stringMatching(/^[a-z]{1,6}$/);

describe("pathCollisions", () => {
  test("one E1559 for one path in two deployables, none in one deployable or for different paths", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            seg,
            seg.map((x) => `:${x}`),
          ),
          { minLength: 1, maxLength: 3 },
        ),
        seg,
        (parts, other) => {
          const p = `/${parts.join("/")}`;
          const q = `/${parts.map((x) => (x.startsWith(":") ? ":other" : x)).join("/")}`;
          const files = [...routes("a", p), ...routes("b", q)];
          const split = {
            x: { modules: ["a"], adapter: "node" as const },
            y: { modules: ["b"], adapter: "node" as const },
          };
          const found = pathCollisions(files, split);
          expect(found.map((d) => d.code)).toEqual(["E1559"]);
          expect(found[0]?.message).toContain("a.page");
          expect(found[0]?.message).toContain("b.page");
          expect(found[0]?.path).toBe("modules/b/b.contract.ts");
          expect(pathCollisions(files, { one: { modules: ["a", "b"], adapter: "node" } })).toEqual([]);
          expect(pathCollisions([...routes("a", p), ...routes("b", `${p}/${other}`)], split)).toEqual([]);
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });

  test("a path with a trailing slash collides with the same path without one (the router drops it)", () => {
    fc.assert(
      fc.property(fc.array(seg, { minLength: 1, maxLength: 3 }), (parts) => {
        const p = `/${parts.join("/")}`;
        const split = {
          x: { modules: ["a"], adapter: "node" as const },
          y: { modules: ["b"], adapter: "node" as const },
        };
        expect(pathCollisions([...routes("a", p), ...routes("b", `${p}/`)], split).map((d) => d.code)).toEqual([
          "E1559",
        ]);
      }),
      { seed: 1337, numRuns: 30 },
    );
  });
});

describe("serverEntryCode", () => {
  test("installs the server DOM before importing the app and calls start with the deployable", () => {
    const code = serverEntryCode("/nowhere", "api", ["api"]);
    expect(code.indexOf("installServerDom();")).toBeLessThan(code.indexOf("topology.ts"));
    expect(code).toContain('deployable: "api"');
    expect(code).toContain("dir: import.meta.dirname");
    expect(code).toContain("routes: routeTable()");
  });
});
