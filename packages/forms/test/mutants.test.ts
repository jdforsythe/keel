// @vitest-environment happy-dom
// Targeted examples pinning internals (coercion table, path helpers, message text, encoders) and form wiring.
// Property-based parts use fast-check seed 1337 (fixed for determinism).
import { effect, scope } from "@keel/reactive";
import { formHandle } from "@keel/router/internal";
import { type SchemaError, err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { form, messageFor, toFormData } from "../src/index.ts";
import type { Node } from "../src/internal/Node.ts";
import { coerceText } from "../src/internal/coerceText.ts";
import { describedBy } from "../src/internal/describedBy.ts";
import { documentOrder } from "../src/internal/documentOrder.ts";
import { encodeEntries } from "../src/internal/encodeEntries.ts";
import { fieldMessages } from "../src/internal/fieldMessages.ts";
import { fieldPathError } from "../src/internal/fieldPathError.ts";
import { formatValue } from "../src/internal/formatValue.ts";
import { getAt } from "../src/internal/getAt.ts";
import { issueMessages } from "../src/internal/issueMessages.ts";
import { nodeAt } from "../src/internal/nodeAt.ts";
import { readElement } from "../src/internal/readElement.ts";
import { setAt } from "../src/internal/setAt.ts";
import { splitPath } from "../src/internal/splitPath.ts";
import { unwrap } from "../src/internal/unwrap.ts";
import { withDefaults } from "../src/internal/withDefaults.ts";
import { withUnmapped } from "../src/internal/withUnmapped.ts";
import { without } from "../src/internal/without.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

type Issues = SchemaError["data"]["issues"];

const Tree = s.object({
  name: s.string({ min: 2, max: 5 }),
  age: s.int().optional(),
  note: s.string().nullable(),
  on: s.boolean(),
  tags: s.array(s.string()),
  rows: s.array(s.object({ n: s.string(), k: s.int() })),
  dict: s.record(s.int()),
  inner: s.object({ deep: s.object({ leaf: s.string() }) }),
  shape: s.union("t", [s.object({ t: s.literal("a"), x: s.int() }), s.object({ t: s.literal("b"), y: s.string() })]),
  mode: s.enum(["r", "g"]),
});
const root: Node = Tree.node;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("messageFor", () => {
  it("prints each rule with its constraint", () => {
    const str = s.string({ min: 1, max: 1 }).node;
    const str3 = s.string({ min: 3, max: 4 }).node;
    expect(messageFor(undefined, "required")).toBe("Required");
    expect(messageFor(undefined, "nullable-absent")).toBe("Required");
    expect(messageFor(undefined, "optional-null")).toBe("Must not be null");
    expect(messageFor(undefined, "finite")).toBe("Must be a finite number");
    expect(messageFor(undefined, "int")).toBe("Must be a whole number");
    expect(messageFor(str, "min")).toBe("Must be at least 1 character");
    expect(messageFor(str3, "min")).toBe("Must be at least 3 characters");
    expect(messageFor(s.string({ min: 0 }).node, "min")).toBe("Must be at least 0 characters");
    expect(messageFor(s.string({ min: 2 }).optional().node, "min")).toBe("Must be at least 2 characters");
    expect(messageFor(s.int({ min: 2 }).node, "min")).toBe("Required");
    expect(messageFor(undefined, "min")).toBe("Required");
    expect(messageFor(str, "max")).toBe("Must be at most 1 character");
    expect(messageFor(str3, "max")).toBe("Must be at most 4 characters");
    expect(messageFor(s.string().node, "max")).toBe("Too long");
    expect(messageFor(s.int({ max: 2 }).node, "max")).toBe("Too long");
    expect(messageFor(undefined, "max")).toBe("Too long");
    expect(messageFor(s.literal("x").node, "literal")).toBe('Must be "x"');
    expect(messageFor(s.literal(5).nullable().node, "literal")).toBe("Must be 5");
    expect(messageFor(s.string().node, "literal")).toBe("Invalid value");
    expect(messageFor(undefined, "literal")).toBe("Invalid value");
    expect(messageFor(s.enum(["a", "b"]).node, "enum")).toBe("Must be one of: a, b");
    expect(messageFor(s.string().node, "enum")).toBe("Invalid choice");
    expect(messageFor(undefined, "enum")).toBe("Invalid choice");
    expect(messageFor(undefined, "discriminant")).toBe("Invalid choice");
  });

  it("prints type issues by the schema kind under any wrappers", () => {
    expect(messageFor(s.number().node, "type")).toBe("Must be a number");
    expect(messageFor(s.int().optional().node, "type")).toBe("Must be a number");
    expect(messageFor(s.boolean().node, "type")).toBe("Must be true or false");
    expect(messageFor(s.string().nullable().node, "type")).toBe("Must be text");
    expect(messageFor(s.id("u").node, "type")).toBe("Must be text");
    expect(messageFor(s.enum(["p", "q"]).node, "type")).toBe("Must be one of: p, q");
    expect(messageFor(s.array(s.int()).node, "type")).toBe("Invalid value");
    expect(messageFor(s.literal("x").node, "type")).toBe("Invalid value");
    expect(messageFor(undefined, "type")).toBe("Invalid value");
  });
});

describe("coerceText", () => {
  const val = (value: unknown) => ({ kind: "value", value });
  const raw = (text: string) => ({ kind: "raw", text });

  it("empty text: optional is absent, nullable null, string empty, anything else absent", () => {
    expect(coerceText(s.int().optional().node, "")).toEqual({ kind: "absent" });
    expect(coerceText(s.string().optional().node, "")).toEqual({ kind: "absent" });
    expect(coerceText(s.string().nullable().node, "")).toEqual(val(null));
    expect(coerceText(s.int().nullable().node, "")).toEqual(val(null));
    expect(coerceText(s.string().nullable().optional().node, "")).toEqual({ kind: "absent" });
    expect(coerceText(s.string().node, "")).toEqual(val(""));
    expect(coerceText(s.id("a").node, "")).toEqual({ kind: "absent" });
    expect(coerceText(s.int().node, "")).toEqual({ kind: "absent" });
    expect(coerceText(s.boolean().node, "")).toEqual({ kind: "absent" });
    expect(coerceText(s.enum(["a"]).node, "")).toEqual({ kind: "absent" });
  });

  it("text kinds keep the text, numbers parse a strict numeric grammar", () => {
    expect(coerceText(s.string().node, " a b ")).toEqual(val(" a b "));
    expect(coerceText(s.id("a").node, "x1")).toEqual(val("x1"));
    for (const [t, n] of [
      ["0", 0],
      ["12", 12],
      ["+3", 3],
      ["-3", -3],
      ["1.5", 1.5],
      ["-1.5", -1.5],
      ["1.", 1],
      [".5", 0.5],
      ["-.5", -0.5],
      ["1e3", 1000],
      ["1E3", 1000],
      ["1e+3", 1000],
      ["1e-3", 0.001],
      ["2.5e2", 250],
    ] as const) {
      expect(coerceText(s.number().node, t)).toEqual(val(n));
      expect(coerceText(s.int().node, t)).toEqual(val(n));
    }
    for (const t of [
      "abc",
      "1x",
      "x1",
      "1.2.3",
      ".",
      "-",
      "+",
      "1e",
      "e3",
      " 1",
      "1 ",
      "0x10",
      "1,5",
      "--1",
      "1e3.5",
      "Infinity",
      "NaN",
    ]) {
      expect(coerceText(s.number().node, t)).toEqual(raw(t));
      expect(coerceText(s.int().optional().node, t)).toEqual(raw(t));
    }
    expect(coerceText(s.number().nullable().node, "7")).toEqual(val(7));
  });

  it("booleans, literals and enums", () => {
    for (const t of ["true", "on", "1"]) expect(coerceText(s.boolean().node, t)).toEqual(val(true));
    for (const t of ["false", "off", "0"]) expect(coerceText(s.boolean().node, t)).toEqual(val(false));
    for (const t of ["yes", "TRUE", "no", "2", " on"]) expect(coerceText(s.boolean().node, t)).toEqual(raw(t));
    expect(coerceText(s.literal("a").node, "a")).toEqual(val("a"));
    expect(coerceText(s.literal("a").node, "b")).toEqual(raw("b"));
    expect(coerceText(s.literal(5).node, "5")).toEqual(val(5));
    expect(coerceText(s.literal(5).node, "6")).toEqual(raw("6"));
    expect(coerceText(s.literal(true).node, "true")).toEqual(val(true));
    expect(coerceText(s.enum(["a", "b"]).node, "b")).toEqual(val("b"));
    expect(coerceText(s.enum(["a", "b"]).node, "c")).toEqual(raw("c"));
    expect(coerceText(s.enum(["a", "b"]).optional().node, "a")).toEqual(val("a"));
    expect(coerceText(s.array(s.string()).node, "x")).toEqual(raw("x"));
    expect(coerceText(s.object({}).node, "x")).toEqual(raw("x"));
    expect(coerceText(s.record(s.int()).node, "x")).toEqual(raw("x"));
  });

  it("numbers round-trip through formatValue (property)", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        expect(coerceText(s.number().node, formatValue(n))).toEqual(val(n));
      }),
    );
  });
});

