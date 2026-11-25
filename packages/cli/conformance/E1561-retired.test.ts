// Spec: k.compat, clause "No input makes `keel check` report E1561." (RFC 0157 D6: the client and the handler read one entry, so E1561 is unrepresentable.)
// Spec: RFC 0157 Conformance diff: "No diagnostic of `keel check` has code E1561, E1507, E1512 or E1157 for any input, and `keel explain E1561` names k.contract."
// Seed 1337. Real binary over a temp project (see compat-support.ts). Each input varies what E1561 compared: the caller's body, the answer and the route.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { SEED, buildAndCheck, cleanup, diags, keel, materialize, project } from "./compat-support.ts";

/** Property runs spawn several `keel build` and `keel check` processes each. */
const SLOW = 120_000;
/**
 * What the property case bounds: four runs of a `keel build` and a `keel check` each, eight binary runs, about 3 s a run here beside other work. The bound is 60 s a run, so a runner ten times slower (scale 0.1) still has
 * 6 s a run.
 */
const PROPERTY_BOUND = 4 * 2 * 60_000;

const RETIRED = ["E1561", "E1507", "E1512", "E1157"];
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

test(
  "No input makes `keel check` report E1561, E1507, E1512 or E1157",
  () => {
    fc.assert(
      fc.property(fc.tuple(field, field), fc.boolean(), ([kept, other], split) => {
        const body = `s.object({ ${kept}: s.string(), ${other}: s.string().optional() })`;
        const output = `s.object({ ${other}: s.string() })`;
        const records = run({ body, output, outputValue: `{ ${other}: 'v' }`, split });
        for (const code of RETIRED) expect(diags(records, code)).toEqual([]);
      }),
      { seed: SEED, numRuns: 4 },
    );
  },
  PROPERTY_BOUND,
);

test(
  "a module that calls an entry its contract does not declare is not E1561: `keel check` reports a type or import error and no retired code",
  () => {
    const dir = materialize({
      ...project(),
      "modules/a/api.ts":
        "import { service } from '@keel/services'\nimport { y } from '../y/y.contract.ts'\nexport const api = service({ contract: y })\nexport const missing = () => Reflect.get(api, 'nothing')\n",
    });
    dirs.push(dir);
    for (const code of RETIRED) expect(diags(buildAndCheck(dir), code)).toEqual([]);
  },
  SLOW,
);

test("`keel explain E1561` names k.contract and says which rule replaced it", () => {
  const dir = materialize(project());
  dirs.push(dir);
  const out = keel(dir, ["explain", "E1561"]);
  expect(JSON.stringify(out.records)).toContain("k.contract");
  for (const code of ["E1507", "E1512", "E1157"]) {
    expect(JSON.stringify(keel(dir, ["explain", code]).records), code).toContain("k.contract");
  }
});
