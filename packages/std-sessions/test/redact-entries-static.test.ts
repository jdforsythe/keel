// What E2001 reads from a module's source: `redactLiterals` finds the manifest id and each `redact`/`expose` string
// with the span its fix removes; `pathMissing` says whether an entry's path is proven absent from its target's schema;
// `parseFolder` parses a module folder; `propValue` and `stringLiteral` read object and string literals.
// Seed 1337
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { parseFolder } from "../src/internal/parseFolder.ts";
import { parseTs } from "../src/internal/parseTs.ts";
import { pathMissing } from "../src/internal/pathMissing.ts";
import { redactLiterals } from "../src/internal/redactLiterals.ts";

const literalsOf = (source: string) => {
  const ast = parseTs("modules/cart/module.ts", source);
  if (ast === undefined) throw new Error("the fixture source parses");
  return redactLiterals(ast);
};
const manifest = (config: string, id = "id: 'cart', "): string =>
  `import { module } from '@keel/compiler'\nexport default module({ ${id}std: { '@keel/std-sessions': ${config} } })\n`;
/** `source` after the fix for entry `value`: its removal span cut out. */
const without = (source: string, value: string): string => {
  const hit = literalsOf(source).literals.find((l) => l.value === value);
  if (hit === undefined) throw new Error(`no literal ${value}`);
  expect(source.slice(hit.start, hit.end)).toBe(`'${value}'`);
  return source.slice(0, hit.rmStart) + source.slice(hit.rmEnd);
};

