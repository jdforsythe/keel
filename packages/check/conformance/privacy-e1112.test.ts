// Spec: k.privacy, Rules "E1112 a value `reveal` returns reaching an argument of `tx` or `store` (`@keel/store`), `set` or `commit` on a `storage`, a `console` method or an `Error` constructor, in app code (no fix)."
// Spec: k.privacy, Rules "It is followed by lexical scope through same-file bindings (each value given), members, spreads, literals, templates, operators, `await`, `String()`, `JSON.stringify()` and methods called on it; any other call, a parameter and an import end it (a hash passes; a helper is not read)."
// Spec: k.privacy, Conformance "In a `*.server.ts` file, `tx(t, { v: reveal(p.k) })`, the same through a `const` or in `meta`, `ctx.storage.set(k, reveal(p.k))`, `console.log(reveal(p.k))` and `new Error('x' + reveal(p.k))` are each one E1112; `tx(t, { v: hash(reveal(p.k)) })`, `reveal(p.k) === h` and a call of a local named `reveal` are none."
// Seed: 1337.
// Skipped until the rule lands (the implementer removes `.skip`). E1112 has no fix; fix-diffs.test.ts records it.
// Loose: the spec gives no exact message or column, so findings are asserted by code, path and the line of the argument.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`,
);
const e1112 = (files: Files) =>
  check([MANIFEST, ...files], { types: false }).diagnostics.filter((d) => d.code === "E1112");

const HEAD = [
  "import { reveal } from '@keel/schema'",
  "import { tx, store } from '@keel/store'",
  "const hash = (x) => x.length",
  "const t = {}",
  "const S = {}",
  "const K = {}",
  "const h = ''",
].join("\n");
const SERVER = "modules/app/x.server.ts";
/** A server file whose action body is `lines`; returns the file and the 1-based line of each body line. */
const server = (lines: string[], path = SERVER, head = HEAD) => {
  const src = `${head}\nexport async function act(ctx, p) {\n${lines.map((l) => `  ${l}`).join("\n")}\n}\n`;
  const first = head.split("\n").length + 2;
  return { file: f(path, src), line: (i: number) => first + i };
};
/** Asserts exactly one E1112 on body line `at`, with no fix. */
const expectOne = (lines: string[], at: number, path = SERVER) => {
  const s = server(lines, path);
  const ds = e1112([s.file]);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.path).toBe(path);
  expect(ds[0]?.line).toBe(s.line(at));
  expect(ds[0]?.fix).toBeUndefined();
};
const expectNone = (lines: string[], path = SERVER) => {
  expect(e1112([server(lines, path).file])).toHaveLength(0);
};

