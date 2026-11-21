// E2405 hits of one message: placeholders, plural and select against the key's declared params.
import { describe, expect, it } from "vitest";
import type { Hit } from "../src/tools/internal/Hit.ts";
import type { ToolKind } from "../src/tools/internal/ToolKind.ts";
import { paramHits } from "../src/tools/internal/paramHits.ts";
import { EXPR_AT, at, expr } from "./tooling.ts";

const kinds = (params: Record<string, ToolKind>): Map<string, ToolKind> => new Map(Object.entries(params));
/** Hits for the message `source` of key `total`; offsets are relative to `source`. */
const hits = (source: string, params: Record<string, ToolKind>): Hit[] =>
  paramHits("total", expr(source), kinds(params)).map((h) => ({
    ...h,
    at: h.at - EXPR_AT,
    ...(h.edit && { edit: { ...h.edit, start: h.edit.start - EXPR_AT, end: h.edit.end - EXPR_AT } }),
  }));

describe("a template", () => {
  it("names only declared params", () => {
    expect(hits("'Total {n} of {m}'", { n: "number", m: "number" })).toEqual([]);
    expect(hits("'Total'", {})).toEqual([]);
    expect(hits("{ text: 'Total {n}' }", { n: "number" })).toEqual([]);
  });

  it("is renamed to the one declared param it leaves out", () => {
    const source = "'Sum {n} of {count}'";
    expect(hits(source, { n: "number", m: "number" })).toEqual([
      {
        at: at(source, "count"),
        msg: "{count} is not a param of 'total'",
        edit: { start: at(source, "count"), end: at(source, "count") + "count".length, text: "m" },
      },
    ]);
  });

  it("has no rename when no declared param, or more than one, is left out", () => {
    const source = "{ text: 'Sum {x}' }";
    const bare = [{ at: at(source, "x}"), msg: "{x} is not a param of 'total'" }];
    expect(hits(source, {})).toEqual(bare);
    expect(hits(source, { n: "number", m: "number" })).toEqual(bare);
    expect(hits("{ text: 'Sum {n} {x}' }", { n: "number" })).toEqual([
      { at: at("{ text: 'Sum {n} {x}' }", "x}"), msg: "{x} is not a param of 'total'" },
    ]);
  });

  it("reports each undeclared placeholder, each with the rename", () => {
    const source = "`{a} and {b}`";
    expect(hits(source, { n: "number" })).toEqual([
      { at: 2, msg: "{a} is not a param of 'total'", edit: { start: 2, end: 3, text: "n" } },
      { at: 10, msg: "{b} is not a param of 'total'", edit: { start: 10, end: 11, text: "n" } },
    ]);
  });

  it("with a brace outside a placeholder is reported at the template, with no edit", () => {
    expect(hits("'a{b'", { n: "number" })).toEqual([
      { at: 1, msg: "message 'total' has a brace outside a {param} placeholder" },
    ]);
    expect(hits("{ text: 'a } b {n}' }", { n: "number" })).toEqual([
      { at: 9, msg: "message 'total' has a brace outside a {param} placeholder" },
    ]);
  });

  it("clips a long key and a long placeholder name", () => {
    const [hit] = paramHits("aVeryLongMessageKeyNameOfTheSet", expr("'{aVeryLongPlaceholderNameHere}'"), kinds({}));
    expect(hit?.msg).toBe("{aVeryLongPlaceholderN...} is not a param of 'aVeryLongMessageKeyNa...'");
  });

  it("that is not a string is left alone", () => {
    expect(hits("5", { n: "number" })).toEqual([]);
    expect(hits("fallback", { n: "number" })).toEqual([]);
    expect(hits("{ text: fallback }", { n: "number" })).toEqual([]);
    expect(hits("{ ...base, [key]: '{x}' }", { n: "number" })).toEqual([]);
    expect(hits("{ other: '{x}' }", { n: "number" })).toEqual([]);
  });
});

