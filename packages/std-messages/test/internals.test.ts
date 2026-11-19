// The small readers the rules share: param kinds, strings, keys, removal spans, paths, edits and positions.
import { describe, expect, it, test } from "vitest";
import { clip } from "../src/tools/internal/clip.ts";
import { editOf } from "../src/tools/internal/editOf.ts";
import { joinPath } from "../src/tools/internal/joinPath.ts";
import { keyOf } from "../src/tools/internal/keyOf.ts";
import { kindAt } from "../src/tools/internal/kindAt.ts";
import { lineCol } from "../src/tools/internal/lineCol.ts";
import { memberNames } from "../src/tools/internal/memberNames.ts";
import { msgOf } from "../src/tools/internal/msgOf.ts";
import { parsed } from "../src/tools/internal/parsed.ts";
import { removal } from "../src/tools/internal/removal.ts";
import { stringOf } from "../src/tools/internal/stringOf.ts";
import { EXPR_AT, expr, program } from "./tooling.ts";

describe("kindAt", () => {
  it.each([
    ["s.string()", "string"],
    ["line()", "string"],
    ["para()", "string"],
    ["line(1, 80)", "string"],
    ["s.int()", "number"],
    ["s.int({ min: 0 })", "number"],
    ["s.number()", "number"],
    ["int()", "number"],
    ["(s.int() as unknown)", "number"],
    ["s.enum(['a', 'b'])", ["a", "b"]],
    ["s.enum([`a`])", ["a"]],
    ["s.enum(['a'] as const)", ["a"]],
    ["s.enum([])", []],
  ])("%s", (source, kind) => {
    expect(kindAt(expr(source))).toEqual(kind);
  });

  it.each([
    ["a schema held in a name", "count"],
    ["a member that is not called", "s.int"],
    ["a string", "'int'"],
    ["another schema call", "s.boolean()"],
    ["another call over a list of strings", "s.oneOf(['a', 'b'])"],
    ["a computed member call", "s['int']()"],
    ["a call of a call", "make()()"],
    ["an enum without a list", "s.enum()"],
    ["an enum over a spread argument", "s.enum(...lists)"],
    ["an enum over a named list", "s.enum(tags)"],
    ["an enum with a spread element", "s.enum(['a', ...more])"],
    ["an enum with a hole", "s.enum(['a', , 'b'])"],
    ["an enum with a number", "s.enum(['a', 1])"],
    ["an enum with a named value", "s.enum(['a', b])"],
    ["an enum with an empty value", "s.enum(['a', ''])"],
  ])("%s is unknown", (_, source) => {
    expect(kindAt(expr(source))).toBe("unknown");
  });
});

describe("stringOf", () => {
  it("reads a string literal: value, source text between the quotes, offset past the quote", () => {
    expect(stringOf(expr("'a\\nb'"))).toEqual({ value: "a\nb", raw: "a\\nb", at: EXPR_AT + 1 });
    expect(stringOf(expr('("x" as string)'))).toEqual({ value: "x", raw: "x", at: EXPR_AT + 2 });
    expect(stringOf(expr("''"))).toEqual({ value: "", raw: "", at: EXPR_AT + 1 });
  });

  it("reads a template without substitutions, cooked", () => {
    expect(stringOf(expr("`a\\nb`"))).toEqual({ value: "a\nb", raw: "a\\nb", at: EXPR_AT + 1 });
    expect(stringOf(expr("``"))).toEqual({ value: "", raw: "", at: EXPR_AT + 1 });
  });

  it.each(["5", "true", "null", "/a/", "name", "`a${b}`", "`${b}`", "'a' + 'b'", "f('a')"])(
    "%s is not a string",
    (source) => {
      expect(stringOf(expr(source))).toBeUndefined();
    },
  );
});

describe("keyOf", () => {
  const keys = (source: string): (string | undefined)[] => {
    const x = expr(source);
    if (x.type !== "ObjectExpression") throw new Error("not an object");
    return x.properties.map(keyOf);
  };

  it("names identifier and string keys; spreads, computed and numeric keys have none", () => {
    expect(keys("{ a: 1, 'b-c': 2, d, e() {} }")).toEqual(["a", "b-c", "d", "e"]);
    expect(keys("{ ...rest }")).toEqual([undefined]);
    expect(keys("{ [k]: 1, ['a']: 2 }")).toEqual([undefined, undefined]);
    expect(keys("{ 1: 'x', 2n: 'y' }")).toEqual([undefined, undefined]);
  });
});

describe("removal", () => {
  const items = [
    { start: 10, end: 14 },
    { start: 16, end: 20 },
    { start: 23, end: 30 },
  ];

  it("removes an item up to the next one, and the last one back to the end of the one before", () => {
    expect(removal(items, 0)).toEqual([{ start: 10, end: 16, text: "" }]);
    expect(removal(items, 1)).toEqual([{ start: 16, end: 23, text: "" }]);
    expect(removal(items, 2)).toEqual([{ start: 20, end: 30, text: "" }]);
  });

  it("removes an only item by its own span, and nothing for an index outside the list", () => {
    expect(removal([{ start: 4, end: 9 }], 0)).toEqual([{ start: 4, end: 9, text: "" }]);
    expect(removal(items, 3)).toEqual([]);
    expect(removal(items, -1)).toEqual([]);
    expect(removal([], 0)).toEqual([]);
  });
});

