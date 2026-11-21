import { canonicalJson, hashOf } from "@keel/compiler/internal";
// Seed 1337. The k.compat pass (E1562, W1568) and `surface.json` freshness (E1005) over in-memory projects.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type SourceFile, check } from "../src/index.ts";
import { applyPatch } from "./support/applyPatch.ts";

const SEED = 1337;
const f = (path: string, source: string): SourceFile => ({ path, source });
const str = { type: "string" };
const obj = (req: string[], opt: string[] = []) => ({
  type: "object",
  properties: Object.fromEntries([...req, ...opt].map((n) => [n, str])),
  required: req,
});
/** Module `y`'s contract: `y.list` (GET `/y/list`) and `y.save` (POST `/y/save`) whose `body` fields are `fields`. */
const contractTs = (fields: string, output = "s.object({ id: s.string() })") =>
  f(
    "modules/y/y.contract.ts",
    `import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const y = contract('y', {\n  'y.list': { method: 'GET', path: '/y/list', output: ${output} },\n  'y.save': {\n    method: 'POST',\n    path: '/y/save',\n    body: s.object({\n${fields}\n    }),\n    output: s.object({}),\n  },\n})\n`,
  );

type Sv = { body: unknown; listOut?: unknown; savePath?: string };
const data = (sv: Sv, sources: readonly SourceFile[]) => ({
  version: 2,
  contracts: {
    y: {
      module: "y",
      callers: ["a"],
      entries: {
        "y.list": {
          method: "GET",
          path: "/y/list",
          params: null,
          query: null,
          body: null,
          output: sv.listOut ?? obj(["id"]),
          errors: {},
        },
        "y.save": {
          method: "POST",
          path: sv.savePath ?? "/y/save",
          params: null,
          query: null,
          body: sv.body,
          output: obj([]),
          errors: {},
        },
      },
    },
  },
  stores: {},
  sources: Object.fromEntries(sources.map((s) => [s.path, hashOf(s.source)])),
});
const surface = (d: unknown) => f(".keel/surface.json", `${canonicalJson({ data: d, hash: hashOf(d) })}\n`);
const SPLIT = { x: { modules: ["a"], adapter: "node" }, y: { modules: ["y"], adapter: "node" } } as const;
const ONE = { x: { modules: ["a", "y"], adapter: "node" } } as const;
const run = (files: SourceFile[], opts: Parameters<typeof check>[1] = {}) =>
  check(files, { types: false, ...opts }).diagnostics.filter((d) => /^[EW](1562|1005|1568)$/.test(d.code));

describe("surface.json freshness", () => {
  it("reads nothing from a stale or tampered surface: E1005 instead", () => {
    const contract = contractTs("      name: s.string(),");
    const base = data({ body: { ...obj(["name"]), additionalProperties: false } }, []);
    const file = surface(data({ body: obj(["name", "note"]) }, [contract]));
    const edited = f(contract.path, `${contract.source}// edited\n`);
    expect(run([edited, file], { base, topology: SPLIT }).map((d) => d.code)).toEqual(["E1005"]);
    expect(run([edited, file])[0]?.message).toBe(
      `.keel/surface.json is stale, ${contract.path} changed; run keel build`,
    );
    expect(run([edited, file])[0]?.message.length).toBeLessThan(90);
    const tampered = f(file.path, file.source.replace('"name"', '"nome"'));
    expect(run([contract, tampered]).map((d) => d.code)).toEqual(["E1005"]);
  });
});

describe("E1562", () => {
  // A closed base body never sends a field it lacks, so making the added field optional clears it (k.compat Accepts).
  const base = data({ body: { ...obj(["name"]), additionalProperties: false } }, []);

  it("an added required field is one E1562 at that field whose fix leaves none; none in one deployable", () => {
    fc.assert(
      fc.property(fc.constantFrom("note", "qty", "label"), (field) => {
        const contract = contractTs(`      name: s.string(),\n      ${field}: s.string(),`);
        const now = surface(data({ body: obj(["name", field]) }, [contract]));
        const d = run([contract, now], { base, topology: SPLIT });
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({ code: "E1562", path: "modules/y/y.contract.ts", line: 10, col: 7 });
        expect(d[0]?.message).toBe(`y.save body requires ${field}; base callers send none`);
        const fixed = applyPatch(contract.path, contract.source, d[0]?.fix ?? "");
        expect(fixed).toContain(`${field}: s.string().optional(),`);
        const after = f(contract.path, fixed);
        const loose = surface(data({ body: obj(["name"], [field]) }, [after]));
        expect(run([after, loose], { base, topology: SPLIT })).toEqual([]);
        expect(run([contract, now], { base, topology: ONE })).toEqual([]);
        expect(run([contract, now], { topology: SPLIT })).toEqual([]);
      }),
      { seed: SEED, numRuns: 3 },
    );
  });

  it("a removed output field a base entry requires is one E1562 with no fix; an added field is none", () => {
    const contract = contractTs("      name: s.string(),");
    const old = data({ body: obj(["name"]), listOut: obj(["id", "title"]) }, []);
    const now = surface(data({ body: obj(["name"]) }, [contract]));
    const d = run([contract, now], { base: old, topology: SPLIT });
    expect(d.map((x) => [x.code, x.path, x.message, x.fix])).toEqual([
      ["E1562", "modules/y/y.contract.ts", "y.list output no longer answers title, which base callers need", undefined],
    ]);
    const more = surface(data({ body: obj(["name"]), listOut: obj(["id", "title", "more"]) }, [contract]));
    expect(run([contract, more], { base: old, topology: SPLIT })).toEqual([]);
  });

  it("an entry gone from its method and path is one E1562 with no fix", () => {
    const contract = contractTs("      name: s.string(),");
    const moved = surface(data({ body: obj(["name"]), savePath: "/y/keep" }, [contract]));
    const d = run([contract, moved], { base: data({ body: obj(["name"]) }, []), topology: SPLIT });
    expect(d.map((x) => [x.code, x.fix])).toEqual([["E1562", undefined]]);
    expect(d[0]?.message).toContain("y.save moved from POST /y/save to POST /y/keep");
  });

  it("an added required field the contract source does not spell out is one E1562 with no fix", () => {
    const literal = contractTs("      name: s.string(),\n      note: s.string(),");
    const source = literal.source
      .replace("body: s.object({", "body: make(")
      .replace("    }),\n    output", "    }),\n    output");
    const contract = f(
      literal.path,
      `${source.replace("make(\n      name: s.string(),\n      note: s.string(),\n    }),", "make(),")}const make = () => s.object({ name: s.string(), note: s.string() })\n`,
    );
    const now = surface(data({ body: obj(["name", "note"]) }, [contract]));
    const d = run([contract, now], { base, topology: SPLIT });
    expect(d.map((x) => [x.code, x.message, x.fix])).toEqual([
      ["E1562", "y.save body requires note; base callers send none", undefined],
    ]);
  });

  it("a base that is no version 2 surface is one W1568 and no E1562", () => {
    const contract = contractTs("      name: s.string(),\n      note: s.string(),");
    const now = surface(data({ body: obj(["name", "note"]) }, [contract]));
    for (const old of [{ ...base, version: 1 }, { data: { version: 2 } }, 7]) {
      expect(run([contract, now], { base: old, topology: SPLIT }).map((d) => d.code)).toEqual(["W1568"]);
    }
  });
});
