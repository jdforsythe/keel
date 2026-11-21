// Spec: k.cli, clause "Each MCP tool's input schema equals the JSON Schema of its operation's input."
// An open s.object ignores undeclared keys in parse, so its JSON Schema omits `additionalProperties: false` (k.schema, rfc:0029:
// only closed objects add it); the schema and parse then agree on {"undeclared-extra-key":null}.
// Seed: 1337 (every fc.assert below). Drives the real binary (packages/cli/src/bin.ts) with `keel mcp`, one tools/list request.
// Equality is semantic: a small JSON Schema validator (below) throws on any keyword it does not implement, so no keyword is ignored.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { operations } from "@keel/cli";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const field = (v: unknown, name: string): unknown => (isDict(v) ? Reflect.get(v, name) : undefined);

const KEYWORDS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
  "anyOf",
  "oneOf",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
]);

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function isType(t: string, v: unknown): boolean {
  switch (t) {
    case "object":
      return isDict(v);
    case "array":
      return Array.isArray(v);
    case "string":
      return typeof v === "string";
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "integer":
      return typeof v === "number" && Number.isInteger(v);
    case "boolean":
      return typeof v === "boolean";
    case "null":
      return v === null;
    default:
      throw new Error(`validator: unknown type ${t}`);
  }
}

function validate(schema: unknown, v: unknown): boolean {
  if (schema === true) return true;
  if (schema === false) return false;
  if (!isDict(schema)) throw new Error(`validator: schema is not an object: ${JSON.stringify(schema)}`);
  for (const k of Object.keys(schema)) {
    if (!KEYWORDS.has(k)) throw new Error(`validator: unsupported keyword "${k}" in ${JSON.stringify(schema)}`);
  }
  const type = schema.type;
  if (type !== undefined) {
    const types = Array.isArray(type) ? type : [type];
    if (!types.some((t) => typeof t === "string" && isType(t, v))) return false;
  }
  if ("enum" in schema) {
    const e = schema.enum;
    if (!Array.isArray(e)) throw new Error("validator: enum is not an array");
    if (!e.some((x) => same(x, v))) return false;
  }
  if ("const" in schema && !same(schema.const, v)) return false;
  if (typeof v === "string") {
    if (typeof schema.minLength === "number" && [...v].length < schema.minLength) return false;
    if (typeof schema.maxLength === "number" && [...v].length > schema.maxLength) return false;
  }
  if (typeof v === "number") {
    if (typeof schema.minimum === "number" && v < schema.minimum) return false;
    if (typeof schema.maximum === "number" && v > schema.maximum) return false;
  }
  if (Array.isArray(v) && "items" in schema) {
    if (!v.every((x) => validate(schema.items, x))) return false;
  }
  if (isDict(v)) {
    const props = isDict(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const r of required) if (typeof r === "string" && !(r in v)) return false;
    for (const [k, x] of Object.entries(v)) {
      if (k in props) {
        if (!validate(props[k], x)) return false;
      } else if ("additionalProperties" in schema && !validate(schema.additionalProperties, x)) return false;
    }
  }
  if ("anyOf" in schema) {
    const a = schema.anyOf;
    if (!Array.isArray(a)) throw new Error("validator: anyOf is not an array");
    if (!a.some((s) => validate(s, v))) return false;
  }
  if ("oneOf" in schema) {
    const a = schema.oneOf;
    if (!Array.isArray(a)) throw new Error("validator: oneOf is not an array");
    if (a.filter((s) => validate(s, v)).length !== 1) return false;
  }
  return true;
}

let tools: { name: unknown; inputSchema: unknown }[] = [];

beforeAll(() => {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, "mcp"], {
    cwd: repo,
    encoding: "utf8",
    env,
    input: `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })}\n`,
  });
  const line = r.stdout.split("\n").find((l) => l.trim() !== "");
  if (line === undefined) throw new Error(`keel mcp printed nothing (status ${r.status}): ${r.stderr}`);
  const list = field(field(JSON.parse(line), "result"), "tools");
  tools = Array.isArray(list)
    ? list.map((t) => ({ name: field(t, "name"), inputSchema: field(t, "inputSchema") }))
    : [];
}, 60_000);