test("joinPath resolves `.` and `..` against a directory and drops empty parts", () => {
  expect(joinPath("modules/recipes/", "./AppLocale.schema.ts")).toBe("modules/recipes/AppLocale.schema.ts");
  expect(joinPath("modules/recipes/RecipesText/", "../RecipesText.schema.ts")).toBe(
    "modules/recipes/RecipesText.schema.ts",
  );
  expect(joinPath("modules/recipes/", "../../shared/copy.ts")).toBe("shared/copy.ts");
  expect(joinPath("", "./copy.ts")).toBe("copy.ts");
  expect(joinPath("a/", "./b//c.ts")).toBe("a/b/c.ts");
  expect(joinPath("a/", "..")).toBe("");
});

describe("editOf", () => {
  const finding = (data?: Record<string, string | number>) => ({
    path: "a.ts",
    line: 1,
    col: 1,
    ...(data && { data }),
  });

  it("is the edit a finding carries", () => {
    expect(editOf(finding({ msg: "m", start: 3, end: 5, text: "n" }))).toEqual([{ start: 3, end: 5, text: "n" }]);
    expect(editOf(finding({ msg: "m", start: 0, end: 0, text: "" }))).toEqual([{ start: 0, end: 0, text: "" }]);
  });

  it.each([
    ["no data", undefined],
    ["a message only", { msg: "m" }],
    ["no start", { end: 5, text: "n" }],
    ["no end", { start: 3, text: "n" }],
    ["no text", { start: 3, end: 5 }],
    ["a text only", { text: "n" }],
    ["a start that is not a number", { start: "3", end: 5, text: "n" }],
    ["an end that is not a number", { start: 3, end: "5", text: "n" }],
    ["a text that is not a string", { start: 3, end: 5, text: 7 }],
  ])("is null with %s", (_, data) => {
    expect(editOf(finding(data))).toBeNull();
  });
});

test("clip keeps 24 characters and shortens a longer text to 21 and an ellipsis", () => {
  expect(clip("")).toBe("");
  expect(clip("abcdefghijklmnopqrstuvwx")).toBe("abcdefghijklmnopqrstuvwx");
  expect(clip("abcdefghijklmnopqrstuvwxy")).toBe("abcdefghijklmnopqrstu...");
  expect(clip("x".repeat(80))).toBe(`${"x".repeat(21)}...`);
});

test("msgOf is the message a finding carries, empty without one", () => {
  expect(msgOf({ path: "a.ts", line: 1, col: 1, data: { msg: "m" } })).toBe("m");
  expect(msgOf({ path: "a.ts", line: 1, col: 1, data: {} })).toBe("");
  expect(msgOf({ path: "a.ts", line: 1, col: 1 })).toBe("");
});

test("lineCol is the 1-based line and column of an offset", () => {
  expect(lineCol("ab\ncd\nef", 0)).toEqual({ line: 1, col: 1 });
  expect(lineCol("ab\ncd\nef", 1)).toEqual({ line: 1, col: 2 });
  expect(lineCol("ab\ncd\nef", 3)).toEqual({ line: 2, col: 1 });
  expect(lineCol("ab\ncd\nef", 7)).toEqual({ line: 3, col: 2 });
});

describe("memberNames", () => {
  it("holds each name read as a static member, optional chains included", () => {
    const names = memberNames(program("a.ts", "export const x = t.title + p.data?.text.count\n"));
    expect([...names].sort()).toEqual(["count", "data", "text", "title"]);
  });

  it("leaves out computed members and private names", () => {
    const source = "class A { #secret = 1; m(t, title) { return [t[title], t['label'], this.#secret] } }\n";
    expect([...memberNames(program("a.ts", source))]).toEqual([]);
  });

  it("is read once per program", () => {
    const p = program("a.ts", "export const x = t.title\n");
    expect(memberNames(p)).toBe(memberNames(p));
  });
});

describe("parsed", () => {
  it("parses a file once and reads `.tsx` as TSX", () => {
    const ts = { path: "a.ts", source: "export const x = <T,>(v: T) => v\n" };
    const tsx = { path: "View.tsx", source: "export const View = () => <h1>{1}</h1>\n" };
    expect(parsed(ts)?.body[0]?.type).toBe("ExportNamedDeclaration");
    expect(parsed(tsx)?.body).toHaveLength(1);
    expect(parsed(ts)).toBe(parsed(ts));
    expect(parsed(tsx)).toBe(parsed(tsx));
  });

  it("has no AST for a file with a syntax error", () => {
    const broken = { path: "a.ts", source: "export const = \n" };
    expect(parsed(broken)).toBeUndefined();
    expect(parsed(broken)).toBeUndefined();
    expect(parsed({ path: "b.ts", source: "export const View = () => <h1>{1}</h1>\n" })).toBeUndefined();
  });
});
