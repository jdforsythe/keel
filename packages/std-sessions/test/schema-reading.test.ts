// How E2001 reads a schema from source without running it: `scopeOf` collects a file's consts and imports,
// `resolveSchema` turns a schema expression into a shape (anything it cannot prove is `any`), `hasSchemaPath` says
// whether a path is provably absent, and `pathSegments` splits a path.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { ShapeNode } from "../src/internal/ShapeNode.ts";
import { hasSchemaPath } from "../src/internal/hasSchemaPath.ts";
import { parseTs } from "../src/internal/parseTs.ts";
import { pathSegments } from "../src/internal/pathSegments.ts";
import { resolveSchema } from "../src/internal/resolveSchema.ts";
import { scopeOf } from "../src/internal/scopeOf.ts";

type File = { path: string; source: string };
const HERE = "modules/cart/cart.ts";

/** A shape as plain data: an object's fields as a record. */
const plain = (n: ShapeNode): unknown => {
  if (n.kind === "array") return { array: plain(n.item) };
  if (n.kind === "record") return { record: plain(n.value) };
  if (n.kind === "object")
    return { open: n.open, fields: Object.fromEntries([...n.fields].map(([k, v]) => [k, plain(v)])) };
  return n.kind;
};
const scope = (source: string, files: readonly File[] = [], path = HERE) => {
  const program = parseTs(path, source);
  if (program === undefined) throw new Error("the fixture source parses");
  return scopeOf(path, program, files);
};
/** The shape of top-level const `X` of `source`. */
const shape = (source: string, files: readonly File[] = [], path = HERE): unknown => {
  const sc = scope(source, files, path);
  const init = sc.consts.get("X");
  if (init === undefined) throw new Error("the fixture declares X");
  return plain(resolveSchema(init, sc));
};
const leafObject = (...keys: string[]) => ({ open: false, fields: Object.fromEntries(keys.map((k) => [k, "leaf"])) });

describe("parseTs", () => {
  test("a module parses; a syntax error is undefined; a .tsx path takes JSX", () => {
    expect(parseTs("a.ts", "export const a = 1;")?.type).toBe("Program");
    expect(parseTs("a.ts", "export const = ;")).toBeUndefined();
    expect(parseTs("a.tsx", "export const a = <b />;")?.type).toBe("Program");
    expect(parseTs("a.ts", "export const a = <b />;")).toBeUndefined();
    expect(parseTs("a.ts", "const a: number = 1; await Promise.resolve(a);")?.type).toBe("Program");
  });
});

describe("scopeOf", () => {
  const source = `
import Default from "./Default.schema.ts";
import * as all from "./All.schema.ts";
import { Card, Line as Row, "quoted-name" as Quoted } from "./Card.schema.ts";
import { other } from "@keel/schema";
declare const Declared: unknown;
const A = 1;
export const B = 2, C = 3;
let Mutable = 4;
var Old = 5;
const { Destructured } = { Destructured: 6 };
export function fn() {}
export class Klass {}
export { A as Renamed };
export default A;
function local() { const Inner = 7; return Inner; }
`;

  test("top-level consts with an initializer, exported or not, and nothing else", () => {
    const sc = scope(source);
    expect([...sc.consts.keys()].sort()).toEqual(["A", "B", "C"]);
    expect(sc.consts.get("B")).toMatchObject({ type: "Literal", value: 2 });
    expect(sc.path).toBe(HERE);
  });

  test("named imports by local name, with their source and imported name; default and namespace imports are left out", () => {
    const sc = scope(source);
    expect(Object.fromEntries(sc.imports)).toEqual({
      Card: { source: "./Card.schema.ts", name: "Card" },
      Row: { source: "./Card.schema.ts", name: "Line" },
      Quoted: { source: "./Card.schema.ts", name: "quoted-name" },
      other: { source: "@keel/schema", name: "other" },
    });
  });

  test("the files it was given are the scope's files", () => {
    const files = [{ path: "modules/cart/Card.schema.ts", source: "" }];
    expect(scope("const A = 1;", files).files).toBe(files);
  });
});