describe("redactLiterals", () => {
  test("reads the manifest id and each string of redact and expose, with its list and its place in the source", () => {
    const source = manifest("{ redact: ['tx:a#b', 'store:c#d'], expose: ['el:e#value'], readers: ['h1'] }");
    const { id, literals } = literalsOf(source);
    expect(id).toBe("cart");
    expect(literals.map((l) => [l.list, l.value, source.slice(l.start, l.end)])).toEqual([
      ["redact", "tx:a#b", "'tx:a#b'"],
      ["redact", "store:c#d", "'store:c#d'"],
      ["expose", "el:e#value", "'el:e#value'"],
    ]);
  });

  test("the literals come in source order, whichever list is written first", () => {
    const exposeFirst = manifest("{ expose: ['e1', 'e2', 'e3'], redact: ['r1', 'r2', 'r3'] }");
    expect(literalsOf(exposeFirst).literals.map((l) => l.value)).toEqual(["e1", "e2", "e3", "r1", "r2", "r3"]);
    const redactFirst = manifest("{ redact: ['r1', 'r2', 'r3'], expose: ['e1', 'e2', 'e3'] }");
    expect(literalsOf(redactFirst).literals.map((l) => l.value)).toEqual(["r1", "r2", "r3", "e1", "e2", "e3"]);
  });

  test("removing an entry takes its comma with it: the only one, the first, a middle one, the last", () => {
    const one = manifest("{ redact: [ 'only' ] }");
    expect(without(one, "only")).toBe(manifest("{ redact: [] }"));
    const three = manifest("{ redact: ['a', 'b', 'c'] }");
    expect(without(three, "a")).toBe(manifest("{ redact: ['b', 'c'] }"));
    expect(without(three, "b")).toBe(manifest("{ redact: ['a', 'c'] }"));
    expect(without(three, "c")).toBe(manifest("{ redact: ['a', 'b'] }"));
    const two = manifest("{ redact: ['a', 'b'] }");
    expect(without(two, "a")).toBe(manifest("{ redact: ['b'] }"));
    expect(without(two, "b")).toBe(manifest("{ redact: ['a'] }"));
  });

  test("elements that are no string literal are skipped but still bound a removal", () => {
    const mixed = manifest("{ redact: [first, 'a', ...more, 5, 'b'] }");
    expect(literalsOf(mixed).literals.map((l) => l.value)).toEqual(["a", "b"]);
    expect(without(mixed, "a")).toBe(manifest("{ redact: [first, ...more, 5, 'b'] }"));
    expect(without(mixed, "b")).toBe(manifest("{ redact: [first, 'a', ...more, 5] }"));
  });

  test("beside a hole an entry is removed alone", () => {
    const holes = manifest("{ redact: ['a', , 'b'] }");
    expect(literalsOf(holes).literals.map((l) => l.value)).toEqual(["a", "b"]);
    expect(without(holes, "a")).toBe(manifest("{ redact: [, , 'b'] }"));
    expect(without(holes, "b")).toBe(manifest("{ redact: ['a', , ] }"));
    const lone = manifest("{ redact: [, 'a'] }");
    expect(without(lone, "a")).toBe(manifest("{ redact: [, ] }"));
  });

  test("the config is read through parentheses, `as` and `satisfies`", () => {
    const source =
      "export default module(({ id: 'cart', std: ({ '@keel/std-sessions': ({ redact: (['a'] as string[]) } satisfies object) } as const) }) as const)\n";
    expect(literalsOf(source)).toMatchObject({ id: "cart", literals: [{ list: "redact", value: "a" }] });
  });

  test("an id that is no string literal is undefined, and the entries are still read", () => {
    expect(literalsOf(manifest("{ redact: ['a'] }", "id: name, "))).toMatchObject({
      id: undefined,
      literals: [{ value: "a" }],
    });
    expect(literalsOf(manifest("{ redact: ['a'] }", "")).id).toBeUndefined();
  });

  test("a list that is no array literal, or a config that is no object literal, gives no entry", () => {
    for (const config of ["{ redact: entries }", "{ redact: 'tx:a#b' }", "{ readers: ['h1'] }", "{}", "config", "[]"])
      expect(literalsOf(manifest(config)), config).toEqual({ id: "cart", literals: [] });
    expect(literalsOf("export default module({ id: 'cart' })")).toEqual({ id: "cart", literals: [] });
    expect(literalsOf("export default module({ id: 'cart', std: config })")).toEqual({ id: "cart", literals: [] });
    expect(literalsOf("export default module({ id: 'cart', std: { other: { redact: ['a'] } } })")).toEqual({
      id: "cart",
      literals: [],
    });
  });

  test("a file whose default export is no call on an object literal gives nothing", () => {
    for (const source of [
      "export const m = module({ id: 'cart' })",
      "export default { id: 'cart' }",
      "export default module()",
      "export default module(...args)",
      "export default module(manifest)",
      "export default module([{ id: 'cart' }])",
      "",
    ])
      expect(literalsOf(source), source).toEqual({ id: undefined, literals: [] });
  });

  test("property: each entry's removal leaves the others, in order", () => {
    const entry = fc.stringMatching(/^[a-z]{1,6}:[a-z]{1,6}#[a-z]{1,6}$/);
    fc.assert(
      fc.property(fc.uniqueArray(entry, { minLength: 1, maxLength: 6 }), fc.nat(), (entries, pick) => {
        const source = manifest(`{ redact: [${entries.map((e) => `'${e}'`).join(", ")}] }`);
        const gone = entries[pick % entries.length] ?? "";
        const after = literalsOf(without(source, gone));
        expect(after.literals.map((l) => l.value)).toEqual(entries.filter((e) => e !== gone));
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});

describe("parseFolder", () => {
  test("parses the .ts files under the folder, skipping others and syntax errors; each scope sees the whole project", () => {
    const project = [
      { path: "modules/cart/cart.ts", source: "export const a = 1;" },
      { path: "modules/cart/test/a.test.ts", source: "export const b = 2;" },
      { path: "modules/cart/broken.ts", source: "export const = ;" },
      { path: "modules/cart/readme.md", source: "# cart" },
      { path: "modules/cart/view.tsx", source: "export const v = 1;" },
      { path: "modules/cartoon/x.ts", source: "export const c = 3;" },
      { path: "apps/modules/cart/y.ts", source: "export const d = 4;" },
    ];
    const parsed = parseFolder(project, "modules/cart/");
    expect(parsed.map((f) => f.path)).toEqual(["modules/cart/cart.ts", "modules/cart/test/a.test.ts"]);
    expect(parsed[0]?.program.type).toBe("Program");
    expect(parsed[0]?.scope.path).toBe("modules/cart/cart.ts");
    expect([...(parsed[0]?.scope.consts.keys() ?? [])]).toEqual(["a"]);
    expect(parsed[1]?.scope.files).toBe(project);
  });
});

describe("pathMissing", () => {
  const project = [
    {
      path: "modules/cart/cart.ts",
      source: `
import { Line } from "./Line.schema.ts";
const tmp = store(s.object({ only: s.string() }), {});
const named = store(s.object({ only: s.string() }), {}, options);
const dynamic = store(s.object({ only: s.string() }), {}, { id: name });
const decoyStore = helper(s.object({ only: s.string() }), {}, { id: 'decoy.store' });
const cart = store(s.object({ card: s.string(), items: s.array(Line) }), { card: '', items: [] }, { "id": 'cart' });
const other = store((s.object({ zip: s.string() })), {}, ({ id: 'other' }) as const);
export const decoyTx = helper(cart, 'decoy.tx', s.object({ only: s.string() }));
export const member = ns.transaction(cart, 'member.tx', s.object({ only: s.string() }));
export const computed = transaction(cart, nameOf, s.object({ only: s.string() }), fn);
export const add = transaction(cart, 'cart.add', s.object({ sku: s.string() }), fn);
export const pay = transaction(cart, 'cart.pay', s.object({ card: s.object({ number: s.string() }) }), fn);
export const bare = transaction(cart, 'cart.bare');
export const decoyError = z.error('decoy.error', s.object({ only: s.string() }));
export const decoyFail = s.fail('decoy.fail', s.object({ only: s.string() }));
export const Full = s.error('cart.full', s.object({ at: s.string(), max: s.int() }));
export const Bare = s.error('cart.bare');
export const decoyRoutes = helper({ 'decoy.route': { params: s.object({ only: s.string() }) } });
export const early = manifest(table, {});
export const first = manifest({ 'cart.ref': entry, 'cart.home': { path: '/' } }, {});
export const routes = manifest({
  'cart.show': { path: '/cart/:id', params: s.object({ id: s.string() }), search: s.object({ q: s.string().optional() }) },
  'cart.late': ({ path: '/late', params: s.object({ id: s.string() }) }),
  'cart.ref': { path: '/ref', params: s.object({ id: s.string() }) },
}, {});
`,
    },
    {
      path: "modules/cart/Line.schema.ts",
      source: "export const Line = s.object({ sku: s.string(), qty: s.int() });",
    },
  ];
  const files = parseFolder(project, "modules/cart/");
  const missing = (subject: string, name: string, path: string): boolean => pathMissing(subject, name, path, files);

  test("el: only `value` is a path of an element", () => {
    expect(missing("el", "cart.card", "value")).toBe(false);
    expect(missing("el", "cart.card", "checked")).toBe(true);
    expect(missing("el", "cart.card", "")).toBe(true);
    expect(pathMissing("el", "cart.card", "value", [])).toBe(false);
  });

  test("tx: the path is looked up in the payload schema of the transaction of that name", () => {
    expect(missing("tx", "cart.pay", "card.number")).toBe(false);
    expect(missing("tx", "cart.pay", "card")).toBe(false);
    expect(missing("tx", "cart.pay", "card.cvc")).toBe(true);
    expect(missing("tx", "cart.pay", "sku")).toBe(true);
    expect(missing("tx", "cart.add", "sku")).toBe(false);
    expect(missing("tx", "cart.add", "card.number")).toBe(true);
  });

  test("tx: an unknown name, a transaction with no schema, and a call that is no `transaction(...)` prove nothing", () => {
    expect(missing("tx", "cart.unknown", "zzz")).toBe(false);
    expect(missing("tx", "cart.bare", "zzz")).toBe(false);
    expect(missing("tx", "decoy.tx", "zzz")).toBe(false);
    expect(missing("tx", "member.tx", "zzz")).toBe(false);
    expect(missing("tx", "cart", "zzz")).toBe(false);
    expect(missing("tx", "cart.full", "data.zzz")).toBe(false);
    expect(missing("tx", "cart.show", "params.zzz")).toBe(false);
  });

  test("store: the path is looked up in the schema of the store of that id, through an imported schema", () => {
    expect(missing("store", "cart", "card")).toBe(false);
    expect(missing("store", "cart", "zip")).toBe(true);
    expect(missing("store", "other", "zip")).toBe(false);
    expect(missing("store", "other", "card")).toBe(true);
    expect(missing("store", "cart", "items.*.sku")).toBe(false);
    expect(missing("store", "cart", "items.0.qty")).toBe(false);
    expect(missing("store", "cart", "items.*.price")).toBe(true);
    expect(missing("store", "cart", "items.sku")).toBe(true);
  });

  test("store: an unknown id, and a call that is no `store(...)` with an id literal, prove nothing", () => {
    expect(missing("store", "unknown", "zzz")).toBe(false);
    expect(missing("store", "decoy.store", "zzz")).toBe(false);
    expect(missing("store", "cart.pay", "card.cvc")).toBe(false);
    expect(missing("store", "cart.full", "data.zzz")).toBe(false);
    expect(missing("store", "cart.show", "params.zzz")).toBe(false);
  });

  test("error: a path is `data.<path>` in the data schema of `s.error(<code>, ...)`; any other path is missing", () => {
    expect(missing("error", "cart.full", "data.at")).toBe(false);
    expect(missing("error", "cart.full", "data.max")).toBe(false);
    expect(missing("error", "cart.full", "data.zzz")).toBe(true);
    expect(missing("error", "cart.full", "at")).toBe(true);
    expect(missing("error", "cart.full", "message")).toBe(true);
    expect(missing("error", "cart.full", "12345at")).toBe(true);
    expect(missing("error", "cart.bare", "data.at")).toBe(false);
    expect(missing("error", "cart.bare", "at")).toBe(true);
  });

  test("error: an unknown code, another object's `error` and another `s` method prove nothing", () => {
    expect(missing("error", "cart.unknown", "data.zzz")).toBe(false);
    expect(missing("error", "cart.unknown", "zzz")).toBe(false);
    expect(missing("error", "decoy.error", "data.zzz")).toBe(false);
    expect(missing("error", "decoy.fail", "data.zzz")).toBe(false);
    expect(missing("error", "cart.pay", "data.zzz")).toBe(false);
    expect(missing("error", "cart", "data.zzz")).toBe(false);
  });

  test("route: `params.<path>` and `search.<path>` are looked up in the entry's schemas; any other path is missing", () => {
    expect(missing("route", "cart.show", "params.id")).toBe(false);
    expect(missing("route", "cart.show", "params.zzz")).toBe(true);
    expect(missing("route", "cart.show", "search.q")).toBe(false);
    expect(missing("route", "cart.show", "search.id")).toBe(true);
    expect(missing("route", "cart.show", "id")).toBe(true);
    expect(missing("route", "cart.show", "1234567q")).toBe(true);
    expect(missing("route", "cart.show", "xparams.id")).toBe(true);
  });

  test("route: an entry with no schema for that half proves nothing; an entry is found in a later manifest", () => {
    expect(missing("route", "cart.home", "params.id")).toBe(false);
    expect(missing("route", "cart.home", "search.q")).toBe(false);
    expect(missing("route", "cart.home", "id")).toBe(true);
    expect(missing("route", "cart.late", "params.id")).toBe(false);
    expect(missing("route", "cart.late", "params.zzz")).toBe(true);
    expect(missing("route", "cart.late", "search.q")).toBe(false);
    expect(missing("route", "cart.ref", "params.zzz")).toBe(true);
    expect(missing("route", "cart.ref", "params.id")).toBe(false);
  });

  test("route: an unknown id and a call that is no `manifest(...)` prove nothing", () => {
    expect(missing("route", "cart.unknown", "params.zzz")).toBe(false);
    expect(missing("route", "cart.unknown", "zzz")).toBe(false);
    expect(missing("route", "decoy.route", "params.zzz")).toBe(false);
    expect(missing("route", "cart.pay", "params.zzz")).toBe(false);
  });

  test("an unknown subject, or no file, proves nothing", () => {
    expect(missing("user", "cart", "zzz")).toBe(false);
    expect(missing("", "cart.pay", "zzz")).toBe(false);
    expect(pathMissing("tx", "cart.pay", "card.cvc", [])).toBe(false);
  });
});