describe("small helpers", () => {
  it("unwrap strips every wrapper", () => {
    expect(unwrap(s.int().optional().nullable().node).kind).toBe("int");
    expect(unwrap(s.int().nullable().optional().node).kind).toBe("int");
    expect(unwrap(s.int().node).kind).toBe("int");
    expect(unwrap(s.array(s.int()).node).kind).toBe("array");
  });

  it("formatValue", () => {
    expect(formatValue(undefined)).toBe("");
    expect(formatValue(null)).toBe("");
    expect(formatValue(0)).toBe("0");
    expect(formatValue(-0)).toBe("-0");
    expect(formatValue(1.5)).toBe("1.5");
    expect(formatValue("x")).toBe("x");
    expect(formatValue("")).toBe("");
    expect(formatValue(true)).toBe("true");
    expect(formatValue(false)).toBe("false");
    expect(formatValue({})).toBe("");
    expect(formatValue([1])).toBe("");
  });

  it("splitPath and without", () => {
    expect(splitPath("")).toEqual([]);
    expect(splitPath("a")).toEqual(["a"]);
    expect(splitPath("a.0.b")).toEqual(["a", "0", "b"]);
    const rec = { a: "1", b: "2" };
    expect(without(rec, "a")).toEqual({ b: "2" });
    expect(without(rec, "zz")).toEqual(rec);
    expect(rec).toEqual({ a: "1", b: "2" });
    expect(Object.keys(without(rec, "b"))).toEqual(["a"]);
  });

  it("fieldMessages keeps only string entries of a record", () => {
    expect(fieldMessages({ a: "x", b: 1, c: null, d: "y" })).toEqual({ a: "x", d: "y" });
    expect(fieldMessages(null)).toEqual({});
    expect(fieldMessages("str")).toEqual({});
    expect(fieldMessages(["a"])).toEqual({});
    expect(fieldMessages(undefined)).toEqual({});
  });

  it("fieldPathError names the path, truncating past 60 characters", () => {
    const e = fieldPathError("nope");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("E1902");
    expect(e.see).toBe("k.forms");
    expect(e.message).toBe('E1902 field path "nope" is not in the schema');
    const p60 = "a".repeat(60);
    expect(fieldPathError(p60).message).toBe(`E1902 field path ${JSON.stringify(p60)} is not in the schema`);
    const p61 = "a".repeat(61);
    expect(fieldPathError(p61).message).toBe(
      `E1902 field path ${JSON.stringify(`${"a".repeat(57)}...`)} is not in the schema`,
    );
  });

  it("describedBy adds, removes and de-duplicates ids", () => {
    const el = document.createElement("input");
    describedBy(el, "e", true);
    expect(el.getAttribute("aria-describedby")).toBe("e");
    describedBy(el, "e", true);
    expect(el.getAttribute("aria-describedby")).toBe("e");
    el.setAttribute("aria-describedby", "  h1   h2 ");
    describedBy(el, "e", true);
    expect(el.getAttribute("aria-describedby")).toBe("h1 h2 e");
    describedBy(el, "e", false);
    expect(el.getAttribute("aria-describedby")).toBe("h1 h2");
    el.setAttribute("aria-describedby", "e");
    describedBy(el, "e", false);
    expect(el.hasAttribute("aria-describedby")).toBe(false);
    describedBy(el, "e", false);
    expect(el.hasAttribute("aria-describedby")).toBe(false);
  });

  it("documentOrder sorts by position and is 0 for the same element", () => {
    const a = document.createElement("i");
    const b = document.createElement("i");
    const c = document.createElement("i");
    document.body.append(a, b, c);
    expect(documentOrder(a, a)).toBe(0);
    expect(documentOrder(a, b)).toBe(-1);
    expect(documentOrder(b, a)).toBe(1);
    expect([c, a, b].sort(documentOrder)).toEqual([a, b, c]);
  });

  it("withDefaults fills absent required booleans, recursing into present objects", () => {
    const n = s.object({
      on: s.boolean(),
      opt: s.boolean().optional(),
      o: s.object({ z: s.boolean(), w: s.string() }),
      t: s.string(),
    }).node;
    expect(withDefaults(n, {})).toEqual({ on: false });
    expect(withDefaults(n, { o: {} })).toEqual({ on: false, o: { z: false } });
    expect(withDefaults(n, { on: true, o: { z: true, w: "k" }, t: "q" })).toEqual({
      on: true,
      o: { z: true, w: "k" },
      t: "q",
    });
    expect(withDefaults(n, { opt: true })).toEqual({ on: false, opt: true });
    expect(withDefaults(n, { o: "junk" })).toEqual({ on: false, o: "junk" });
    const input = {};
    withDefaults(n, input);
    expect(input).toEqual({});
    expect(withDefaults(n, 5)).toBe(5);
    const arr: unknown[] = [];
    expect(withDefaults(n, arr)).toBe(arr);
    expect(withDefaults(s.string().node, {})).toEqual({});
    expect(withDefaults(s.boolean().node, undefined)).toBeUndefined();
  });
});

