// Generated files are already formatted: `biome format` leaves them unchanged (k.services OpenAPI, rfc:0034).
// So a scaffolded `api.schema.ts` passes an app's `biome check`. Seed 1337.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { expect, test } from "vitest";
import { openapi } from "../src/openapi/openapi.ts";

/** The nearest ancestor holding biome.json and the biome binary (the repo root; also from a Stryker sandbox). */
function rootOf(dir: string): string {
  const has = (d: string) =>
    existsSync(path.join(d, "biome.json")) && existsSync(path.join(d, "node_modules", ".bin", "biome"));
  let d = dir;
  while (!has(d) && path.dirname(d) !== d) d = path.dirname(d);
  return d;
}
const ROOT = rootOf(import.meta.dirname);
const BIOME = path.join(ROOT, "node_modules", ".bin", "biome");

const key = fc.oneof(fc.stringMatching(/^[a-z][A-Za-z0-9]{0,6}$/), fc.stringMatching(/^[a-z][a-z0-9]{20,40}$/));
const word = fc.stringMatching(/^[a-z]{1,28}$/);
const sorted = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)];

const { schema } = fc.letrec<{ schema: unknown; leaf: unknown }>((tie) => ({
  leaf: fc.oneof(
    fc.constant({ type: "string" }),
    fc.tuple(fc.nat(9), fc.nat(9)).map(([a, b]) => {
      const [min, max] = sorted(a, b);
      return { type: "integer", minimum: min, maximum: max };
    }),
    fc.constant({ type: "number", minimum: 0 }),
    fc.constant({ type: "boolean", nullable: true }),
    fc.uniqueArray(word, { minLength: 1, maxLength: 9 }).map((e) => ({ enum: e })),
    word.map((c) => ({ const: c })),
  ),
  schema: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    tie("leaf"),
    tie("schema").map((items) => ({ type: "array", items })),
    fc
      .tuple(fc.dictionary(key, tie("schema"), { minKeys: 1, maxKeys: 5 }), fc.boolean(), fc.boolean())
      .map(([properties, closed, nullable]) => ({
        type: "object",
        properties,
        required: Object.keys(properties).filter((_, i) => i % 2 === 0),
        ...(closed ? { additionalProperties: false } : {}),
        ...(nullable ? { nullable: true } : {}),
      })),
    tie("schema").map((v) => ({ additionalProperties: v })),
    fc.array(tie("schema"), { minLength: 2, maxLength: 3 }).map((oneOf) => ({ oneOf })),
  ),
}));

const json = (s: unknown) => ({ content: { "application/json": { schema: s } } });
const docArb = fc.tuple(schema, schema, schema, fc.boolean()).map(([out, body, err, named]) => ({
  openapi: "3.1.0",
  servers: [{ url: "https://api.test" }],
  components: { schemas: { Shared: out } },
  paths: {
    "/things/{id}": {
      parameters: [{ name: "id", in: "path", schema: { type: "string" } }],
      get: {
        operationId: "getThing",
        parameters: [{ name: "q", in: "query", schema: err }],
        responses: { "200": json(named ? { $ref: "#/components/schemas/Shared" } : out), "409": json(err) },
      },
      put: { operationId: "putThing", requestBody: json(body), responses: { "201": json(out) } },
    },
  },
}));

test("every generated file is unchanged by biome format", () => {
  const sources: string[] = [];
  fc.assert(
    fc.property(docArb, (doc) => {
      const r = openapi(doc, { name: "things" });
      expect(r.ok).toBe(true);
      if (r.ok) sources.push(r.value.schema, r.value.service);
    }),
    { seed: 1337, numRuns: 60 },
  );
  const input = sources.join("");
  const out = spawnSync(BIOME, ["format", "--stdin-file-path=generated.ts"], { cwd: ROOT, input, encoding: "utf8" });
  expect(out.status).toBe(0);
  expect(out.stdout).toBe(input);
});