describe("resolveSchema: what it reads", () => {
  test("string, number, int, boolean, id, enum and literal are leaves", () => {
    for (const call of [
      "s.string()",
      "s.string({ min: 1 })",
      "s.number()",
      "s.int()",
      "s.boolean()",
      's.id("Card")',
      's.enum(["a", "b"])',
      "s.literal(1)",
    ])
      expect(shape(`const X = ${call};`), call).toBe("leaf");
  });

  test("s.json(), another builder, another object's call, and anything that is no call are any", () => {
    for (const expr of [
      "s.json()",
      "s.union([s.string(), s.int()])",
      "s.format('x', s.string(), {})",
      "z.string()",
      "string()",
      's["string"]()',
      "s.string",
      "5",
      "{ a: s.string() }",
      "make().string()",
    ])
      expect(shape(`const X = ${expr};`), expr).toBe("any");
  });

  test(".optional() and .nullable() give the shape under them; another method gives any", () => {
    expect(shape("const X = s.string().optional();")).toBe("leaf");
    expect(shape("const X = s.string().nullable();")).toBe("leaf");
    expect(shape("const X = s.object({ a: s.int() }).nullable().optional();")).toEqual(leafObject("a"));
    expect(shape("const X = Other.optional(); const Other = s.string();")).toBe("leaf");
    expect(shape('const X = s.string().pii("contact");')).toBe("any");
    expect(shape("const X = s.string().describe();")).toBe("any");
    expect(shape("const X = s.object({ a: s.int() }).extend();")).toBe("any");
  });

  test("array and record wrap the inner shape, secret is the inner shape; with no argument or a spread they are any", () => {
    expect(shape("const X = s.array(s.string());")).toEqual({ array: "leaf" });
    expect(shape("const X = s.record(s.int());")).toEqual({ record: "leaf" });
    expect(shape("const X = s.secret(s.string());")).toBe("leaf");
    expect(shape("const X = s.secret(s.object({ a: s.string() }));")).toEqual(leafObject("a"));
    expect(shape("const X = s.array(s.record(s.array(s.json())));")).toEqual({ array: { record: { array: "any" } } });
    expect(shape("const X = s.array();")).toBe("any");
    expect(shape("const X = s.record();")).toBe("any");
    expect(shape("const X = s.secret();")).toBe("any");
    expect(shape("const X = s.array(...items);")).toBe("any");
  });

  test("an object's fields are read by identifier or string key; the object is closed to other keys", () => {
    expect(
      shape('const X = s.object({ a: s.string(), "max-runs": s.int(), nested: s.object({ b: s.boolean() }) });'),
    ).toEqual({ open: false, fields: { a: "leaf", "max-runs": "leaf", nested: leafObject("b") } });
    expect(shape("const X = s.object({});")).toEqual({ open: false, fields: {} });
    expect(shape("const X = s.object({ a: s.json(), b: unknown });")).toEqual({
      open: false,
      fields: { a: "any", b: "any" },
    });
  });

  test("a spread, a computed key or a key that is no name leaves the object open, with the fields it could read", () => {
    expect(shape("const X = s.object({ a: s.string(), ...rest });")).toEqual({ open: true, fields: { a: "leaf" } });
    expect(shape("const X = s.object({ [key]: s.string(), b: s.int() });")).toEqual({
      open: true,
      fields: { b: "leaf" },
    });
    expect(shape("const X = s.object({ 1: s.string(), b: s.int() });")).toEqual({ open: true, fields: { b: "leaf" } });
    expect(shape('const X = s.object({ ["a"]: s.string() });')).toEqual({ open: true, fields: {} });
  });

  test("s.object with no argument, a spread or a shape that is no object literal is any", () => {
    expect(shape("const X = s.object();")).toBe("any");
    expect(shape("const X = s.object(...shapes);")).toBe("any");
    expect(shape("const X = s.object(fields); const fields = { a: s.string() };")).toBe("any");
    expect(shape("const X = s.object([s.string()]);")).toBe("any");
  });

  test("parentheses, `as`, `satisfies` and `!` are looked through, on the expression, the receiver and the shape", () => {
    expect(shape("const X = (s.string());")).toBe("leaf");
    expect(shape("const X = s.string() as unknown;")).toBe("leaf");
    expect(shape("const X = s.string() satisfies unknown;")).toBe("leaf");
    expect(shape("const X = s.string()!;")).toBe("leaf");
    expect(shape("const X = ((s.object(({ a: s.int() }) as const)) as unknown)!;")).toEqual(leafObject("a"));
    expect(shape("const X = (s as typeof s).string();")).toBe("leaf");
    expect(shape("const X = (s.string() as unknown as Opt).optional();")).toBe("leaf");
  });
});

