// Spec: k.scaffold-service, Conformance "Each project below holds module `orders`. In a `--adapter node` project, `service { id: 'orders', base: 'https://api.example.com' }` creates exactly `modules/orders/OrdersApi.schema.ts` (one export, `OrdersApi = endpoints({})`) and `modules/orders/api.server.ts` (one export, `api = service({ base: 'https://api.example.com', schema: OrdersApi })`), neither with a generated first line; it changes `package.json` alone, which gains `@keel/services` at the version of `@keel/server`; `keel check` and `keel test` are clean."
// seed 1337 (property over module ids; the project and its version are fixed).
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { RUNS, SEED, apiName, apply, lowerName, read } from "./fixtures.ts";
import { cleanup, materialize } from "./keel-cli.ts";
import {
  ORIGIN,
  dependencies,
  expectCheckAndTestClean,
  freshNode,
  testFileCount,
  withModuleNode,
} from "./service-base-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const exportsOf = (src: string): string[] =>
  [...src.matchAll(/^export\s+(?:const|function|class|let|var|default)\s+(\w+)/gm)].map((m) => m[1] ?? "");
const exportCount = (src: string): number => [...src.matchAll(/^export\b/gm)].length;

describe("service { id, base } in a --adapter node project", () => {
  it("creates exactly modules/<module>/<Module>Api.schema.ts and modules/<module>/api.server.ts, each with its one export and no generated first line", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const before = withModuleNode(id);
        const out = apply("service", { id, base: ORIGIN }, before);
        const n = apiName(id);
        const schemaPath = `modules/${id}/${n}.schema.ts`;
        const servicePath = `modules/${id}/api.server.ts`;
        expect(out.created).toEqual([schemaPath, servicePath].sort());
        expect(out.removed).toEqual([]);
        const schema = read(out.files, schemaPath);
        const service = read(out.files, servicePath);
        expect(exportsOf(schema)).toEqual([n]);
        expect(exportCount(schema)).toBe(1);
        expect(schema).toMatch(new RegExp(`export const ${n} = endpoints\\(\\{\\}\\)`));
        expect(exportsOf(service)).toEqual(["api"]);
        expect(exportCount(service)).toBe(1);
        expect(service).toMatch(
          new RegExp(
            `export const api = service\\(\\{\\s*base:\\s*["']${ORIGIN.replaceAll(".", "\\.")}["'],\\s*schema:\\s*${n}\\s*\\}\\)`,
          ),
        );
        for (const src of [schema, service]) expect(src.split("\n")[0] ?? "").not.toMatch(/generated/i);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("changes package.json alone, which gains @keel/services at the version of @keel/server, keys sorted, other files byte-identical", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const before = withModuleNode(id);
        const out = apply("service", { id, base: ORIGIN }, before);
        expect(out.changed).toEqual(["package.json"]);
        for (const [p, c] of before) if (p !== "package.json") expect(out.files.get(p), p).toBe(c);
        const deps = dependencies(out.files);
        expect(deps["@keel/services"]).toBe(dependencies(before)["@keel/server"]);
        expect(Object.keys(deps)).toEqual([...Object.keys(deps)].sort());
        expect(Object.entries(deps).filter(([k]) => k !== "@keel/services")).toEqual(
          Object.entries(dependencies(before)),
        );
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("leaves keel check and keel test clean", () => {
    const tree = apply("service", { id: "orders", base: ORIGIN }, freshNode()).files;
    const dir = materialize(tree);
    dirs.push(dir);
    expectCheckAndTestClean(dir, testFileCount(tree));
  }, 120000);
});
