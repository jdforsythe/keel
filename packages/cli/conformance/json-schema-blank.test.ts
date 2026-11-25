// Spec: k.schema, clause "`s.string({ min: 1 })` fails `''`, `' '`, U+200B, U+3164 and a lone U+0301 with rule `required`; `decodeStrings` drops each if optional; the JSON Schema `pattern` refuses exactly the blank values without `M`, `Cs` or non-BMP characters." (rfc:0152)
// k.schema, Primitives "JSON Schema adds a `pattern` of `\u` ranges for its BMP part but `M` and `Cs`, read alike by ECMA-262 and Python"
// Seed: 1337. The MCP input schema of an operation holding a `min: 1` string is read through the public seam: `stdCommand('session', op)`
// fills the slot (process-wide, once per file) and `mcp(...).receive` answers `tools/list` with the tool's `inputSchema`.
// The blank set is the oracle below, written from the spec. Python `re` is not run: "read alike" is checked as the same answer
// from ECMA-262 with and without the `u` flag on every BMP code point.
import { mcp, stdCommand } from "@keel/cli";
import type { StdOperation } from "@keel/cli";
import { s } from "@keel/schema";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";

const SEED = 1337;
const RUNS = 100;

const op: StdOperation = {
  name: "session",
  description: "blank pattern fixture",
  input: s.object({ target: s.string({ min: 1 }) }),
  output: s.object({ records: s.array(s.object({ kind: s.string() })) }),
  positional: ["target"],
  scope: "none",
  run: async () => ({ records: [], writes: [] }),
};
stdCommand("session", op);

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const field = (v: unknown, name: string): unknown => (isDict(v) ? Reflect.get(v, name) : undefined);

const BLANK_CHAR = /^[\p{White_Space}\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Cs}\p{M}⠀]$/u;
const MARK_OR_SURROGATE = /^[\p{M}\p{Cs}]$/u;
/** The BMP characters the pattern refuses: blank, but not `M` or `Cs`. */
const refusedByPattern = (c: string): boolean => BLANK_CHAR.test(c) && !MARK_OR_SURROGATE.test(c);

let pattern = "";
beforeAll(async () => {
  const out = await mcp(() => ({ cwd: "/work/app", files: [] })).receive(
    `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })}\n`,
  );
  const line = out.split("\n").find((l) => l.trim() !== "") ?? "{}";
  const list = field(field(JSON.parse(line), "result"), "tools");
  const tool = (Array.isArray(list) ? list : []).find((t) => field(t, "name") === "session");
  const p = field(field(field(field(tool, "inputSchema"), "properties"), "target"), "pattern");
  if (typeof p !== "string") throw new Error("the `min: 1` string has no `pattern` in the MCP input schema");
  pattern = p;
});

describe("k.schema JSON Schema pattern of a blank-refusing string (MCP input schema)", () => {
  it("the `pattern` matches /^\\[\\^(\\\\u[0-9A-F]{4}(-\\\\u[0-9A-F]{4})?)+\\]$/: only `\\u` ranges", () => {
    expect(pattern).toMatch(/^\[\^(\\u[0-9A-F]{4}(-\\u[0-9A-F]{4})?)+\]$/);
  });

  it("for every BMP code point `c`, `new RegExp(pattern).test(c)` is false exactly when `c` is in the blank set and not `M` or `Cs`, with and without the `u` flag", () => {
    const plain = new RegExp(pattern);
    const unicode = new RegExp(pattern, "u");
    const wrong: string[] = [];
    for (let cp = 0; cp <= 0xffff; cp++) {
      const c = String.fromCharCode(cp);
      if (plain.test(c) === refusedByPattern(c)) wrong.push(`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
      // `u` reads a lone surrogate as one code point, and a lone surrogate is `Cs`: matched, as without the flag.
      if (unicode.test(c) === refusedByPattern(c)) wrong.push(`u:U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
    }
    expect(wrong).toEqual([]);
  });

  it("an astral character and `'\\u0301'` match the pattern", () => {
    const plain = new RegExp(pattern);
    const unicode = new RegExp(pattern, "u");
    for (const v of ["́", "\u{1F600}", "\u{E0001}", "\u{10000}", "\u{1D173}"]) {
      expect(plain.test(v), v).toBe(true);
      expect(unicode.test(v), v).toBe(true);
    }
    for (const v of ["", " ", "​", "ㅤ", "⠀", "﻿"]) {
      expect(plain.test(v), v).toBe(false);
    }
  });

  it("the pattern is a necessary condition: every string `parse` accepts matches it, and a value of combining marks only passes the pattern and fails `parse`", () => {
    const re = new RegExp(pattern);
    const S = s.string({ min: 1 });
    const code = fc.oneof(
      fc.integer({ min: 0, max: 0x24f }),
      fc.integer({ min: 0x2000, max: 0x3200 }),
      fc.integer({ min: 0, max: 0x10ffff }),
    );
    fc.assert(
      fc.property(fc.array(code, { minLength: 1, maxLength: 8 }), (cps) => {
        const v = cps.map((c) => String.fromCodePoint(c)).join("");
        if (S.parse(v).ok) expect(re.test(v)).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0x300, max: 0x36f }), { minLength: 1, maxLength: 6 }), (cps) => {
        const v = cps.map((c) => String.fromCharCode(c)).join("");
        expect(re.test(v)).toBe(true);
        expect(S.parse(v).ok).toBe(false);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