describe("resolveSchema: names", () => {
  const card = { path: "modules/cart/Card.schema.ts", source: "export const Card = s.object({ number: s.string() });" };

  test("a const of the file is followed; an unknown name is any", () => {
    expect(shape("const Line = s.object({ sku: s.string() }); const X = s.array(Line);")).toEqual({
      array: leafObject("sku"),
    });
    expect(shape("const X = Alias; const Alias = Line; const Line = s.int();")).toBe("leaf");
    expect(shape("const X = Missing;")).toBe("any");
    expect(shape("let Loose = s.string(); const X = Loose;")).toBe("any");
    expect(shape("declare const Declared: unknown; const X = Declared;")).toBe("any");
  });

  test("a name imported from ./<Name>.schema.ts is read from that file, beside this one, under its own or another local name", () => {
    expect(shape('import { Card } from "./Card.schema.ts"; const X = s.object({ card: Card });', [card])).toEqual({
      open: false,
      fields: { card: leafObject("number") },
    });
    expect(shape('import { Card as C } from "./Card.schema.ts"; const X = C;', [card])).toEqual(leafObject("number"));
    expect(shape('import { "Card" as C } from "./Card.schema.ts"; const X = C;', [card])).toEqual(leafObject("number"));
    const deep = { path: "apps/shop/modules/cart/Card.schema.ts", source: card.source };
    expect(
      shape('import { Card } from "./Card.schema.ts"; const X = Card;', [card, deep], "apps/shop/modules/cart/cart.ts"),
    ).toEqual(leafObject("number"));
    expect(shape('import { Card } from "./Card.schema.ts"; const X = Card;', [deep], "Card.user.ts")).toBe("any");
    const top = { path: "Card.schema.ts", source: card.source };
    expect(shape('import { Card } from "./Card.schema.ts"; const X = Card;', [top], "cart.ts")).toEqual(
      leafObject("number"),
    );
  });

  test("the imported file resolves its own names in its own scope", () => {
    const files = [
      {
        path: "modules/cart/Order.schema.ts",
        source:
          'import { Card } from "./Card.schema.ts"; const Line = s.int(); export const Order = s.object({ card: Card, line: Line });',
      },
      card,
    ];
    expect(shape('import { Order } from "./Order.schema.ts"; const Line = s.json(); const X = Order;', files)).toEqual({
      open: false,
      fields: { card: leafObject("number"), line: "leaf" },
    });
  });

  test("any other import is any: another folder, a file that is no .schema.ts, a missing or broken file, a name it lacks", () => {
    const x = "const X = Card;";
    expect(shape(`import { Card } from "../other/Card.schema.ts"; ${x}`, [card])).toBe("any");
    expect(shape(`import { Card } from "./sub/Card.schema.ts"; ${x}`, [card])).toBe("any");
    expect(shape(`import { Card } from "./Card.ts"; ${x}`, [{ ...card, path: "modules/cart/Card.ts" }])).toBe("any");
    expect(shape(`import { Card } from "x./Card.schema.ts"; ${x}`, [card])).toBe("any");
    expect(
      shape(`import { Card } from "./Card.schema.tsx"; ${x}`, [{ ...card, path: "modules/cart/Card.schema.tsx" }]),
    ).toBe("any");
    expect(shape(`import { Card } from "./Card.schema.ts"; ${x}`, [])).toBe("any");
    expect(shape(`import { Card } from "./Card.schema.ts"; ${x}`, [{ ...card, source: "export const = ;" }])).toBe(
      "any",
    );
    expect(shape(`import { Other as Card } from "./Card.schema.ts"; ${x}`, [card])).toBe("any");
    expect(shape(`import Card from "./Card.schema.ts"; ${x}`, [card])).toBe("any");
  });
});