describe("nodeAt and getAt", () => {
  it("walks objects, arrays, records, unions and wrappers", () => {
    expect(nodeAt(root, [])).toBe(root);
    expect(nodeAt(root, ["name"])?.kind).toBe("string");
    expect(nodeAt(root, ["age"])?.kind).toBe("optional");
    expect(nodeAt(root, ["inner", "deep", "leaf"])?.kind).toBe("string");
    expect(nodeAt(root, ["tags", "0"])?.kind).toBe("string");
    expect(nodeAt(root, ["tags", 12])?.kind).toBe("string");
    expect(nodeAt(root, ["rows", "3", "k"])?.kind).toBe("int");
    expect(nodeAt(root, ["dict", "anything"])?.kind).toBe("int");
    expect(nodeAt(root, ["shape", "t"])?.kind).toBe("literal");
    expect(nodeAt(root, ["shape", "x"])?.kind).toBe("int");
    expect(nodeAt(root, ["shape", "y"])?.kind).toBe("string");
    expect(nodeAt(s.object({ a: s.object({ b: s.int() }).optional() }).node, ["a", "b"])?.kind).toBe("int");
    expect(nodeAt(s.object({ a: s.array(s.int()).nullable() }).node, ["a", "0"])?.kind).toBe("int");
  });

  it("rejects paths outside the schema", () => {
    for (const p of [
      ["nope"],
      ["constructor"],
      ["toString"],
      ["__proto__"],
      ["name", "x"],
      ["on", "x"],
      ["tags", "x"],
      ["tags", "01"],
      ["tags", "-1"],
      ["tags", "1.5"],
      ["tags", ""],
      ["tags", " 1"],
      ["tags", "1 "],
      ["tags", "1x"],
      ["dict", ""],
      ["shape", "z"],
      ["shape", "constructor"],
      ["nope", "deeper", "still"],
      ["mode", "r"],
    ])
      expect(nodeAt(root, p)).toBeUndefined();
    expect(nodeAt(root, ["tags", "10"])?.kind).toBe("string");
    expect(nodeAt(root, ["tags", "0"])?.kind).toBe("string");
  });

  it("getAt reads own keys and indices, undefined elsewhere", () => {
    const v = { a: { b: [10, { c: "x" }] }, z: undefined };
    expect(getAt(v, [])).toBe(v);
    expect(getAt(v, ["a", "b", "0"])).toBe(10);
    expect(getAt(v, ["a", "b", "1", "c"])).toBe("x");
    expect(getAt(v, ["a", "b", "2"])).toBeUndefined();
    expect(getAt(v, ["a", "q", "c"])).toBeUndefined();
    expect(getAt(v, ["toString"])).toBeUndefined();
    expect(getAt(v, ["a", "b", "0", "x"])).toBeUndefined();
    expect(getAt(null, ["a"])).toBeUndefined();
    expect(getAt("str", ["length"])).toBeUndefined();
  });
});

const lenAt = (v: unknown): number => {
  const a = getAt(v, ["tags"]);
  return Array.isArray(a) ? a.length : -1;
};

