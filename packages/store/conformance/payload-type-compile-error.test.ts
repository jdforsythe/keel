// Spec: k.store, clause "A payload not assignable to the transaction's payload type is a compile error and an `unknown` one compiles."
// Seed 1337 (no random inputs: each case is a fixed call; the space under test is the type system).
// The TypeScript compiler is the oracle: one in-memory module, type-checked with packages/store/tsconfig.json, holds
// real `tx(...)` calls with no pinned type arguments and transactions whose types are inferred from their schemas, so
// any overload that admits a bad payload (or rejects an `unknown` one) turns a case red. No suppression comments.
import { fixedTime } from "@keel/tooling/test-time";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

const CLAUSE =
  "A payload not assignable to the transaction's payload type is a compile error and an `unknown` one compiles.";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROBE = path.join(HERE, "__payload_type_probe__.ts");

const PRELUDE = `import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
const Item = s.object({ sku: s.string(), qty: s.int() });
const cart = store(s.object({ items: s.array(Item) }), { items: [] });
const add = transaction(cart, "cart.addItem", s.object({ item: Item }), (st, { item }) => ({ ...st, items: [...st.items, item] }));
const pop = transaction(cart, "cart.pop", s.object({}), (st) => ({ ...st, items: st.items.slice(0, -1) }));
const item = { sku: "a", qty: 1 };
const addPayload = { item };
const popPayload = {};
const wider: { item: unknown } = { item: 1 };
const wire: unknown = { item };
export const probe = [add, pop, item, addPayload, popPayload, wider, wire, tx];
`;

interface Case {
  readonly name: string;
  readonly call: string;
}

const BAD: readonly Case[] = [
  { name: "wrong field type", call: "tx(add, { item: 1 })" },
  { name: "wrong nested field type", call: "tx(add, { item: { sku: 1, qty: 1 } })" },
  { name: "wrong nested field type (string for int)", call: `tx(add, { item: { sku: "a", qty: "1" } })` },
  { name: "missing required key", call: "tx(add, {})" },
  { name: "a string", call: `tx(add, "item")` },
  { name: "null", call: "tx(add, null)" },
  { name: "another transaction's payload", call: "tx(add, popPayload)" },
  { name: "a variable of a wider declared type", call: "tx(add, wider)" },
  { name: "a bad payload with a meta argument", call: `tx(add, { item: 1 }, { meta: { caller: "t" } })` },
];

const GOOD: readonly Case[] = [
  { name: "a fresh literal of the payload type", call: "tx(add, { item })" },
  { name: "a variable of the payload type", call: "tx(add, addPayload)" },
  { name: "the empty payload of an empty schema", call: "tx(pop, {})" },
  { name: "a good payload with a meta argument", call: `tx(add, { item }, { meta: { caller: "t" } })` },
  { name: "an `unknown` payload", call: "tx(add, wire)" },
  { name: "an `unknown` payload to another transaction", call: "tx(pop, wire)" },
  { name: "an `unknown` payload with a meta argument", call: `tx(add, wire, { meta: { caller: "t" } })` },
];

/** Line (0-based) of each case in the probe source, and the source itself. */
function probeSource(cases: readonly Case[]): { source: string; lines: number[] } {
  const base = PRELUDE.split("\n").length - 1;
  const body = cases.map((c, i) => `export const case${i} = ${c.call};`);
  return { source: `${PRELUDE}${body.join("\n")}\n`, lines: cases.map((_, i) => base + i) };
}

/** Error diagnostics of the probe, as 0-based line numbers with their message text. */
function typeErrors(source: string): { line: number; code: number; text: string }[] {
  const configPath = path.join(HERE, "../tsconfig.json");
  const read = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configPath));
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
    path.resolve(name) === PROBE
      ? ts.createSourceFile(name, source, languageVersion, true)
      : getSourceFile(name, languageVersion, onError, shouldCreate);
  host.fileExists = (name) => path.resolve(name) === PROBE || fileExists(name);
  host.readFile = (name) => (path.resolve(name) === PROBE ? source : readFile(name));
  const program = ts.createProgram([PROBE], options, host);
  const file = program.getSourceFile(PROBE);
  if (file === undefined) throw new Error("probe source file was not created");
  return ts
    .getPreEmitDiagnostics(program, file)
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => ({
      line: d.file === undefined || d.start === undefined ? -1 : d.file.getLineAndCharacterOfPosition(d.start).line,
      code: d.code,
      text: ts.flattenDiagnosticMessageText(d.messageText, " "),
    }));
}

describe(`k.store: ${CLAUSE}`, () => {
  const all = [...BAD, ...GOOD];
  const { source, lines } = probeSource(all);
  let errors: { line: number; code: number; text: string }[] = [];

  beforeAll(() => {
    errors = typeErrors(source);
  }, fixedTime(120_000));

  it("the probe's imports resolve and its prelude type-checks (every error is on a case line)", () => {
    expect(errors.filter((e) => e.code === 2307)).toEqual([]);
    expect(errors.filter((e) => !lines.includes(e.line))).toEqual([]);
  });

  BAD.forEach((c, i) => {
    it(`${CLAUSE} Compile error: ${c.name} (${c.call})`, () => {
      expect(errors.filter((e) => e.line === lines[i]).length, c.call).toBeGreaterThan(0);
    });
  });

  GOOD.forEach((c, j) => {
    it(`${CLAUSE} Compiles: ${c.name} (${c.call})`, () => {
      expect(errors.filter((e) => e.line === lines[BAD.length + j])).toEqual([]);
    });
  });
});

describe("k.store: an `unknown` payload is validated at run time", () => {
  const Item = s.object({ sku: s.string(), qty: s.int() });
  const box: { v: { add: ReturnType<typeof makeAdd> } | undefined } = { v: undefined };
  function makeAdd() {
    const cart = store(s.object({ items: s.array(Item) }), { items: [] }, { id: "conformance.payloadCompileRun" });
    return transaction(cart, "cart.addItem", s.object({ item: Item }), (st, { item }) => ({
      ...st,
      items: [...st.items, item],
    }));
  }
  scope(
    () => {
      box.v = { add: makeAdd() };
    },
    { detached: true },
  );

  it("a good `unknown` value commits and a bad one is schema.invalid", () => {
    const add = box.v?.add;
    if (add === undefined) throw new Error("scope body did not run");
    const good: unknown = { item: { sku: "a", qty: 1 } };
    const bad: unknown = { item: 1 };
    expect(tx(add, good).ok).toBe(true);
    const r = tx(add, bad, { meta: { caller: "wire" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("schema.invalid");
  });
});
