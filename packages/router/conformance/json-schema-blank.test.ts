// @vitest-environment happy-dom
// Spec: k.schema, clause "`s.string({ min: 1 })` fails `''`, `' '`, U+200B, U+3164 and a lone U+0301 with rule `required`; `decodeStrings` drops each if optional; the JSON Schema `pattern` refuses exactly the blank values without `M`, `Cs` or non-BMP characters." (rfc:0152)
// Seed: 1337 (no random input: every BMP code point is enumerated).
// ASSUMED seam: the router derives JSON Schema for a route's `params` and `search` into `routesArtifact(manifest)` (k.compat: "Schemas
// are JSON Schema, as in `routes.json`"); the spec does not name the artifact's keys, so the test reads `<id>.params.properties.<key>.pattern`
// and `<id>.search.properties.<key>.pattern`, the shape the current artifact has. The spec does not call this output OpenAPI.
import { loader, manifest, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const at = (v: unknown, ...keys: string[]): unknown =>
  keys.reduce<unknown>((x, k) => (isDict(x) ? x[k] : undefined), v);

const BLANK_CHAR = /^[\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cs}\p{M}⠀]$/u;
const MARK_OR_SURROGATE = /^[\p{M}\p{Cs}]$/u;
const refusedByPattern = (c: string): boolean => BLANK_CHAR.test(c) && !MARK_OR_SURROGATE.test(c);

const tContract = contract("t", {
  "t.one": {
    method: "GET",
    path: "/t/:id",
    params: s.object({ id: s.string({ min: 1 }) }),
    query: s.object({ q: s.string({ min: 1 }).optional() }),
    output: s.object({ n: s.int() }),
  },
});

const read = loader(tContract, "t.one", {}, async () => ok({ n: 1 }));
const routes = manifest(tContract, {
  "t.one": { loader: read },
});
const artifact: unknown = routesArtifact(routes);

describe("k.schema JSON Schema pattern of a blank-refusing string (route artifact)", () => {
  it("the `pattern` of a `min: 1` param and search string matches /^\\[\\^(\\\\u[0-9A-F]{4}(-\\\\u[0-9A-F]{4})?)+\\]$/: only `\\u` ranges", () => {
    for (const where of ["params", "search"]) {
      const key = where === "params" ? "id" : "q";
      const pattern = at(artifact, "t.one", where, "properties", key, "pattern");
      expect(typeof pattern, where).toBe("string");
      expect(String(pattern), where).toMatch(/^\[\^(\\u[0-9A-F]{4}(-\\u[0-9A-F]{4})?)+\]$/);
    }
  });

  it("for every BMP code point `c`, `new RegExp(pattern).test(c)` is false exactly when `c` is in the blank set and not `M` or `Cs`; an astral character and `'\\u0301'` match", () => {
    const pattern = String(at(artifact, "t.one", "params", "properties", "id", "pattern"));
    const re = new RegExp(pattern);
    const wrong: string[] = [];
    for (let cp = 0; cp <= 0xffff; cp++) {
      const c = String.fromCharCode(cp);
      if (re.test(c) === refusedByPattern(c)) wrong.push(`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
    }
    expect(wrong).toEqual([]);
    for (const v of ["́", "\u{1F600}", "\u{E0001}"]) expect(re.test(v), v).toBe(true);
  });
});
