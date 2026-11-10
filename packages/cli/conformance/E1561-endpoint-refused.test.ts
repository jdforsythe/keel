// Spec: k.compat, clause "An endpoint whose `body` lacks a field the route's `input` requires is one E1561; the same endpoint with the route's own schema has none."
// Seed 1337. Rules E1561: "at the endpoint, naming the first refused path; no fix". Real binary over a temp project (see compat-support.ts).
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { SEED, buildAndCheck, cleanup, diags, materialize, project } from "./compat-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const run = (sh: Parameters<typeof project>[0]) => {
  const dir = materialize(project(sh));
  dirs.push(dir);
  return buildAndCheck(dir);
};
const field = fc.constantFrom("name", "note", "qty", "label");

test.skip("An endpoint whose `body` lacks a field the route's `input` requires is one E1561; the same endpoint with the route's own schema has none.", () => {
  fc.assert(
    fc.property(
      fc.tuple(field, field).filter(([a, b]) => a !== b),
      ([kept, missing]) => {
        const input = `s.object({ ${kept}: s.string(), ${missing}: s.string() })`;
        const refused = diags(run({ input, body: `s.object({ ${kept}: s.string() })` }), "E1561");
        expect(refused).toHaveLength(1);
        expect(refused[0]?.path).toBe("modules/a/api.ts");
        expect(String(refused[0]?.message)).toContain(missing);
        expect(refused[0]?.fix).toBeUndefined();
        expect(diags(run({ input }), "E1561")).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 4 },
  );
});

test.skip("E1561: an endpoint whose `output` or `errors` refuse the route's answer is one E1561 at the endpoint naming the refused path", () => {
  const out = diags(
    run({ output: "s.object({ id: s.string() })", endpointOutput: "s.object({ id: s.string(), extra: s.string() })" }),
    "E1561",
  );
  expect(out).toHaveLength(1);
  expect(String(out[0]?.message)).toContain("extra");
  expect(out[0]?.fix).toBeUndefined();
});

test.skip("E1561: an endpoint whose method and path match no route of that module is E1561", () => {
  expect(diags(run({ path: "/y/missing" }), "E1561")).toHaveLength(1);
});

test.skip("E1561 is reported in every topology: one deployable or two", () => {
  const input = "s.object({ name: s.string(), note: s.string() })";
  const body = "s.object({ name: s.string() })";
  expect(diags(run({ input, body, split: false }), "E1561")).toHaveLength(1);
  expect(diags(run({ input, body, split: true }), "E1561")).toHaveLength(1);
});
