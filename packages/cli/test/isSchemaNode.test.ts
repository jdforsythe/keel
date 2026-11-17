// isSchemaNode (k.schema node, read back from evaluated app code): accepted kind by kind, with the fields each kind
// needs, and refused for anything else. Seed 1337.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { isSchemaNode } from "../src/internal/isSchemaNode.ts";

const run = { seed: 1337, numRuns: 50 };
const str = { kind: "string", min: 0 };
const bool = { kind: "boolean" };

describe("isSchemaNode", () => {
  test("isSchemaNode refuses what is not a record, and a record whose kind is missing or unknown", () => {
    for (const x of [undefined, null, 0, "string", true, [], [str], () => str])
      expect(isSchemaNode(x), String(x)).toBe(false);
    for (const x of [{}, { kind: 1 }, { kind: "bogus" }, { kind: "String", min: 0 }, { kind: "" }, { min: 0 }])
      expect(isSchemaNode(x)).toBe(false);
  });

  test("string needs a numeric min and a max that is absent or numeric", () => {
    expect(isSchemaNode({ kind: "string", min: 0 })).toBe(true);
    expect(isSchemaNode({ kind: "string", min: 3, max: 9 })).toBe(true);
    expect(isSchemaNode({ kind: "string" })).toBe(false);
    expect(isSchemaNode({ kind: "string", min: "0" })).toBe(false);
    expect(isSchemaNode({ kind: "string", min: 0, max: "9" })).toBe(false);
    expect(isSchemaNode({ kind: "string", min: 0, max: null })).toBe(false);
    expect(isSchemaNode({ kind: "string", max: 9 })).toBe(false);
  });

  test("number and int take an absent or numeric min and max", () => {
    for (const kind of ["number", "int"]) {
      expect(isSchemaNode({ kind })).toBe(true);
      expect(isSchemaNode({ kind, min: 1 })).toBe(true);
      expect(isSchemaNode({ kind, max: 1 })).toBe(true);
      expect(isSchemaNode({ kind, min: 1, max: 2 })).toBe(true);
      expect(isSchemaNode({ kind, min: "1" })).toBe(false);
      expect(isSchemaNode({ kind, max: "2" })).toBe(false);
      expect(isSchemaNode({ kind, min: 1, max: "2" })).toBe(false);
      expect(isSchemaNode({ kind, min: "1", max: 2 })).toBe(false);
      expect(isSchemaNode({ kind, min: null })).toBe(false);
    }
  });

  test("boolean and json need nothing more", () => {
    expect(isSchemaNode({ kind: "boolean" })).toBe(true);
    expect(isSchemaNode({ kind: "json" })).toBe(true);
  });

  test("literal holds a string, number or boolean", () => {
    for (const value of ["a", "", 0, 1.5, true, false]) expect(isSchemaNode({ kind: "literal", value })).toBe(true);
    for (const value of [null, undefined, {}, [], 1n]) expect(isSchemaNode({ kind: "literal", value })).toBe(false);
    expect(isSchemaNode({ kind: "literal" })).toBe(false);
  });

  test("enum holds an array of strings", () => {
    expect(isSchemaNode({ kind: "enum", values: [] })).toBe(true);
    expect(isSchemaNode({ kind: "enum", values: ["a", "b"] })).toBe(true);
    expect(isSchemaNode({ kind: "enum", values: ["a", 1] })).toBe(false);
    expect(isSchemaNode({ kind: "enum", values: [1] })).toBe(false);
    expect(isSchemaNode({ kind: "enum", values: "ab" })).toBe(false);
    expect(isSchemaNode({ kind: "enum", values: { 0: "a", length: 1 } })).toBe(false);
    expect(isSchemaNode({ kind: "enum" })).toBe(false);
  });

  test("id holds a string brand", () => {
    expect(isSchemaNode({ kind: "id", brand: "User" })).toBe(true);
    expect(isSchemaNode({ kind: "id", brand: "" })).toBe(true);
    expect(isSchemaNode({ kind: "id", brand: 1 })).toBe(false);
    expect(isSchemaNode({ kind: "id" })).toBe(false);
  });

  test("object holds a record of schema nodes and a closed flag that is absent or boolean", () => {
    expect(isSchemaNode({ kind: "object", fields: {} })).toBe(true);
    expect(isSchemaNode({ kind: "object", fields: { a: str, b: bool } })).toBe(true);
    expect(isSchemaNode({ kind: "object", fields: { a: str }, closed: true })).toBe(true);
    expect(isSchemaNode({ kind: "object", fields: { a: str }, closed: false })).toBe(true);
    expect(isSchemaNode({ kind: "object", fields: { a: str }, closed: "yes" })).toBe(false);
    expect(isSchemaNode({ kind: "object", fields: { a: str }, closed: 1 })).toBe(false);
    expect(isSchemaNode({ kind: "object", fields: { a: str, b: { kind: "bogus" } } })).toBe(false);
    expect(isSchemaNode({ kind: "object", fields: { a: { kind: "string" } } })).toBe(false);
    expect(isSchemaNode({ kind: "object", fields: [str] })).toBe(false);
    expect(isSchemaNode({ kind: "object", fields: null })).toBe(false);
    expect(isSchemaNode({ kind: "object" })).toBe(false);
  });

  test("array and record hold one schema node, item and value", () => {
    expect(isSchemaNode({ kind: "array", item: str })).toBe(true);
    expect(isSchemaNode({ kind: "array", item: { kind: "x" } })).toBe(false);
    expect(isSchemaNode({ kind: "array", value: str })).toBe(false);
    expect(isSchemaNode({ kind: "array" })).toBe(false);
    expect(isSchemaNode({ kind: "record", value: bool })).toBe(true);
    expect(isSchemaNode({ kind: "record", value: { kind: "x" } })).toBe(false);
    expect(isSchemaNode({ kind: "record", item: bool })).toBe(false);
    expect(isSchemaNode({ kind: "record" })).toBe(false);
  });

  test("union holds a string key and an array of schema node variants", () => {
    expect(isSchemaNode({ kind: "union", key: "t", variants: [] })).toBe(true);
    expect(isSchemaNode({ kind: "union", key: "t", variants: [str, bool] })).toBe(true);
    expect(isSchemaNode({ kind: "union", key: "t", variants: [str, { kind: "x" }] })).toBe(false);
    expect(isSchemaNode({ kind: "union", key: 1, variants: [str] })).toBe(false);
    expect(isSchemaNode({ kind: "union", variants: [str] })).toBe(false);
    expect(isSchemaNode({ kind: "union", key: "t", variants: str })).toBe(false);
    expect(isSchemaNode({ kind: "union", key: "t" })).toBe(false);
  });

  test("anyOf holds an array of schema node members", () => {
    expect(isSchemaNode({ kind: "anyOf", members: [] })).toBe(true);
    expect(isSchemaNode({ kind: "anyOf", members: [str, bool] })).toBe(true);
    expect(isSchemaNode({ kind: "anyOf", members: [str, { kind: "x" }] })).toBe(false);
    expect(isSchemaNode({ kind: "anyOf", members: str })).toBe(false);
    expect(isSchemaNode({ kind: "anyOf", variants: [str] })).toBe(false);
    expect(isSchemaNode({ kind: "anyOf" })).toBe(false);
  });

  test("nullable, optional and secret hold one schema node as inner", () => {
    for (const kind of ["nullable", "optional", "secret"]) {
      expect(isSchemaNode({ kind, inner: str })).toBe(true);
      expect(isSchemaNode({ kind, inner: { kind: "x" } })).toBe(false);
      expect(isSchemaNode({ kind, inner: null })).toBe(false);
      expect(isSchemaNode({ kind, item: str })).toBe(false);
      expect(isSchemaNode({ kind })).toBe(false);
    }
  });

  test("format holds a string name and a schema node base", () => {
    expect(isSchemaNode({ kind: "format", name: "email", base: str })).toBe(true);
    expect(isSchemaNode({ kind: "format", name: "email", base: { kind: "x" } })).toBe(false);
    expect(isSchemaNode({ kind: "format", name: 1, base: str })).toBe(false);
    expect(isSchemaNode({ kind: "format", base: str })).toBe(false);
    expect(isSchemaNode({ kind: "format", name: "email" })).toBe(false);
    expect(isSchemaNode({ kind: "format", name: "email", inner: str })).toBe(false);
  });

  test("nesting is checked all the way down", () => {
    const deep = (leaf: unknown) => ({
      kind: "object",
      fields: {
        a: { kind: "array", item: { kind: "nullable", inner: { kind: "union", key: "t", variants: [leaf] } } },
      },
    });
    expect(isSchemaNode(deep(str))).toBe(true);
    expect(isSchemaNode(deep({ kind: "string" }))).toBe(false);
  });

  test("the node of each schema @keel/schema builds is a schema node", () => {
    const schemas = [
      s.string(),
      s.string({ min: 1, max: 5 }),
      s.int({ min: 0 }),
      s.boolean(),
      s.json(),
      s.object({ a: s.string(), b: s.array(s.int()) }, { closed: true }),
      s.record(s.string()),
      s.string().nullable(),
      s.string().optional(),
      s.string().pii("name"),
    ];
    for (const sc of schemas) expect(isSchemaNode(sc.node), JSON.stringify(sc.node)).toBe(true);
  });

  test("property: a generated node is accepted, and the same node under one bad child is refused", () => {
    const { node } = fc.letrec<{ node: unknown }>((tie) => ({
      node: fc.oneof(
        { depthSize: "small", maxDepth: 3 },
        fc.constant({ kind: "boolean" }),
        fc.constant({ kind: "json" }),
        fc.record({ kind: fc.constant("string"), min: fc.nat(10) }),
        fc.record({ kind: fc.constantFrom("int", "number"), min: fc.nat(10) }),
        fc.record({ kind: fc.constant("id"), brand: fc.string() }),
        fc.record({ kind: fc.constant("literal"), value: fc.oneof(fc.string(), fc.integer(), fc.boolean()) }),
        fc.record({ kind: fc.constant("enum"), values: fc.array(fc.string(), { maxLength: 3 }) }),
        fc.record({ kind: fc.constant("array"), item: tie("node") }),
        fc.record({ kind: fc.constant("record"), value: tie("node") }),
        fc.record({ kind: fc.constantFrom("nullable", "optional", "secret"), inner: tie("node") }),
        fc.record({ kind: fc.constant("anyOf"), members: fc.array(tie("node"), { maxLength: 2 }) }),
        fc.record({ kind: fc.constant("union"), key: fc.string(), variants: fc.array(tie("node"), { maxLength: 2 }) }),
        fc.record({
          kind: fc.constant("object"),
          fields: fc.dictionary(fc.string({ maxLength: 3 }), tie("node"), { maxKeys: 3 }),
        }),
        fc.record({ kind: fc.constant("format"), name: fc.string(), base: tie("node") }),
      ),
    }));
    const bad = { kind: "bogus" };
    fc.assert(
      fc.property(node, (n) => {
        expect(isSchemaNode(n)).toBe(true);
        expect(isSchemaNode({ kind: "array", item: n })).toBe(true);
        expect(isSchemaNode({ kind: "array", item: { kind: "optional", inner: bad } })).toBe(false);
        expect(isSchemaNode({ kind: "object", fields: { ok: n, bad } })).toBe(false);
        expect(isSchemaNode({ kind: "anyOf", members: [n, bad] })).toBe(false);
        expect(isSchemaNode({ kind: "union", key: "k", variants: [bad, n] })).toBe(false);
        expect(isSchemaNode({ kind: "format", name: "f", base: bad })).toBe(false);
      }),
      run,
    );
  });
});