describe("setAt", () => {
  it("returns the value itself for an empty path", () => {
    expect(setAt(root, { a: 1 }, [], "n")).toBe("n");
  });

  it("creates containers by schema kind and never mutates its input", () => {
    expect(setAt(root, undefined, ["inner", "deep", "leaf"], "x")).toEqual({ inner: { deep: { leaf: "x" } } });
    const rows = setAt(root, undefined, ["rows", "0", "n"], "x");
    expect(rows).toEqual({ rows: [{ n: "x" }] });
    expect(Array.isArray(getAt(rows, ["rows"]))).toBe(true);
    expect(setAt(root, undefined, ["dict", "k"], 3)).toEqual({ dict: { k: 3 } });
    expect(setAt(root, undefined, ["tags", "0"], "t")).toEqual({ tags: ["t"] });
    expect(setAt(root, undefined, ["name"], "x")).toEqual({ name: "x" });
    expect(Array.isArray(setAt(root, undefined, ["name"], "x"))).toBe(false);
    const before = { name: "keep", tags: ["a"], inner: { deep: { leaf: "l", other: 1 } } };
    const snapshot = structuredClone(before);
    const after = setAt(root, before, ["inner", "deep", "leaf"], "new");
    expect(before).toEqual(snapshot);
    expect(after).toEqual({ name: "keep", tags: ["a"], inner: { deep: { leaf: "new", other: 1 } } });
    const t2 = setAt(root, before, ["tags", "1"], "b");
    expect(t2).toEqual({ name: "keep", tags: ["a", "b"], inner: before.inner });
    expect(before.tags).toEqual(["a"]);
  });

  it("replaces non-container junk on the path", () => {
    expect(setAt(root, { inner: "junk" }, ["inner", "deep", "leaf"], "x")).toEqual({ inner: { deep: { leaf: "x" } } });
    expect(setAt(root, { tags: "junk" }, ["tags", "0"], "x")).toEqual({ tags: ["x"] });
    expect(setAt(root, { tags: { 0: "obj" } }, ["tags", "0"], "x")).toEqual({ tags: ["x"] });
    expect(setAt(root, ["arr"], ["name"], "x")).toEqual({ name: "x" });
  });

  it("undefined removes: object keys deleted, last array item popped, middle item blanked", () => {
    expect(setAt(root, { name: "a", on: true }, ["name"], undefined)).toEqual({ on: true });
    expect(Object.keys(setAt(root, { name: "a", on: true }, ["name"], undefined) ?? {})).toEqual(["on"]);
    const popped = setAt(root, { tags: ["a", "b", "c"] }, ["tags", "2"], undefined);
    expect(getAt(popped, ["tags"])).toEqual(["a", "b"]);
    const blanked = setAt(root, { tags: ["a", "b", "c"] }, ["tags", "1"], undefined);
    expect(getAt(blanked, ["tags"])).toEqual(["a", undefined, "c"]);
    expect(lenAt(blanked)).toBe(3);
    const first = setAt(root, { tags: ["a", "b"] }, ["tags", "0"], undefined);
    expect(lenAt(first)).toBe(2);
    const gap = setAt(root, { tags: [] }, ["tags", "2"], "z");
    expect(lenAt(gap)).toBe(3);
    const only = setAt(root, { tags: ["a"] }, ["tags", "0"], undefined);
    expect(getAt(only, ["tags"])).toEqual([]);
  });

  it("ignores paths outside the schema (drops the key)", () => {
    expect(setAt(root, { name: "a" }, ["bogus"], "v")).toEqual({ name: "a" });
    expect(setAt(root, { name: "a" }, ["bogus", "deeper"], "v")).toEqual({ name: "a" });
    expect(setAt(root, { name: "a", bogus: 1 }, ["bogus"], "v")).toEqual({ name: "a" });
  });

  it("set then get returns the value for valid leaf paths (property)", () => {
    const paths = [
      ["name"],
      ["inner", "deep", "leaf"],
      ["rows", "0", "n"],
      ["rows", "2", "k"],
      ["dict", "a"],
      ["tags", "0"],
      ["shape", "x"],
    ] as const;
    fc.assert(
      fc.property(fc.constantFrom(...paths), fc.oneof(fc.string(), fc.integer()), (p, v) => {
        const out = setAt(root, undefined, p, v);
        expect(getAt(out, p)).toBe(v);
        expect(getAt(setAt(root, out, p, undefined), p)).toBeUndefined();
      }),
    );
  });
});

describe("withUnmapped", () => {
  it("leaves covered messages alone", () => {
    const msgs = { a: "A", "b.c": "BC", d: "D" };
    expect(withUnmapped(msgs, ["a", "b.c", "d"])).toEqual(msgs);
    expect(withUnmapped({ b: "B" }, ["b.c"])).toEqual({ b: "B" });
    expect(withUnmapped({ "b.c.d": "X" }, new Set(["b.c"]))).toEqual({ "b.c.d": "X" });
    expect(withUnmapped({}, [])).toEqual({});
  });

  it("summarises uncovered messages under '' with a count of the rest", () => {
    expect(withUnmapped({ x: "X" }, ["a"])).toEqual({ x: "X", "": "x: X" });
    expect(withUnmapped({ x: "X", y: "Y" }, ["a"])).toEqual({ x: "X", y: "Y", "": "x: X (+1 more)" });
    expect(withUnmapped({ x: "X", y: "Y", z: "Z" }, ["a"])[""]).toBe("x: X (+2 more)");
    expect(withUnmapped({ x: "X" }, [])[""]).toBe("x: X");
  });

  it("prefix coverage requires a dot boundary", () => {
    expect(withUnmapped({ ab: "AB" }, ["a"])[""]).toBe("ab: AB");
    expect(withUnmapped({ a: "A" }, ["ab"])[""]).toBe("a: A");
    expect(withUnmapped({ "a.b": "AB" }, ["a.bc"])[""]).toBe("a.b: AB");
    expect(withUnmapped({ "a.bc": "ABC" }, ["a.b"])[""]).toBe("a.bc: ABC");
    expect(withUnmapped({ "a.b": "AB" }, ["a"])[""]).toBeUndefined();
    expect(withUnmapped({ a: "A" }, ["a.b"])[""]).toBeUndefined();
  });

  it("appends to an existing '' entry and does not mutate its input", () => {
    const msgs = { "": "root", x: "X" };
    const out = withUnmapped(msgs, ["a"]);
    expect(out[""]).toBe("root; x: X");
    expect(msgs).toEqual({ "": "root", x: "X" });
    expect(withUnmapped({ "": "only" }, ["a"])).toEqual({ "": "only" });
    expect(withUnmapped({ "": "only" }, [])).toEqual({ "": "only" });
  });
});

describe("issueMessages", () => {
  const issue = (path: (string | number)[], rule: Issues[number]["rule"]): Issues[number] => ({ path, rule });

  it("keys by dotted path with the first issue winning", () => {
    expect(issueMessages(root, [issue(["name"], "min"), issue(["name"], "max")], [])).toEqual({
      name: "Must be at least 2 characters",
    });
    expect(issueMessages(root, [issue(["rows", 1, "k"], "type")], [])).toEqual({ "rows.1.k": "Must be a number" });
    expect(issueMessages(root, [], ["name"])).toEqual({});
  });

  it("an issue on a container is reported on known paths beneath it, not overriding their own", () => {
    const issues = [issue(["inner", "deep", "leaf"], "type"), issue(["inner"], "required")];
    expect(issueMessages(root, issues, ["inner.deep.leaf", "inner.other", "innerx", "name"])).toEqual({
      "inner.deep.leaf": "Must be text",
      inner: "Required",
      "inner.other": "Required",
    });
    expect(issueMessages(root, [issue(["inner"], "required")], ["inner"])).toEqual({ inner: "Required" });
  });

  it("a root issue is reported on every known path that has no message", () => {
    expect(issueMessages(root, [issue(["name"], "min"), issue([], "type")], ["name", "age"])).toEqual({
      name: "Must be at least 2 characters",
      "": "Invalid value",
      age: "Invalid value",
    });
  });
});