describe("k.privacy E1112", () => {
  test("E1112 reports `tx(t, { v: reveal(p.k) })` once at the argument, with no fix", () => {
    const s = server(["tx(t, { v: reveal(p.k) })"]);
    const ds = e1112([s.file]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.line).toBe(s.line(0));
    expect(ds[0]?.fix).toBeUndefined();
    expect(ds[0]?.see).toBe("k.privacy");
  });

  test("E1112 reports the same value through a `const`", () => {
    expectOne(["const v = reveal(p.k)", "tx(t, { v })"], 1);
  });

  test("E1112 reports the same value in `meta`", () => {
    expectOne(["tx(t, { v: 1 }, { meta: { v: reveal(p.k) } })"], 0);
  });

  test("E1112 reports `ctx.storage.set(k, reveal(p.k))`", () => {
    expectOne(["ctx.storage.set('k', reveal(p.k))"], 0);
  });

  test("E1112 reports `ctx.storage.commit` with a revealed value", () => {
    expectOne(["ctx.storage.commit('k', reveal(p.k))"], 0);
  });

  test("E1112 reports `store(S, { t: reveal(K) })`", () => {
    expectOne(["store(S, { t: reveal(K) })"], 0);
  });

  test("E1112 reports `console.log(reveal(p.k))`", () => {
    expectOne(["console.log(reveal(p.k))"], 0);
  });

  test("E1112 reports each console method", () => {
    fc.assert(
      fc.property(fc.constantFrom("log", "warn", "error", "info", "debug"), (m) => {
        expectOne([`console.${m}(reveal(p.k))`], 0);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("E1112 reports `new Error('x' + reveal(p.k))`", () => {
    expectOne(["throw new Error('x' + reveal(p.k))"], 0);
  });

  test("E1112 reports one finding per sink argument, each at its own line", () => {
    const s = server(["tx(t, { v: reveal(p.k) })", "console.log(reveal(p.k))"]);
    const ds = e1112([s.file]);
    expect(ds.map((d) => d.line).sort((a, b) => a - b)).toEqual([s.line(0), s.line(1)]);
  });

  test("E1112 follows the value through a `const` alias of an alias", () => {
    expectOne(["const a = reveal(p.k)", "const b = a", "console.log(b)"], 2);
  });

  test("E1112 follows the value through object destructuring of a literal that holds it", () => {
    expectOne(["const { a } = { a: reveal(p.k) }", "tx(t, { v: a })"], 1);
  });

  test("E1112 follows the value through array destructuring of a literal that holds it", () => {
    expectOne(["const [a] = [reveal(p.k)]", "tx(t, { v: a })"], 1);
  });

  test("E1112 follows the value into a closure in the same file", () => {
    expectOne(["const a = reveal(p.k)", "const g = () => tx(t, { v: a })", "g()"], 1);
  });

  test("E1112 follows the value through `String()`", () => {
    expectOne(["tx(t, { v: String(reveal(p.k)) })"], 0);
  });

  test("E1112 follows the value through `JSON.stringify()`", () => {
    expectOne(["tx(t, { v: JSON.stringify(reveal(p.k)) })"], 0);
  });

  test("E1112 follows the value through a method called on it", () => {
    expectOne(["tx(t, { v: reveal(p.k).trim() })"], 0);
  });

  test("E1112 does not report a call other than `String()`, `JSON.stringify()` or a method on the value (a hash passes)", () => {
    expectNone(["tx(t, { v: hash(reveal(p.k)) })"]);
  });

  test("E1112 does not report a value derived by a call, through a `const`", () => {
    expectNone(["const d = hash(reveal(p.k))", "tx(t, { v: d })", "console.log(d)"]);
  });

  test("E1112 does not report a helper's use of the value (a helper is not read)", () => {
    expectNone(["const leak = (x) => console.log(x)", "leak(reveal(p.k))"]);
  });

  test("E1112 does not report a parameter (it ends the flow)", () => {
    expectNone(["const f = (v) => tx(t, { v })", "f(reveal(p.k))"]);
  });

  test("E1112 does not report an import (it ends the flow)", () => {
    const s = server(["tx(t, { v: imported })"], SERVER, `${HEAD}\nimport { imported } from './other.ts'`);
    expect(
      e1112([
        s.file,
        f("modules/app/other.ts", "import { reveal } from '@keel/schema'\nexport const imported = reveal(0)\n"),
      ]),
    ).toHaveLength(0);
  });

  test("E1112 does not report `reveal(p.k) === h`", () => {
    expectNone(["const ok = reveal(p.k) === h", "tx(t, { v: ok })"]);
  });

  test("E1112 does not report a call of a local named `reveal`", () => {
    const head = HEAD.replace("import { reveal } from '@keel/schema'", "const reveal = (x) => x");
    const s = server(["tx(t, { v: reveal(p.k) })", "console.log(reveal(p.k))"], SERVER, head);
    expect(e1112([s.file])).toHaveLength(0);
  });

  test("E1112 does not report the `Secret` itself passed to a sink", () => {
    expectNone(["tx(t, { v: p.k })", "console.log(p.k)"]);
  });

  test("E1112 does not report a response: the revealed value returned is no sink", () => {
    expectNone(["const v = reveal(p.k)", "return { token: v, again: reveal(p.k) }"]);
  });

  test("E1112 reports `<namespace>.reveal` the same as a named import", () => {
    const head = HEAD.replace("import { reveal } from '@keel/schema'", "import * as sc from '@keel/schema'");
    const s = server(["tx(t, { v: sc.reveal(p.k) })"], SERVER, head);
    const ds = e1112([s.file]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.line).toBe(s.line(0));
  });

  test("E1112 reports a `storage` taken by `const { storage } = ctx`", () => {
    expectOne(["const { storage } = ctx", "storage.set('k', reveal(p.k))"], 1);
  });

  test("E1112 does not report a file under `unsafe/`", () => {
    expectNone(["tx(t, { v: reveal(p.k) })"], "modules/app/unsafe/x.server.ts");
  });

  test("E1112 does not report a test file", () => {
    expectNone(["tx(t, { v: reveal(p.k) })"], "modules/app/x.test.ts");
  });

  test("E1112 reports the `copy` action in `modules/app/c.server.ts` once", () => {
    const src = [
      "import { reveal } from '@keel/schema'",
      "import { tx } from '@keel/store'",
      "const copy = {}",
      "export async function run(ctx, p) {",
      "  tx(copy, { t: reveal(p.k) })",
      "}",
      "",
    ].join("\n");
    const ds = e1112([f("modules/app/c.server.ts", src)]);
    expect(ds).toHaveLength(1);
    expect(ds[0]?.line).toBe(5);
    expect(ds[0]?.fix).toBeUndefined();
  });
});

// Carriers: each takes the expression so far and a counter, and gives the next expression, pushing statements first.
interface Carrier {
  name: string;
  wrap: (e: string, n: number, pre: string[]) => string;
}
const CARRIERS: Carrier[] = [
  {
    name: "const",
    wrap: (e, n, pre) => {
      pre.push(`const a${n} = ${e}`);
      return `a${n}`;
    },
  },
  { name: "member", wrap: (e) => `({ m: ${e} }).m` },
  { name: "template", wrap: (e) => `\`x\${${e}}\`` },
  { name: "plus", wrap: (e) => `'a' + ${e}` },
  { name: "object", wrap: (e) => `{ o: ${e} }` },
  { name: "array", wrap: (e) => `[${e}]` },
  { name: "spread", wrap: (e) => `[...${e}]` },
  { name: "conditional", wrap: (e) => `(p.on ? ${e} : 'z')` },
  { name: "await", wrap: (e) => `(await ${e})` },
  { name: "trim", wrap: (e) => `(${e}).trim()` },
  { name: "String", wrap: (e) => `String(${e})` },
];
const carriers = fc.array(fc.constantFrom(...CARRIERS), { minLength: 1, maxLength: 4 });
const build = (cs: Carrier[], base: string): { lines: string[]; at: number } => {
  const pre: string[] = [];
  let e = base;
  cs.forEach((c, i) => {
    e = c.wrap(e, i, pre);
  });
  return { lines: [...pre, `tx(t, { v: ${e} })`], at: pre.length };
};

describe("k.privacy E1112 carriers", () => {
  test("E1112 reports exactly one finding, with no fix, when `reveal(p.k)` is wrapped in 1 to 4 carriers", () => {
    fc.assert(
      fc.property(carriers, (cs) => {
        const { lines, at } = build(cs, "reveal(p.k)");
        expectOne(lines, at);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  test("E1112 reports nothing when the same carriers wrap one call of a local function", () => {
    fc.assert(
      fc.property(carriers, (cs) => {
        const { lines } = build(cs, "hash(reveal(p.k))");
        expectNone(lines);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