describe("resolveSchema: depth", () => {
  /** `X` reaches `s.string()` through `hops` names. */
  const aliases = (hops: number): string =>
    [
      ...Array.from({ length: hops }, (_, i) => `const ${i === 0 ? "X" : `A${i}`} = A${i + 1};`),
      `const A${hops} = s.string();`,
    ].join("\n");
  const wrapped = (open: string, close: string, n: number): string =>
    `const X = ${open.repeat(n)}s.string()${close.repeat(n)};`;
  const innermost = (v: unknown): unknown => {
    let at = v;
    for (;;) {
      if (typeof at !== "object" || at === null) return at;
      if ("array" in at) at = at.array;
      else if ("fields" in at && typeof at.fields === "object" && at.fields !== null && "a" in at.fields)
        at = at.fields.a;
      else return at;
    }
  };

  test("eight steps down are read; the ninth is any, whatever the step is", () => {
    expect(shape(aliases(8))).toBe("leaf");
    expect(shape(aliases(9))).toBe("any");
    expect(innermost(shape(wrapped("s.array(", ")", 8)))).toBe("leaf");
    expect(innermost(shape(wrapped("s.array(", ")", 9)))).toBe("any");
    expect(innermost(shape(wrapped("s.object({ a: ", " })", 8)))).toBe("leaf");
    expect(innermost(shape(wrapped("s.object({ a: ", " })", 9)))).toBe("any");
    expect(shape(`const X = s.string()${".optional()".repeat(8)};`)).toBe("leaf");
    expect(shape(`const X = s.string()${".optional()".repeat(9)};`)).toBe("any");
  });

  test("each imported file is one step", () => {
    const chain = (n: number): File[] => [
      ...Array.from({ length: n - 1 }, (_, i) => ({
        path: `modules/cart/F${i + 1}.schema.ts`,
        source: `import { V as Next } from "./F${i + 2}.schema.ts"; export const V = Next;`,
      })),
      { path: `modules/cart/F${n}.schema.ts`, source: "export const V = s.string();" },
    ];
    const root = 'import { V } from "./F1.schema.ts"; const X = V;';
    expect(shape(root, chain(8))).toBe("leaf");
    expect(shape(root, chain(9))).toBe("any");
  });
});