describe("encodeEntries and toFormData", () => {
  const collect = (node: Node, x: unknown, key = ""): [string, string][] => {
    const out: [string, string][] = [];
    encodeEntries(node, key, x, (k, v) => out.push([k, v]));
    return out;
  };

  it("omits undefined and encodes scalars as text", () => {
    expect(collect(s.string().node, undefined, "k")).toEqual([]);
    expect(collect(s.string().node, "v", "k")).toEqual([["k", "v"]]);
    expect(collect(s.int().node, 5, "k")).toEqual([["k", "5"]]);
    expect(collect(s.boolean().node, false, "k")).toEqual([["k", "false"]]);
    expect(collect(s.literal("a").node, "a", "k")).toEqual([["k", "a"]]);
    expect(collect(s.string().optional().node, "v", "k")).toEqual([["k", "v"]]);
    expect(collect(s.string().optional().node, undefined, "k")).toEqual([]);
    expect(collect(s.string().nullable().node, null, "k")).toEqual([["k", ""]]);
    expect(collect(s.string().nullable().node, "v", "k")).toEqual([["k", "v"]]);
    expect(collect(s.string().optional().nullable().node, null, "k")).toEqual([["k", ""]]);
  });

  it("arrays of leaves repeat the key; other arrays use indexed dotted keys", () => {
    expect(collect(s.array(s.string()).node, ["a", "b"], "k")).toEqual([
      ["k", "a"],
      ["k", "b"],
    ]);
    expect(collect(s.array(s.number()).node, [1, 2], "k")).toEqual([
      ["k", "1"],
      ["k", "2"],
    ]);
    expect(collect(s.array(s.int()).node, [1], "k")).toEqual([["k", "1"]]);
    expect(collect(s.array(s.boolean()).node, [true], "k")).toEqual([["k", "true"]]);
    expect(collect(s.array(s.literal("l")).node, ["l"], "k")).toEqual([["k", "l"]]);
    expect(collect(s.array(s.enum(["e"])).node, ["e"], "k")).toEqual([["k", "e"]]);
    expect(collect(s.array(s.id("b")).node, ["i1"], "k")).toEqual([["k", "i1"]]);
    expect(collect(s.array(s.string().nullable()).node, [null, "x"], "k")).toEqual([
      ["k", ""],
      ["k", "x"],
    ]);
    expect(collect(s.array(s.object({ n: s.string() })).node, [{ n: "a" }, { n: "b" }], "k")).toEqual([
      ["k.0.n", "a"],
      ["k.1.n", "b"],
    ]);
    expect(collect(s.array(s.array(s.int())).node, [[1, 2], [3]], "k")).toEqual([
      ["k.0", "1"],
      ["k.0", "2"],
      ["k.1", "3"],
    ]);
    expect(collect(s.array(s.string()).node, [], "k")).toEqual([]);
    expect(collect(s.array(s.string()).node, "notarray", "k")).toEqual([]);
    expect(collect(s.array(s.string()).node, { 0: "a" }, "k")).toEqual([]);
  });

  it("objects, records and unions nest with dotted keys; mismatched shapes encode nothing", () => {
    expect(collect(s.object({ a: s.int(), b: s.string().optional() }).node, { a: 1 })).toEqual([["a", "1"]]);
    expect(collect(s.object({ a: s.int() }).node, { a: 1 }, "p")).toEqual([["p.a", "1"]]);
    expect(collect(s.object({ a: s.int() }).node, "x", "p")).toEqual([]);
    expect(collect(s.object({ a: s.int() }).node, [1], "p")).toEqual([]);
    expect(collect(s.object({ a: s.int() }).node, null, "p")).toEqual([]);
    expect(collect(s.record(s.int()).node, { x: 1, y: 2 }, "m")).toEqual([
      ["m.x", "1"],
      ["m.y", "2"],
    ]);
    expect(collect(s.record(s.int()).node, { x: 1 })).toEqual([["x", "1"]]);
    expect(collect(s.record(s.int()).node, 5, "m")).toEqual([]);
    expect(collect(s.record(s.int()).node, [1], "m")).toEqual([]);
    const u = s.union("t", [
      s.object({ t: s.literal("a"), x: s.int() }),
      s.object({ t: s.literal("b"), y: s.string() }),
    ]);
    expect(collect(u.node, { t: "a", x: 1 }, "u")).toEqual([
      ["u.t", "a"],
      ["u.x", "1"],
    ]);
    expect(collect(u.node, { t: "b", y: "q" }, "u")).toEqual([
      ["u.t", "b"],
      ["u.y", "q"],
    ]);
    expect(collect(u.node, { t: "c", y: "q" }, "u")).toEqual([]);
    expect(collect(u.node, "a", "u")).toEqual([]);
    expect(collect(u.node, [], "u")).toEqual([]);
    expect(collect(u.node, null, "u")).toEqual([]);
    const loose = s.union("t", [s.object({ t: s.literal("a") })]);
    expect(collect(loose.node, { t: undefined }, "u")).toEqual([]);
  });

  it("toFormData encodes a whole tree and throws on invalid values", () => {
    const value = {
      name: "abc",
      note: null,
      on: true,
      tags: ["a", "b"],
      rows: [{ n: "r", k: 2 }],
      dict: { q: 1 },
      inner: { deep: { leaf: "l" } },
      shape: { t: "a" as const, x: 4 },
      mode: "g" as const,
    };
    const fd = toFormData(Tree, value);
    expect([...fd.entries()]).toEqual([
      ["name", "abc"],
      ["note", ""],
      ["on", "true"],
      ["tags", "a"],
      ["tags", "b"],
      ["rows.0.n", "r"],
      ["rows.0.k", "2"],
      ["dict.q", "1"],
      ["inner.deep.leaf", "l"],
      ["shape.t", "a"],
      ["shape.x", "4"],
      ["mode", "g"],
    ]);
    expect(() => toFormData(Tree, { ...value, name: "" })).toThrow(
      /^toFormData: value does not fit the schema \(.+\)$/,
    );
  });

  it("round-trips generated flat values through decodeStrings (property)", () => {
    const Flat = s.object({
      a: s.string({ min: 1 }),
      b: s.int(),
      c: s.boolean(),
      d: s.array(s.string({ min: 1 })),
      e: s.string().optional(),
    });
    fc.assert(
      fc.property(
        fc.record({
          a: fc.string({ minLength: 1 }),
          b: fc.integer(),
          c: fc.boolean(),
          d: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
        }),
        (v) => {
          expect(Flat.decodeStrings(toFormData(Flat, v))).toEqual(ok(v));
        },
      ),
    );
  });
});

