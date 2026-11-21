// What a message set accepts at run time: param kinds, object messages, templates, generated messages and the
// errors of `messages` and `load`.
import { s } from "@keel/schema";
import { formatMessage, messages } from "@keel/std-messages";
import { describe, expect, it, test, vi } from "vitest";
import type { ParamKind } from "../src/internal/ParamKind.ts";
import { genMessage } from "../src/internal/genMessage.ts";
import { kindOf } from "../src/internal/kindOf.ts";
import { messageOk } from "../src/internal/messageOk.ts";
import { templateOk } from "../src/internal/templateOk.ts";

const AppLocale = s.enum(["en-US", "de-DE"]);
const kinds = (params: Record<string, ParamKind>): Map<string, ParamKind> => new Map(Object.entries(params));
const text = (name: string, base: Parameters<typeof s.format>[1] = s.string()) =>
  s.format(name, base, { check: () => true, gen: { from: base, map: (v) => v } });

describe("kindOf", () => {
  it("is string, number or the enum's values", () => {
    expect(kindOf(s.string())).toBe("string");
    expect(kindOf(s.int())).toBe("number");
    expect(kindOf(s.number())).toBe("number");
    expect(kindOf(s.enum(["a", "b"]))).toEqual(["a", "b"]);
  });

  it("is string for a bounded `line` or `para` format over a string, and none for any other schema", () => {
    expect(kindOf(text("line(1..80)"))).toBe("string");
    expect(kindOf(text("para(1..2000)"))).toBe("string");
    expect(kindOf(text("message"))).toBeUndefined();
    expect(kindOf(text("line(1..80)", s.json()))).toBeUndefined();
    expect(kindOf(s.boolean())).toBeUndefined();
    expect(kindOf(s.array(s.string()))).toBeUndefined();
    expect(kindOf(s.json())).toBeUndefined();
  });
});

describe("templateOk", () => {
  it("takes 1 to 2,000 characters whose braces are placeholders naming a listed param", () => {
    expect(templateOk("Hi", [])).toBe(true);
    expect(templateOk("{n} of {m}", ["n", "m"])).toBe(true);
    expect(templateOk("x".repeat(2000), [])).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["2,001 characters", "x".repeat(2001)],
    ["a number", 5],
    ["nothing", undefined],
    ["null", null],
    ["a list", ["Hi"]],
    ["an object", { text: "Hi" }],
    ["a brace outside a placeholder", "a{b"],
    ["a closing brace", "a}b"],
    ["an unlisted placeholder", "{x}"],
  ])("refuses %s", (_, t) => {
    expect(templateOk(t, ["n", "m"])).toBe(false);
  });
});

describe("messageOk", () => {
  const params = kinds({ n: "number", k: ["a", "b"], who: "string", metric: "number" });
  const ok = (v: unknown): boolean => messageOk(v, params);

  it("takes a text, a plural over a number param and a select with a case per value", () => {
    expect(ok({ text: "{who} has {n}" })).toBe(true);
    expect(ok({ plural: "n", other: "# left" })).toBe(true);
    expect(ok({ plural: "n", zero: "none", one: "one", two: "two", few: "few", many: "many", other: "{who}" })).toBe(
      true,
    );
    expect(ok({ select: "k", cases: { a: "A {n}", b: "B" } })).toBe(true);
  });

  it.each([
    ["null", null],
    ["nothing", undefined],
    ["a string", "text"],
    ["a number", 5],
    ["a list", [{ text: "x" }]],
    ["an empty object", {}],
    ["a text with another field", { text: "x", other: "y" }],
    ["a text naming no param", { text: "{x}" }],
    ["a plural over a string param", { plural: "who", other: "x" }],
    ["a plural over a name that is not a string", { plural: 5, other: "x" }],
    ["a plural without `other`", { plural: "n", one: "x" }],
    ["a plural form naming no param", { plural: "n", other: "# {x}" }],
    ["a plural form that is not a template", { plural: "n", one: 5, other: "x" }],
    ["a plural with an unknown form", { plural: "n", other: "x", some: "y" }],
    ["a select over a number param", { select: "n", cases: { a: "A" } }],
    [
      "a select over a number param, six cases",
      { select: "metric", cases: { a: "1", b: "2", c: "3", d: "4", e: "5", f: "6" } },
    ],
    ["a select over no param", { select: "zzz", cases: {} }],
    ["a select without cases", { select: "k", extra: 1 }],
    ["a select whose cases are null", { select: "k", cases: null }],
    ["a select whose cases are a number", { select: "k", cases: 5 }],
    ["a select lacking a case", { select: "k", cases: { a: "A" } }],
    ["a select with another case", { select: "k", cases: { a: "A", c: "C" } }],
    ["a select with a case naming no param", { select: "k", cases: { a: "A", b: "{x}" } }],
    ["a select whose first case names no param", { select: "k", cases: { a: "{x}", b: "B" } }],
    ["a select with a third field", { select: "k", cases: { a: "A", b: "B" }, extra: 1 }],
  ])("refuses %s", (_, v) => {
    expect(ok(v)).toBe(false);
  });
});