describe("hasSchemaPath", () => {
  const leaf: ShapeNode = { kind: "leaf" };
  const any: ShapeNode = { kind: "any" };
  const object = (fields: Record<string, ShapeNode>, open = false): ShapeNode => ({
    kind: "object",
    fields: new Map(Object.entries(fields)),
    open,
  });
  const card = object({ number: leaf, lines: { kind: "array", item: object({ sku: leaf }) }, meta: any });

  test("the empty path is always there, and any path under `any`", () => {
    expect(hasSchemaPath(leaf, [])).toBe(true);
    expect(hasSchemaPath(card, [])).toBe(true);
    expect(hasSchemaPath(any, ["a", "b", null])).toBe(true);
    expect(hasSchemaPath(card, ["meta", "deep", "er"])).toBe(true);
  });

  test("nothing lies under a leaf", () => {
    expect(hasSchemaPath(leaf, ["a"])).toBe(false);
    expect(hasSchemaPath(leaf, [null])).toBe(false);
    expect(hasSchemaPath(card, ["number", "digits"])).toBe(false);
  });

  test("a closed object has its fields and no other; an open one may have any", () => {
    expect(hasSchemaPath(card, ["number"])).toBe(true);
    expect(hasSchemaPath(card, ["cvc"])).toBe(false);
    expect(hasSchemaPath(card, [""])).toBe(false);
    expect(hasSchemaPath(object({ a: leaf }, true), ["zzz", "deep"])).toBe(true);
    expect(hasSchemaPath(object({ a: leaf }, true), ["a", "deep"])).toBe(false);
  });

  test("an array is entered by `*` or an index of digits only", () => {
    expect(hasSchemaPath(card, ["lines", null, "sku"])).toBe(true);
    expect(hasSchemaPath(card, ["lines", "0", "sku"])).toBe(true);
    expect(hasSchemaPath(card, ["lines", "12", "sku"])).toBe(true);
    expect(hasSchemaPath(card, ["lines", "sku"])).toBe(false);
    expect(hasSchemaPath(card, ["lines", "1a", "sku"])).toBe(false);
    expect(hasSchemaPath(card, ["lines", "a1", "sku"])).toBe(false);
    expect(hasSchemaPath(card, ["lines", "", "sku"])).toBe(false);
    expect(hasSchemaPath(card, ["lines", null, "qty"])).toBe(false);
    expect(hasSchemaPath(card, ["lines", "0", "qty"])).toBe(false);
    expect(hasSchemaPath(card, ["lines", "0"])).toBe(true);
  });

  test("a record is entered by any key", () => {
    const by: ShapeNode = { kind: "record", value: object({ n: leaf }) };
    expect(hasSchemaPath(by, ["ada", "n"])).toBe(true);
    expect(hasSchemaPath(by, [null, "n"])).toBe(true);
    expect(hasSchemaPath(by, ["ada", "m"])).toBe(false);
  });

  test("`*` on an object holds when some field holds the rest, or the object is open", () => {
    const o = object({ a: leaf, b: object({ c: leaf }) });
    expect(hasSchemaPath(o, [null])).toBe(true);
    expect(hasSchemaPath(o, [null, "c"])).toBe(true);
    expect(hasSchemaPath(o, [null, "d"])).toBe(false);
    expect(hasSchemaPath(object({}), [null])).toBe(false);
    expect(hasSchemaPath(object({}, true), [null, "d"])).toBe(true);
    expect(hasSchemaPath(object({ a: leaf }, true), [null, "d"])).toBe(true);
  });
});

describe("pathSegments", () => {
  test("splits on dots; a segment that is exactly `*` is null", () => {
    expect(pathSegments("card.number")).toEqual(["card", "number"]);
    expect(pathSegments("lines.*.qty")).toEqual(["lines", null, "qty"]);
    expect(pathSegments("*")).toEqual([null]);
    expect(pathSegments("*.*")).toEqual([null, null]);
    expect(pathSegments("a*.*b.**")).toEqual(["a*", "*b", "**"]);
    expect(pathSegments("")).toEqual([""]);
    expect(pathSegments("a..b.")).toEqual(["a", "", "b", ""]);
  });

  test("a backslash makes the next character literal: a dot, a star or a backslash", () => {
    expect(pathSegments("headers.x\\.trace")).toEqual(["headers", "x.trace"]);
    expect(pathSegments("\\*")).toEqual(["*"]);
    expect(pathSegments("a.\\*.b")).toEqual(["a", "*", "b"]);
    expect(pathSegments("a\\\\.b")).toEqual(["a\\", "b"]);
    expect(pathSegments("\\a\\b")).toEqual(["ab"]);
    expect(pathSegments("*\\.")).toEqual(["*."]);
  });

  test("an escape holds for its own segment only, and a trailing backslash is itself", () => {
    expect(pathSegments("\\*.*")).toEqual(["*", null]);
    expect(pathSegments("\\a.*.b")).toEqual(["a", null, "b"]);
    expect(pathSegments("a\\")).toEqual(["a\\"]);
    expect(pathSegments("\\")).toEqual(["\\"]);
    expect(pathSegments("*.\\")).toEqual([null, "\\"]);
  });

  test("property: plain segments joined by dots come back as they were", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z0-9_-]{1,8}$/), { minLength: 1, maxLength: 6 }), (segments) => {
        expect(pathSegments(segments.join("."))).toEqual(segments);
        expect(pathSegments(segments.map((x) => x.replaceAll("-", "\\-")).join("."))).toEqual(segments);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