const opt = (value: string): HTMLOptionElement => {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = value;
  return o;
};

describe("readElement", () => {
  const input = (type: string, value = "", checked = false): HTMLInputElement => {
    const el = document.createElement("input");
    el.type = type;
    if (value !== "") el.value = value;
    el.checked = checked;
    return el;
  };

  it("checkbox: boolean fields read checked, others the value when checked else absent", () => {
    expect(readElement(input("checkbox", "", true), s.boolean().node)).toEqual({ kind: "value", value: true });
    expect(readElement(input("checkbox", "", false), s.boolean().node)).toEqual({ kind: "value", value: false });
    expect(readElement(input("checkbox", "", false), s.boolean().optional().node)).toEqual({
      kind: "value",
      value: false,
    });
    expect(readElement(input("checkbox", "yes", true), s.string().node)).toEqual({ kind: "value", value: "yes" });
    expect(readElement(input("checkbox", "yes", false), s.string().node)).toEqual({ kind: "absent" });
    expect(readElement(input("checkbox", "3", true), s.int().node)).toEqual({ kind: "value", value: 3 });
  });

  it("radio: unchecked speaks for nothing; checked reads its value", () => {
    expect(readElement(input("radio", "a", false), s.enum(["a", "b"]).node)).toBeUndefined();
    expect(readElement(input("radio", "a", true), s.enum(["a", "b"]).node)).toEqual({ kind: "value", value: "a" });
    expect(readElement(input("radio", "z", true), s.enum(["a", "b"]).node)).toEqual({ kind: "raw", text: "z" });
  });

  it("text, select and textarea read their value", () => {
    expect(readElement(input("text", "5"), s.int().node)).toEqual({ kind: "value", value: 5 });
    expect(readElement(input("text", "x"), s.int().node)).toEqual({ kind: "raw", text: "x" });
    const ta = document.createElement("textarea");
    ta.value = "hey";
    expect(readElement(ta, s.string().node)).toEqual({ kind: "value", value: "hey" });
    const sel = document.createElement("select");
    sel.append(opt("a"), opt("b"));
    sel.value = "b";
    expect(readElement(sel, s.enum(["a", "b"]).node)).toEqual({ kind: "value", value: "b" });
  });
});