describe("genMessage", () => {
  const params = kinds({ k: ["x", "y"], n: "number", who: "string" });

  it("picks the param by the number of parts: a select over an enum, a case per value", () => {
    expect(genMessage([], params)).toEqual({ select: "k", cases: { x: " {k}", y: " {n}" } });
    expect(genMessage(["a", "b", "c"], params)).toEqual({ select: "k", cases: { x: "a {k}", y: "b {n}" } });
  });

  it("makes a plural over a number param for an odd count of parts, a text otherwise", () => {
    expect(genMessage(["a"], params)).toEqual({ plural: "n", other: "# a {k}" });
    expect(genMessage(["a", "b"], params)).toEqual({ text: "a {k}" });
    const one = kinds({ n: "number" });
    expect(genMessage([], one)).toEqual({ text: " {n}" });
    expect(genMessage(["a"], one)).toEqual({ plural: "n", other: "# a {n}" });
    expect(genMessage(["a", "b"], one)).toEqual({ text: "a {n}" });
    expect(genMessage(["a", "b", "c"], one)).toEqual({ plural: "n", other: "# a {n}" });
    expect(genMessage(["a"], kinds({ who: "string" }))).toEqual({ text: "a {who}" });
  });

  it("drops braces from a part and keeps its first 60 characters", () => {
    expect(genMessage(["{a}b}{", "x"], params)).toEqual({ text: "ab {k}" });
    expect(genMessage([`{${"x".repeat(80)}`, "y"], params)).toEqual({ text: `${"x".repeat(60)} {k}` });
  });

  it("generates only messages the set accepts", () => {
    for (const parts of [[], ["a"], ["{", "b"], ["a", "b", "c"], ["a", "b", "c", "d"]])
      expect(messageOk(genMessage(parts, params), params)).toBe(true);
  });
});

describe("messages", () => {
  const load = async (): Promise<unknown> => ({ default: { a: "A" } });

  it("names what it refuses", () => {
    expect(() => messages(s.literal("en-US"), { a: {} }, load)).toThrow(new Error("messages: locales not an s.enum"));
    expect(() => messages(AppLocale, { "a-b": {} }, load)).toThrow(new Error("messages: bad key 'a-b'"));
    expect(() => messages(AppLocale, { a: { "x-y": s.int() } }, load)).toThrow(
      new Error("messages: bad param 'x-y' of 'a'"),
    );
    expect(() => messages(AppLocale, { a: { j: s.json() } }, load)).toThrow(
      new Error("messages: bad param 'j' of 'a'"),
    );
  });

  it.each([
    ["null", null],
    ["a string", "default"],
    ["a number", 5],
    ["nothing", undefined],
    ["a module without a default export", { entry: { a: "A" } }],
  ])("load rejects with the schema's type issue when the file is %s", async (_, file) => {
    const Demo = messages(AppLocale, { a: {} }, async () => file);
    await expect(Demo.load("en-US")).rejects.toThrow(/^messages: \[.*"rule":"type"/);
  });

  it("load resolves to the default export the set accepts", async () => {
    await expect(messages(AppLocale, { a: {} }, load).load("de-DE")).resolves.toEqual({ a: "A" });
  });
});

describe("formatMessage", () => {
  it("renders a placeholder without a param as nothing, and a select without that case as nothing", () => {
    expect(formatMessage({ text: "a{x}b {who}" }, { who: "Ada" }, "en-US")).toBe("ab Ada");
    expect(formatMessage({ select: "k", cases: { a: "A {k}" } }, { k: "zzz" }, "en-US")).toBe("");
    expect(formatMessage({ select: "k", cases: { a: "A {k}" } }, { k: "a" }, "en-US")).toBe("A a");
    expect(formatMessage({ select: "k", cases: { a: "A" } }, { k: "toString" }, "en-US")).toBe("");
  });
});

test("module constants: identifier keys, the text formats, every plural form, the message type names", async () => {
  vi.resetModules();
  const schema = await import("@keel/schema");
  const fresh = await import("../src/messages.ts");
  const { kindOf: freshKindOf } = await import("../src/internal/kindOf.ts");
  const { messageOk: freshMessageOk } = await import("../src/internal/messageOk.ts");
  const locales = schema.s.enum(["en-US"]);
  const load = async (): Promise<unknown> => ({ default: {} });

  for (const key of ["-a", "a-", "1a", "a b", ""]) {
    expect(() => fresh.messages(locales, { [key]: {} }, load)).toThrow(`messages: bad key '${key}'`);
    expect(() => fresh.messages(locales, { a: { [key]: schema.s.int() } }, load)).toThrow(`bad param '${key}' of 'a'`);
  }
  expect(() => fresh.messages(locales, { $a_1: { _n$2: schema.s.int() } }, load)).not.toThrow();

  const Demo = fresh.messages(locales, { a: {}, b: { n: schema.s.int(), who: schema.s.string() } }, load);
  await expect(Demo.load("en-US")).rejects.toThrow(/^messages: \[.*"rule"/);
  expect(JSON.stringify(Demo.node)).toContain('"name":"message"');
  expect(JSON.stringify(Demo.node)).toContain('"name":"message(n,who)"');

  const format = (name: string) =>
    schema.s.format(name, schema.s.string(), { check: () => true, gen: { from: schema.s.string(), map: (v) => v } });
  for (const name of ["line(1..80)", "para(10..2000)", "line(0..5)"]) expect(freshKindOf(format(name))).toBe("string");
  for (const name of [
    "xline(1..80)",
    "line(1..80)x",
    "line(a..80)",
    "line(1..b)",
    "line(..80)",
    "line(1..)",
    "text(1..80)",
  ])
    expect([name, freshKindOf(format(name))]).toEqual([name, undefined]);
  expect(freshKindOf(schema.s.string())).toBe("string");
  expect(freshKindOf(schema.s.boolean())).toBeUndefined();

  const params = new Map<string, ParamKind>([["n", "number"]]);
  for (const form of ["zero", "one", "two", "few", "many"])
    expect(freshMessageOk({ plural: "n", other: "x", [form]: "#" }, params)).toBe(true);
});