// Commands reserved for std packages (k.cli): present only when the repository fills them.
const STD_RESERVED: string[] = ["session", "report"];

const OTHERS: unknown[] = [null, true, 1.5, 7, "x", [], ["a"], {}, { a: 1 }];

describe("k.cli: MCP tool input schemas (real binary)", () => {
  it("Each MCP tool's input schema equals the JSON Schema of its operation's input: the tools list names every operation, in order", () => {
    // A repository module that depends on @keel/std-sessions fills the `session` slot (rfc:0070): it is listed after
    // the kernel operations, and its schema is checked with the others below.
    const names = tools.map((t) => String(t.name));
    expect(names.filter((n) => !STD_RESERVED.includes(n))).toEqual(operations.map((o) => o.name));
    // Each std-reserved command is absent or present exactly once, and nothing else is extra.
    for (const r of STD_RESERVED) expect(names.filter((n) => n === r).length).toBeLessThanOrEqual(1);
    expect(names.length).toBe(operations.length + names.filter((n) => STD_RESERVED.includes(n)).length);
    // Std-reserved tools come after the kernel operations.
    expect(names.slice(0, operations.length)).toEqual(operations.map((o) => o.name));
  });

  it("Each MCP tool's input schema equals the JSON Schema of its operation's input: the validator accepts only keywords it implements", () => {
    expect(() => validate({ type: "object", pattern: "x" }, {})).toThrow(/unsupported keyword/);
    for (const t of tools) expect(() => validate(t.inputSchema, {}), String(t.name)).not.toThrow();
  });

  it("Each MCP tool's input schema equals the JSON Schema of its operation's input: validating the tool's inputSchema agrees with parsing by the operation's input for every candidate", () => {
    expect(tools.filter((t) => !STD_RESERVED.includes(String(t.name))).length).toBe(operations.length);
    for (const op of operations) {
      const tool = tools.find((t) => t.name === op.name);
      const schema = tool?.inputSchema;
      expect(schema, op.name).toBeDefined();
      const valid = gen(op.input);
      const agree = (v: unknown): void => {
        const parsed = op.input.parse(v).ok;
        const validated = validate(schema, v);
        if (parsed !== validated) {
          throw new Error(
            `${op.name}: validate=${validated} parse=${parsed} value=${JSON.stringify(v)} inputSchema=${JSON.stringify(schema)}`,
          );
        }
      };
      const entries = (v: unknown): [string, unknown][] => (isDict(v) ? Object.entries(v) : []);
      const opts = { seed: 1337, numRuns: 100 };
      fc.assert(
        fc.property(valid, (v) => {
          expect(op.input.parse(v).ok, `${op.name}: generated value must parse`).toBe(true);
          agree(v);
        }),
        opts,
      );
      fc.assert(
        fc.property(valid, fc.nat(), (v, i) => {
          const e = entries(v);
          const drop = e.length === 0 ? undefined : e[i % e.length]?.[0];
          agree(Object.fromEntries(e.filter(([k]) => k !== drop)));
        }),
        opts,
      );
      fc.assert(
        fc.property(valid, fc.nat(), fc.constantFrom(...OTHERS), (v, i, other) => {
          const e = entries(v);
          const at = e.length === 0 ? undefined : e[i % e.length]?.[0];
          agree(Object.fromEntries(e.map(([k, x]) => [k, k === at ? other : x])));
        }),
        opts,
      );
      fc.assert(
        fc.property(valid, fc.constantFrom(...OTHERS), (v, other) => {
          agree({ ...Object.fromEntries(entries(v)), "undeclared-extra-key": other });
        }),
        opts,
      );
      fc.assert(
        fc.property(fc.jsonValue(), (v) => agree(v)),
        opts,
      );
    }
  }, 120_000);
});