describe("form wiring", () => {
  const Flat = s.object({
    title: s.string({ min: 1 }),
    age: s.int().optional(),
    note: s.string().nullable(),
    on: s.boolean(),
    mode: s.enum(["r", "g"]).optional(),
    pick: s.string().optional(),
    c: s.object({ d: s.string({ min: 1 }) }),
  });
  const mk = (type = "text"): HTMLInputElement => {
    const el = document.createElement("input");
    el.type = type;
    document.body.append(el);
    return el;
  };
  const typeInto = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, text: string): void => {
    el.value = text;
    el.dispatchEvent(new Event("input"));
  };
  const within = <R>(fn: () => R): R => {
    let out: { v: R } | undefined;
    const sc = scope(() => {
      out = { v: fn() };
    });
    // Disposal happens in afterEach through the DOM teardown; keep the scope alive for the test body.
    scopes.push(sc);
    if (out === undefined) throw new Error("within");
    return out.v;
  };
  const scopes: { dispose(): void }[] = [];
  afterEach(() => {
    for (const sc of scopes.splice(0)) sc.dispose();
  });

  it("form ids derive from the schema shape and explicit id; concurrent duplicates get a suffix", () => {
    const both = within(() => ({ a: form(Flat), b: form(Flat) }));
    const { a, b } = both;
    expect(a.field("title").id).toMatch(/^form-[0-9a-z]+:title$/);
    expect(a.field("title").errorId).toBe(`${a.field("title").id}:error`);
    expect(b.field("title").id).toBe(a.field("title").id.replace(":title", "~2:title"));
    expect(within(() => form(Flat, { id: "orders.edit" })).field("c.d").id).toBe("orders.edit:c.d");
    expect(a.field("title").name).toBe("title");
  });

  it("unknown or empty field paths throw E1902", () => {
    const f = within(() => form(Flat));
    const loose = (p: string): unknown => f.field(p);
    expect(() => loose("")).toThrow(/E1902/);
    expect(() => loose("nope")).toThrow(/E1902 field path "nope"/);
    expect(() => loose("title.x")).toThrow(/E1902/);
  });

  it("blur validates only that field; a valid blur adds nothing and keeps errors identity", () => {
    const f = within(() => form(Flat));
    const title = f.field("title");
    const el = mk();
    within(() => title.bind(el));
    const before = f.errors();
    title.blur();
    expect(f.errors()).toBe(before.constructor === Object ? f.errors() : before);
    expect(Object.keys(f.errors())).toEqual(["title"]);
    const e1 = f.errors();
    title.blur();
    expect(f.errors()).toBe(e1);
    typeInto(el, "ok");
    expect(Object.keys(f.errors())).toEqual([]);
    const e2 = f.errors();
    title.blur();
    expect(f.errors()).toBe(e2);
    expect(Object.keys(f.errors())).toEqual([]);
  });

  it("a field that blurred valid does not validate on input until an error has shown", () => {
    const f = within(() => form(Flat));
    const title = f.field("title");
    const el = mk();
    within(() => title.bind(el));
    typeInto(el, "fine");
    el.dispatchEvent(new Event("blur"));
    expect(Object.keys(f.errors())).toEqual([]);
    typeInto(el, "");
    expect(Object.keys(f.errors())).toEqual([]);
    el.dispatchEvent(new Event("blur"));
    expect(f.errors().title).toBe("Must be at least 1 character");
    typeInto(el, "again");
    expect(Object.keys(f.errors())).toEqual([]);
  });

  it("touched effects rerun once per field, not on repeat blurs", () => {
    const f = within(() => form(Flat));
    const title = f.field("title");
    let runs = 0;
    within(() =>
      effect(() => {
        title.touched();
        runs += 1;
      }),
    );
    expect(runs).toBe(1);
    title.blur();
    expect(runs).toBe(2);
    title.blur();
    expect(runs).toBe(2);
    expect(title.touched()).toBe(true);
    expect(f.field("age").touched()).toBe(false);
  });

  it("blur on a nested field reports an issue raised on its missing container", () => {
    const f = within(() => form(Flat));
    const d = f.field("c.d");
    d.blur();
    expect(f.errors()["c.d"]).toBe("Required");
    d.set("x");
    expect(Object.keys(f.errors())).toEqual([]);
    expect(f.values()).toEqual({ on: false, c: { d: "x" } });
  });

  it("validate focuses the first invalid bound element in document order, tolerating none bound", () => {
    const f = within(() => form(Flat));
    const second = mk();
    const first = mk();
    document.body.prepend(first);
    const ok1 = mk();
    document.body.prepend(ok1);
    within(() => f.field("note").bind(second));
    within(() => f.field("title").bind(first));
    within(() => f.field("age").bind(ok1));
    f.field("note").set("n");
    f.field("on").set(true);
    f.field("c.d").set("d");
    expect(f[formHandle].validate().ok).toBe(false);
    expect(f.errors().title).toBe("Required");
    expect(document.activeElement).toBe(first);
    first.blur();
    // errors elsewhere with nothing bound for them: no focus, no throw
    const g = within(() => form(Flat));
    expect(() => g[formHandle].validate()).not.toThrow();
    expect(g[formHandle].validate().ok).toBe(false);
  });

  it("validate focus order follows the document, not the binding order", () => {
    const f = within(() => form(Flat));
    const a = mk();
    const b = mk();
    within(() => f.field("note").bind(b));
    within(() => f.field("title").bind(a));
    f.field("on").set(true);
    f.field("c.d").set("x");
    expect(f[formHandle].validate().ok).toBe(false);
    expect(f.errors().note).toBe("Required");
    expect(document.activeElement).toBe(a);
  });

  it("an unbound errored element stops being focus-eligible", () => {
    const f = within(() => form(Flat));
    const a = mk();
    const b = mk();
    const unbindA = within(() => f.field("title").bind(a));
    within(() => f.field("note").bind(b));
    unbindA();
    unbindA();
    f[formHandle].validate();
    expect(document.activeElement).toBe(b);
  });

  it("validate returns the parse result and clears errors when valid", () => {
    const f = within(() => form(Flat, { initial: { title: "t", note: null, c: { d: "d" } } }));
    const r = f[formHandle].validate();
    expect(r).toEqual(ok({ title: "t", note: null, on: false, c: { d: "d" } }));
    expect(f.errors()).toEqual({});
    f.field("title").set("");
    expect(f[formHandle].validate().ok).toBe(false);
    expect(f.errors().title).toBe("Must be at least 1 character");
    f.field("title").set("z");
    expect(f[formHandle].validate().ok).toBe(true);
    expect(Object.keys(f.errors())).toEqual([]);
  });

  it("raw text is kept for uncoercible input and cleared once it coerces", () => {
    const f = within(() => form(Flat));
    const age = f.field("age");
    const el = mk();
    within(() => age.bind(el));
    typeInto(el, "12x");
    expect(el.value).toBe("12x");
    expect(age.value()).toBeUndefined();
    expect(f[formHandle].validate().ok).toBe(false);
    expect(f.errors().age).toBe("Must be a number");
    typeInto(el, "12x");
    expect(f.errors().age).toBe("Must be a number");
    age.set(7);
    expect(el.value).toBe("7");
    expect(f.errors().age).toBeUndefined();
    typeInto(el, "7y");
    age.set(undefined);
    expect(el.value).toBe("");
    expect(age.value()).toBeUndefined();
  });

  it("the input keeps the user's text when it parses to the stored value", () => {
    const f = within(() => form(Flat));
    const age = f.field("age");
    const el = mk();
    within(() => age.bind(el));
    typeInto(el, "05");
    expect(age.value()).toBe(5);
    expect(el.value).toBe("05");
    typeInto(el, "1e1");
    expect(age.value()).toBe(10);
    expect(el.value).toBe("1e1");
    age.set(11);
    expect(el.value).toBe("11");
    typeInto(el, "");
    expect(age.value()).toBeUndefined();
    expect(el.value).toBe("");
    el.value = "  ";
    age.set(undefined);
    expect(el.value).toBe("");
  });

  it("binding shows the current value immediately, including falsy ones", () => {
    const f = within(() => form(Flat, { initial: { title: "hello", age: 0, note: null } }));
    const t = mk();
    const a = mk();
    const n = mk();
    within(() => {
      f.field("title").bind(t);
      f.field("age").bind(a);
      f.field("note").bind(n);
    });
    expect(t.value).toBe("hello");
    expect(a.value).toBe("0");
    expect(n.value).toBe("");
    f.field("title").set("bye");
    expect(t.value).toBe("bye");
    f.reset();
    expect(t.value).toBe("hello");
  });

  it("checkbox bound to a boolean tracks the value both ways", () => {
    const f = within(() => form(Flat));
    const on = mk("checkbox");
    within(() => f.field("on").bind(on));
    expect(on.checked).toBe(false);
    f.field("on").set(true);
    expect(on.checked).toBe(true);
    on.checked = false;
    on.dispatchEvent(new Event("input"));
    expect(f.field("on").value()).toBe(false);
    on.checked = true;
    on.dispatchEvent(new Event("input"));
    expect(f.values()).toEqual({ on: true });
    f.field("on").set(false);
    expect(on.checked).toBe(false);
  });

  it("checkbox bound to a non-boolean checks when the stored value equals its value", () => {
    const f = within(() => form(Flat));
    const cb = mk("checkbox");
    cb.value = "yes";
    within(() => f.field("pick").bind(cb));
    expect(cb.checked).toBe(false);
    f.field("pick").set("yes");
    expect(cb.checked).toBe(true);
    f.field("pick").set("no");
    expect(cb.checked).toBe(false);
    cb.checked = true;
    cb.dispatchEvent(new Event("input"));
    expect(f.field("pick").value()).toBe("yes");
    cb.checked = false;
    cb.dispatchEvent(new Event("input"));
    expect(f.field("pick").value()).toBeUndefined();
    f.field("pick").set(undefined);
    expect(cb.checked).toBe(false);
  });

  it("radio group: checked follows the value, keeps its own id, unchecked radios stay silent", () => {
    const f = within(() => form(Flat));
    const r = mk("radio");
    r.value = "r";
    r.id = "";
    const g = mk("radio");
    g.value = "g";
    within(() => {
      f.field("mode").bind(r);
      f.field("mode").bind(g);
    });
    expect(r.id).toBe("");
    expect(g.id).toBe("");
    expect(r.name).toBe("mode");
    expect(r.checked || g.checked).toBe(false);
    f.field("mode").set("g");
    expect(g.checked).toBe(true);
    expect(r.checked).toBe(false);
    r.checked = true;
    r.dispatchEvent(new Event("input"));
    expect(f.field("mode").value()).toBe("r");
    g.dispatchEvent(new Event("input"));
    expect(f.field("mode").value()).toBe("r");
    f.field("mode").set(undefined);
    expect(r.checked).toBe(false);
  });

  it("select and textarea bind like inputs", () => {
    const f = within(() => form(Flat));
    const sel = document.createElement("select");
    sel.append(opt("r"), opt("g"));
    const ta = document.createElement("textarea");
    document.body.append(sel, ta);
    within(() => {
      f.field("mode").bind(sel);
      f.field("title").bind(ta);
    });
    expect(sel.name).toBe("mode");
    expect(ta.id).toBe(f.field("title").id);
    typeInto(sel, "g");
    expect(f.field("mode").value()).toBe("g");
    typeInto(ta, "words");
    expect(f.field("title").value()).toBe("words");
    f.field("title").set("more");
    expect(ta.value).toBe("more");
  });

  it("nullable text maps empty to null", () => {
    const f = within(() => form(Flat));
    const el = mk();
    within(() => f.field("note").bind(el));
    typeInto(el, "x");
    expect(f.field("note").value()).toBe("x");
    typeInto(el, "");
    expect(f.field("note").value()).toBeNull();
    expect(f.values()).toEqual({ on: false, note: null });
  });

  it("aria attributes follow the error and the id and errorId follow an explicit element id", () => {
    const f = within(() => form(Flat));
    const el = mk();
    el.id = "mine";
    const title = f.field("title");
    within(() => title.bind(el));
    expect(title.id).toBe("mine");
    expect(title.errorId).toBe("mine:error");
    expect(el.hasAttribute("aria-invalid")).toBe(false);
    expect(el.hasAttribute("aria-describedby")).toBe(false);
    title.blur();
    expect(el.getAttribute("aria-invalid")).toBe("true");
    expect(el.getAttribute("aria-describedby")).toBe("mine:error");
    title.set("x");
    expect(el.hasAttribute("aria-invalid")).toBe(false);
    expect(el.hasAttribute("aria-describedby")).toBe(false);
  });

  it("two elements on one path stay bound until both unbind", () => {
    const f = within(() => form(Flat));
    const a = mk();
    const b = mk();
    const ua = within(() => f.field("title").bind(a));
    const ub = within(() => f.field("title").bind(b));
    f.field("title").set("same");
    expect([a.value, b.value]).toEqual(["same", "same"]);
    ua();
    f.field("title").set("later");
    expect([a.value, b.value]).toEqual(["same", "later"]);
    typeInto(a, "ignored");
    expect(f.field("title").value()).toBe("later");
    f.field("title").set(undefined);
    f[formHandle].validate();
    expect(document.activeElement).toBe(b);
    ub();
    typeInto(b, "ignored too");
    expect(f.field("title").value()).toBeUndefined();
  });

  it("disposing the binding scope detaches blur and input listeners", () => {
    const f = within(() => form(Flat));
    const el = mk();
    const sc = scope(() => {
      f.field("title").bind(el);
    });
    typeInto(el, "");
    el.dispatchEvent(new Event("blur"));
    expect(f.field("title").touched()).toBe(true);
    sc.dispose();
    f.reset();
    el.dispatchEvent(new Event("blur"));
    expect(f.field("title").touched()).toBe(false);
    expect(Object.keys(f.errors())).toEqual([]);
  });

  it("blur through the element touches and validates", () => {
    const f = within(() => form(Flat));
    const el = mk();
    within(() => f.field("title").bind(el));
    el.dispatchEvent(new Event("blur"));
    expect(f.field("title").touched()).toBe(true);
    expect(f.errors().title).toBe("Required");
  });

  it("unmapped schema issues are summarised under ''", () => {
    const f = within(() => form(Flat));
    f.field("title");
    f[formHandle].validate();
    expect(f.errors().note).toBe("Required");
    expect(f.errors()[""]).toBe("note: Required (+1 more)");
    expect(f.errors()[""]).toMatch(/^(note|c): Required \(\+1 more\)$/);
  });

  it("pending, reset and onResult", () => {
    const f = within(() => form(Flat, { initial: { title: "init" } }));
    expect(f.pending()).toBe(false);
    f[formHandle].setPending(true);
    expect(f.pending()).toBe(true);
    f[formHandle].setPending(false);
    expect(f.pending()).toBe(false);
    f.field("title").set("changed");
    f.field("title").blur();
    f[formHandle].onResult(err({ code: "keel.fields", message: "m", data: { title: "taken", bad: 3 } }));
    expect(f.errors()).toEqual({ title: "taken" });
    f.field("title").set("again");
    expect(f.errors().title).toBeUndefined();
    f[formHandle].onResult(err({ code: "keel.other", message: "m", data: { title: "no" } }));
    expect(f.errors()).toEqual({});
    f[formHandle].onResult(err({ code: "keel.fields", message: "m", data: { title: "taken" } }));
    f[formHandle].onResult(ok(null));
    expect(f.errors()).toEqual({});
    expect(f.values()).toEqual({ title: "init", on: false });
    expect(f.field("title").touched()).toBe(false);
  });

  it("errors set by onResult count as shown, so edits revalidate", () => {
    const f = within(() => form(Flat, { initial: { title: "t" } }));
    const title = f.field("title");
    f[formHandle].onResult(err({ code: "keel.fields", message: "m", data: { title: "taken" } }));
    title.set("");
    expect(f.errors().title).toBe("Must be at least 1 character");
  });

  it("reset forgets which errors had shown", () => {
    const f = within(() => form(Flat, { initial: { title: "t" } }));
    const title = f.field("title");
    title.set("");
    title.blur();
    expect(f.errors().title).toBe("Must be at least 1 character");
    f.reset();
    title.set("");
    expect(Object.keys(f.errors())).toEqual([]);
  });

  it("values and initial defaults: absent booleans are false only in the candidate, not in values()", () => {
    const f = within(() => form(Flat, { initial: { title: "t", note: null, c: { d: "d" } } }));
    expect(f.values()).toEqual({ title: "t", note: null, c: { d: "d" }, on: false });
    f.field("on").set(true);
    expect(f.field("on").value()).toBe(true);
  });
});
