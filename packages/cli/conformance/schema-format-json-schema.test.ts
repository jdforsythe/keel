// Spec: k.formats, clause "For a fixture format type, every generated value parses and round-trips; a value `base` accepts and `check` refuses fails with rule `format` at its path; `doc()` is its name; JSON Schema adds `format`; `s.format` in an app file is E1106."
// Seed: 1337 (no random input).
// The JSON Schema derivation is not exported by `@keel/schema`; the public path is `keel build`, whose `.keel/surface.json` holds a route's loader
// `output` as JSON Schema (k.compat Surface: "Schemas are JSON Schema, as in `routes.json`"). Real binary over a temp project (see compat-support.ts).
// ASSUMED: a node of the JSON Schema is found by walking the surface for the object whose `properties` hold the loader output's field names;
// the `format` value is the format type's `doc()` (the spec: "`doc()` is `name`"; "JSON Schema adds `format: name`").
// ASSUMED: the name is `temporal.PlainDate` (std.temporal: `doc()` is its name; the package is not a dependency of @keel/cli, so the name is written out); `PlainDate` of `@keel/std-temporal` is a fixture format type usable in app code (`s.format` itself is E1106 there).
import { afterAll, expect, test } from "vitest";
import { cleanup, keel, materialize, project, readText } from "./compat-support.ts";
import type { Tree } from "./compat-support.ts";

const SLOW = 180_000;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);

/** Every object in the JSON tree whose `properties` hold all of `names`. */
function withProps(tree: unknown, names: string[], out: Dict[] = []): Dict[] {
  if (Array.isArray(tree)) for (const x of tree) withProps(x, names, out);
  else if (isDict(tree)) {
    const props = tree.properties;
    if (isDict(props) && names.every((n) => n in props)) out.push(props);
    for (const x of Object.values(tree)) withProps(x, names, out);
  }
  return out;
}

function surfaceOf(output: string, value: string, imports: string): unknown {
  const files: Tree = project({ output, outputValue: value, split: false });
  const contract = files["modules/y/y.contract.ts"] ?? "";
  files["modules/y/y.contract.ts"] = `${imports}\n${contract}`;
  const dir = materialize(files);
  dirs.push(dir);
  keel(dir, ["build"]);
  return JSON.parse(readText(dir, ".keel/surface.json"));
}

test(
  "JSON Schema adds `format`: a route output field of a format type is `type: string` with `format` its name",
  () => {
    const surface = surfaceOf(
      "s.object({ day: PlainDate.optional() })",
      "{}",
      "import { PlainDate } from '@keel/std-temporal'",
    );
    const found = withProps(surface, ["day"]);
    expect(found.length).toBeGreaterThan(0);
    for (const props of found) {
      const day = props.day;
      expect(isDict(day) ? day.format : undefined).toBe("temporal.PlainDate");
      expect(isDict(day) ? day.type : undefined).toBe("string");
    }
  },
  SLOW,
);