describe("a plural", () => {
  it("is over a number param, or one whose kind is not read", () => {
    expect(hits("{ plural: 'n', one: '# item', other: '# items' }", { n: "number" })).toEqual([]);
    expect(hits("{ plural: 'n', other: '# items' }", { n: "unknown" })).toEqual([]);
  });

  it.each([
    ["a string param", { n: "string" }],
    ["an enum param", { n: ["a", "b"] }],
    ["no param", {}],
  ] as const)("over %s is reported at its name", (_, params) => {
    const source = "{ plural: 'n', other: 'items' }";
    expect(hits(source, { ...params, m: "number" }).map(({ at, msg }) => ({ at, msg }))).toContainEqual({
      at: at(source, "n'"),
      msg: "plural 'n' is not a number param of 'total'",
    });
  });

  it("checks every plural form, and only when `plural` names the param as a string", () => {
    const source = "{ plural: 'n', zero: '{a}', one: '{b}', two: '{c}', few: '{d}', many: '{e}', other: '{f}' }";
    expect(hits(source, { n: "number" }).map((h) => h.msg)).toEqual(
      ["a", "b", "c", "d", "e", "f"].map((x) => `{${x}} is not a param of 'total'`),
    );
    expect(hits("{ plural: n, one: '{b}', other: '{f}' }", { n: "number" })).toEqual([]);
    expect(hits("{ one: '{b}', other: '{f}' }", { n: "number" })).toEqual([]);
    expect(hits("{ plural: 'n', other: '# items', some: '{x}' }", { n: "number" })).toEqual([]);
  });

  it("form counts `#` as the plural param: no rename to it, a rename to another param left out", () => {
    const source = "{ plural: 'n', other: '# {x}' }";
    const bare = { at: at(source, "x}"), msg: "{x} is not a param of 'total'" };
    expect(hits(source, { n: "number" })).toEqual([bare]);
    expect(hits(source, { n: "number", m: "string" })).toEqual([
      { ...bare, edit: { start: bare.at, end: bare.at + 1, text: "m" } },
    ]);
  });

  it("form without `#` is renamed to the plural param it leaves out", () => {
    const source = "{ plural: 'n', other: '{x} items' }";
    expect(hits(source, { n: "number" })).toEqual([
      {
        at: at(source, "x}"),
        msg: "{x} is not a param of 'total'",
        edit: { start: at(source, "x}"), end: at(source, "x}") + 1, text: "n" },
      },
    ]);
  });

  it("`#` in a `text` template does not stand for a param", () => {
    const source = "{ text: '# {x}' }";
    expect(hits(source, { n: "number" })).toEqual([
      {
        at: at(source, "x}"),
        msg: "{x} is not a param of 'total'",
        edit: { start: at(source, "x}"), end: at(source, "x}") + 1, text: "n" },
      },
    ]);
  });
});

describe("a select", () => {
  it("is over an enum param with a case per value, or one whose kind is not read", () => {
    expect(hits("{ select: 'k', cases: { a: 'A', b: 'B' } }", { k: ["a", "b"] })).toEqual([]);
    expect(hits("{ select: 'k', cases: { a: 'A', z: 'Z' } }", { k: "unknown" })).toEqual([]);
    expect(hits("{ select: k, cases: { z: '{x}' } }", { k: ["a"] })).toEqual([]);
  });

  it.each([
    ["a number param", { k: "number" }],
    ["a string param", { k: "string" }],
    ["no param", {}],
  ] as const)("over %s is reported at its name, and its cases are not compared", (_, params) => {
    const source = "{ select: 'k', cases: { a: 'A' } }";
    expect(hits(source, params)).toEqual([{ at: at(source, "k'"), msg: "select 'k' is not an enum param of 'total'" }]);
  });

  it("reports a case that is not a value at the case, and a value without a case at the cases", () => {
    const source = "{ select: 'k', cases: { a: 'A', c: 'C' } }";
    expect(hits(source, { k: ["a", "b", "d"] })).toEqual([
      { at: at(source, "c:"), msg: "case 'c' is not a value of 'k'" },
      { at: at(source, "{ a:"), msg: "select of 'total' lacks case 'b'" },
      { at: at(source, "{ a:"), msg: "select of 'total' lacks case 'd'" },
    ]);
  });

  it("checks each case's template", () => {
    const source = "{ select: 'k', cases: { a: 'A {x} {k}', b: 'B {k}' } }";
    expect(hits(source, { k: ["a", "b"], n: "number" })).toEqual([
      {
        at: at(source, "x}"),
        msg: "{x} is not a param of 'total'",
        edit: { start: at(source, "x}"), end: at(source, "x}") + 1, text: "n" },
      },
    ]);
  });

  it("reads only keyed cases, and nothing from cases that are not an object literal", () => {
    expect(hits("{ select: 'k', cases: { ...more, [key]: 'x', a: 'A' } }", { k: ["a"] })).toEqual([]);
    expect(hits("{ select: 'k', cases: byValue }", { k: ["a"] })).toEqual([]);
    expect(hits("{ select: 'k' }", { k: ["a"] })).toEqual([]);
    expect(hits("{ select: 'k' }", { k: "number" })).toEqual([
      { at: 11, msg: "select 'k' is not an enum param of 'total'" },
    ]);
  });
});
