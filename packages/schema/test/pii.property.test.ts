// Seed 1337. k.privacy marks: properties beyond conformance.
import fc from "fast-check";
import { expect, test } from "vitest";
import { gen } from "../src/gen.ts";
import { type Schema, piiPaths, piiValues, s } from "../src/index.ts";

const opts = { seed: 1337, numRuns: 100 };

const leaf = fc.constantFrom<Schema<unknown>>(s.string(), s.int(), s.number(), s.boolean(), s.enum(["a", "b"]));
const unmarked: fc.Arbitrary<Schema<unknown>> = fc.letrec<{ node: Schema<unknown> }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    leaf,
    tie("node").map((n) => s.array(n)),
    tie("node").map((n) => s.record(n)),
    tie("node").map((n) => n.nullable()),
    fc.dictionary(fc.stringMatching(/^[a-z]{1,4}$/), tie("node"), { maxKeys: 3 }).map((shape) => s.object(shape)),
  ),
})).node;

test("piiValues of a value with no marked path is empty", () => {
  fc.assert(
    fc.property(
      unmarked.chain((schema) => fc.tuple(fc.constant(schema), gen(schema))),
      ([schema, value]) => {
        expect(piiPaths(schema)).toEqual([]);
        expect(piiValues(schema, schema.encode(value))).toEqual([]);
      },
    ),
    opts,
  );
});

test("a leaf under nested marks takes the nearest mark's class; the marked open object's `*` comes after its fields", () => {
  const schema = s.object({ a: s.object({ b: s.string().pii("contact"), c: s.int() }).pii("location") });
  expect(piiPaths(schema)).toEqual([
    { path: "a.b", class: "contact" },
    { path: "a.c", class: "location" },
    { path: "a.*", class: "location" },
  ]);
});

test("piiValues are distinct, and a secret's marker is not one", () => {
  const schema = s.object({ x: s.array(s.string()).pii("content"), k: s.secret(s.string()).pii("identifier") });
  expect(piiValues(schema, { x: ["a", "a", "b"], k: "[secret]" })).toEqual(["a", "b"]);
});

test("a mark survives .optional() and .nullable() in either order, and keeps a format's predicate", () => {
  const Even = s.format("even", s.int(), { check: (n) => n % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } });
  const schema = s.object({ a: s.string().optional().pii("name").nullable(), e: Even.pii("identifier") });
  expect(piiPaths(schema)).toEqual([
    { path: "a", class: "name" },
    { path: "e", class: "identifier" },
  ]);
  expect(schema.parse({ e: 3 }).ok).toBe(false);
  expect(schema.parse({ a: null, e: 4 }).ok).toBe(true);
  expect(schema.doc()).toBe("a?: string pii(name) | null\ne: even pii(identifier)");
});

test("union and record paths: variants share a path once; a record value is `*`", () => {
  const schema = s.object({
    u: s.union("t", [
      s.object({ t: s.literal("a"), v: s.string().pii("name") }),
      s.object({ t: s.literal("b"), v: s.string().pii("name") }),
    ]),
    r: s.record(s.int().pii("financial")),
  });
  expect(piiPaths(schema)).toEqual([
    { path: "u.v", class: "name" },
    { path: "r.*", class: "financial" },
  ]);
  expect(piiValues(schema, { u: { t: "b", v: "Ada" }, r: { x: 3 } })).toEqual(["Ada", "3"]);
});

test("a marked object keeps decodeStrings", () => {
  const schema = s.object({ n: s.int() }).pii("identifier");
  expect(schema.decodeStrings({ n: "4" })).toEqual(s.object({ n: s.int() }).decodeStrings({ n: "4" }));
  expect(schema.doc()).toBe("n: int pii(identifier)");
});

test("a marked record's keys are personal data, and so are a marked open object's undeclared keys and values", () => {
  const schema = s.object({ by: s.record(s.number()).pii("contact"), who: s.object({ id: s.int() }).pii("name") });
  const parsed = schema.parse({ by: { "bob@example.com": 3 }, who: { id: 1, nick: "bobby" } });
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect([...piiValues(schema, parsed.value)].sort()).toEqual(["1", "3", "bob@example.com", "bobby", "nick"].sort());
  const plain = s.object({ by: s.record(s.number()) });
  expect(piiValues(plain, { by: { "bob@example.com": 3 } })).toEqual([]);
});

const formatted = <T>(name: string, base: Schema<T>) =>
  s.format(name, base, { check: () => true, gen: { from: base, map: (v: T) => v } });
const markable: fc.Arbitrary<Schema<unknown>> = fc.letrec<{ node: Schema<unknown> }>((tie) => ({
  node: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    leaf,
    leaf.map((l) => l.pii("contact")),
    leaf.map((l) => formatted("F", l.pii("contact"))),
    leaf.map((l) => formatted("G", l).pii("identifier")),
    tie("node").map((n) => s.array(n)),
    tie("node").map((n) => s.record(n)),
    tie("node").map((n) => n.nullable()),
    tie("node").map((n) => formatted("H", n)),
    fc.dictionary(fc.stringMatching(/^[a-z]{1,4}$/), tie("node"), { maxKeys: 3 }).map((shape) => s.object(shape)),
  ),
})).node;

/** The strings and numbers of `value` under dotted `path` (`*` any array item or record value). */
const under = (value: unknown, path: readonly string[], out: Set<string>): void => {
  if (value === null || value === undefined) return;
  const [head, ...rest] = path;
  if (head === undefined) {
    const add = (x: unknown): void => {
      if (typeof x === "string" && x !== "") out.add(x);
      else if (typeof x === "number") out.add(String(x));
      else if (Array.isArray(x)) for (const v of x) add(v);
      else if (typeof x === "object" && x !== null)
        for (const [k, v] of Object.entries(x)) {
          add(k);
          add(v);
        }
    };
    add(value);
    return;
  }
  if (head === "*") {
    if (Array.isArray(value)) for (const v of value) under(v, rest, out);
    else if (typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        if (rest.length === 0) out.add(k);
        under(v, rest, out);
      }
  } else if (typeof value === "object" && !Array.isArray(value)) under(Reflect.get(value, head), rest, out);
};

test("every value piiValues returns lies under a path piiPaths lists, format nodes included", () => {
  fc.assert(
    fc.property(
      markable.chain((schema) => fc.tuple(fc.constant(schema), gen(schema))),
      ([schema, value]) => {
        const encoded = schema.encode(value);
        const covered = new Set<string>();
        for (const p of piiPaths(schema)) under(encoded, p.path === "" ? [] : p.path.split("."), covered);
        for (const v of piiValues(schema, encoded)) expect(covered).toContain(v);
      },
    ),
    opts,
  );
});

test("a mark inside a format's base is a path", () => {
  const schema = s.object({ e: formatted("E", s.string().pii("contact")) });
  expect(piiPaths(schema)).toEqual([{ path: "e", class: "contact" }]);
});
