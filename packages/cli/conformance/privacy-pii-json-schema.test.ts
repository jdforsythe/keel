// Spec: k.privacy, clause "`s.string().pii('contact')` has `doc()` `string pii(contact)` and JSON Schema `x-keel-pii: "contact"`."
// Seed: 1337 (the pii class is drawn by fast-check over the closed `PiiClass` set).
// The JSON Schema derivation is not exported by `@keel/schema`; the public path is `keel build`, whose `.keel/surface.json` holds a route's loader
// `output` as JSON Schema (k.compat Surface: "Schemas are JSON Schema, as in `routes.json`"). Real binary over a temp project (see compat-support.ts).
// ASSUMED: a node of the JSON Schema is found by walking the surface for the object whose `properties` hold the loader output's field names.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { SEED, cleanup, keel, materialize, project, readText } from "./compat-support.ts";
import type { Tree } from "./compat-support.ts";

const SLOW = 180_000;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const PII = ["name", "contact", "location", "identifier", "financial", "special", "network", "content"] as const;

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
  const files: Tree = project({ output, outputValue: value, endpointOutput: "s.json()", split: false });
  const load = files["modules/y/load.server.ts"] ?? "";
  files["modules/y/load.server.ts"] = `${imports}\n${load}`;
  const dir = materialize(files);
  dirs.push(dir);
  keel(dir, ["build"]);
  return JSON.parse(readText(dir, ".keel/surface.json"));
}

test(
  "JSON Schema `x-keel-pii: \"contact\"` for `s.string().pii('contact')`, and the class named for every `PiiClass`",
  () => {
    const fields = PII.map((c) => `${c}: s.string().pii('${c}')`).join(", ");
    const value = `{ ${PII.map((c) => `${c}: 'v'`).join(", ")}, plain: 'v' }`;
    const surface = surfaceOf(`s.object({ ${fields}, plain: s.string() })`, value, "");
    const found = withProps(surface, [...PII]);
    expect(found.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(fc.constantFrom(...PII), (c) => {
        for (const props of found) {
          const node = props[c];
          expect(isDict(node) ? node["x-keel-pii"] : undefined).toBe(c);
          expect(isDict(node) ? node.type : undefined).toBe("string");
        }
      }),
      { seed: SEED, numRuns: 50 },
    );
    for (const props of found) {
      const plain = props.plain;
      expect(isDict(plain) && "x-keel-pii" in plain).toBe(false);
    }
  },
  SLOW,
);
