// k.reveal, Rules "E1112 a value `reveal` returns reaching a sink, in app code (no fix): one finding per sink, at the first carrying argument."
// k.reveal, Flow "A value carries one when it is:" (each item) and "Any other call, a parameter and an import end it (a hash passes; a helper is not read)."
// Spec: k.reveal, clause "In a `*.server.ts` file, `tx(t, { v: reveal(p.k) })`, the same through a `const` or in `meta`, `ctx.storage.set(k, reveal(p.k))`, `console.log(reveal(p.k))` and `new Error('x' + reveal(p.k))` are each one E1112; `tx(t, { v: hash(reveal(p.k)) })`, `reveal(p.k) === h` and a call of a local named `reveal` are none."
// Spec: k.reveal, clause "Each sink above, and each carrier above wrapped 1 to 4 deep, is one E1112; the same under one local call is none."
// k.reveal Sinks (each sentence) and
// Spec: k.reveal, clause "`reveal(p.k).length`, `.startsWith('a')`, `reveal(p.k) && y`, `o.b` of `{ a: reveal(p.k), b: 1 }`, a `let` reassigned to a hash, and `set` on a `new Map()` named `storage` are none."
// Seed: 1337.
// E1112 has no fix; fix-diffs.test.ts records it.
// Loose: the spec gives no exact message or column, so findings are asserted by code, path and the line of the argument.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Files } from "./support.ts";
import { SEED } from "./support.ts";

const f = (path: string, source: string): Files[number] => ({ path, source });
const MANIFEST = f(
  "modules/app/module.ts",
  `import { module } from '@keel/compiler'\nexport default module({ id: 'app', deps: [], capabilities: [], public: { exports: [] } })\n`,
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
/** As `expectOne`, with `imports` added under the head. */
const expectOneWith = (lines: string[], at: number, imports: string) => {
  const s = server(lines, SERVER, `${HEAD}\n${imports}`);
  const ds = e1112([s.file]);
  expect(ds).toHaveLength(1);
  expect(ds[0]?.line).toBe(s.line(at));
  expect(ds[0]?.fix).toBeUndefined();
};
const expectNoneWith = (lines: string[], imports: string) => {
  expect(e1112([server(lines, SERVER, `${HEAD}\n${imports}`).file])).toHaveLength(0);
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
    expect(ds[0]?.see).toBe("k.reveal");
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

  test("E1112 reports a file under `unsafe/` outside any `unsafe(` call (E1112 is not a lifted code)", () => {
    expectOne(["tx(t, { v: reveal(p.k) })"], 0, "modules/app/unsafe/x.server.ts");
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

describe("k.reveal E1112 sinks", () => {
  test("E1112 reports `process.stdout.write(reveal(p.k))`", () => {
    expectOne(["process.stdout.write(reveal(p.k))"], 0);
  });

  test("E1112 reports `process.stderr.write(reveal(p.k))`", () => {
    expectOne(["process.stderr.write(reveal(p.k))"], 0);
  });

  test("E1112 reports `throw reveal(p.k)`", () => {
    expectOne(["throw reveal(p.k)"], 0);
  });

  test("E1112 reports `throw { t: reveal(p.k) }`", () => {
    expectOne(["throw { t: reveal(p.k) }"], 0);
  });

  test("E1112 reports `return Promise.reject(reveal(p.k))`", () => {
    expectOne(["return Promise.reject(reveal(p.k))"], 0);
  });

  test("E1112 reports a thrown `new Error('x' + reveal(p.k))` once, not once for the throw and again for the constructor", () => {
    expectOne(["throw new Error('x' + reveal(p.k))"], 0);
  });

  test("E1112 reports `writeFileSync('f', reveal(p.k))` imported from `node:fs`", () => {
    expectOneWith(["writeFileSync('f', reveal(p.k))"], 0, "import { writeFileSync } from 'node:fs'");
  });

  test("E1112 reports `fs.writeFileSync('f', reveal(p.k))` on a default import of `node:fs`", () => {
    expectOneWith(["fs.writeFileSync('f', reveal(p.k))"], 0, "import fs from 'node:fs'");
  });

  test("E1112 reports `await writeFile('f', reveal(p.k))` imported from `node:fs/promises`", () => {
    expectOneWith(["await writeFile('f', reveal(p.k))"], 0, "import { writeFile } from 'node:fs/promises'");
  });

  test("E1112 reports `appendFileSync('f', reveal(p.k))` imported from `node:fs`", () => {
    expectOneWith(["appendFileSync('f', reveal(p.k))"], 0, "import { appendFileSync } from 'node:fs'");
  });

  test("E1112 reports each of `writeFile`, `writeFileSync`, `appendFile`, `appendFileSync`, `write` and `writeSync` from `node:fs` and `node:fs/promises`", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("writeFile", "writeFileSync", "appendFile", "appendFileSync", "write", "writeSync"),
        fc.constantFrom("node:fs", "node:fs/promises"),
        (name, mod) => {
          expectOneWith([`${name}('f', reveal(p.k))`], 0, `import { ${name} } from '${mod}'`);
        },
      ),
      { seed: SEED, numRuns: 24 },
    );
  });
});

describe("k.reveal E1112 sink names", () => {
  test("E1112 reports `log(reveal(p.k))` after `const log = console.log.bind(console)`", () => {
    expectOne(["const log = console.log.bind(console)", "log(reveal(p.k))"], 1);
  });

  test("E1112 reports `st.set('k', reveal(p.k))` after `const st = ctx.storage`", () => {
    expectOne(["const st = ctx.storage", "st.set('k', reveal(p.k))"], 1);
  });

  test("E1112 reports `s.set('k', reveal(p.k))` after `const { storage: s } = ctx`", () => {
    expectOne(["const { storage: s } = ctx", "s.set('k', reveal(p.k))"], 1);
  });

  test("E1112 reports a `set` on a parameter named `storage`", () => {
    expectOne(["const save = async ({ storage }) => storage.set('k', reveal(p.k))"], 0);
  });
});

describe("k.reveal E1112 flow", () => {
  test("E1112 follows the value through `'x'.concat(reveal(p.k))`", () => {
    expectOne(["ctx.storage.set('k', 'x'.concat(reveal(p.k)))"], 0);
  });

  test("E1112 follows the value through a `for...of` head", () => {
    expectOne(["for (const v of [reveal(p.k)]) ctx.storage.set('k', v)"], 0);
  });

  test("E1112 follows a local bound to `reveal`", () => {
    expectOne(["const open = reveal", "console.log(open(p.k))"], 1);
  });

  test("E1112 follows the value through a member write (`o.k = reveal(p.k)`)", () => {
    expectOne(["const o = {}", "o.k = reveal(p.k)", "ctx.storage.set('k', JSON.stringify(o))"], 2);
  });

  test("E1112 follows the value through an argument of `push`", () => {
    expectOne(["const a = []", "a.push(reveal(p.k))", "console.log(a)"], 2);
  });

  test("E1112 follows the value through the field of an object literal that holds it", () => {
    expectOne(["const o = { token: reveal(p.k), name: 'n' }", "tx(t, { v: o.token })"], 1);
  });

  test("E1112 reports a `let` reassigned under a condition, since the read may see the value", () => {
    expectOne(["let d = reveal(p.k)", "if (p.on) d = hash(d)", "tx(t, { v: d })"], 2);
  });

  test("E1112 follows the value through `reveal(p.k) || 'none'`", () => {
    expectOne(["tx(t, { v: reveal(p.k) || 'none' })"], 0);
  });

  const conversions = [
    "new String(reveal(p.k))",
    "String.raw`${reveal(p.k)}`",
    "structuredClone({ k: reveal(p.k) })",
    "btoa(reveal(p.k))",
    "encodeURI(reveal(p.k))",
    "encodeURIComponent(reveal(p.k))",
    "Buffer.from(reveal(p.k)).toString('base64')",
    "Array.from(reveal(p.k))",
    "Object.values({ k: reveal(p.k) })",
    "Object.entries({ k: reveal(p.k) })",
    "Object.assign({}, { k: reveal(p.k) })",
  ];
  test("E1112 follows the value through each standard conversion and encoding", () => {
    fc.assert(
      fc.property(fc.constantFrom(...conversions), (x) => {
        expectOne([`tx(t, { v: ${x} })`], 0);
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});

describe("k.reveal E1112 ends", () => {
  test("E1112 does not report a test of the value: `.length`, `.size`, `.startsWith`, `.includes`, `.endsWith`, `.indexOf`, `.has`", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ".length",
          ".size",
          ".startsWith('sk_')",
          ".includes(':')",
          ".endsWith('=')",
          ".indexOf('x')",
          ".has('x')",
        ),
        (m) => {
          expectNone([`tx(t, { v: reveal(p.k)${m} })`]);
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("E1112 does not report `reveal(p.k) && y`: the left side of `&&` is a test", () => {
    expectNone(["const ok = reveal(p.k) && p.on", "tx(t, { v: ok })"]);
  });

  test("E1112 does not report a `let` reassigned to a hash before the read", () => {
    expectNone(["let d = reveal(p.k)", "d = hash(d)", "tx(t, { v: d })"]);
  });

  test("E1112 does not report `o.name` of `{ token: reveal(p.k), name: 'n' }`", () => {
    expectNone(["const o = { token: reveal(p.k), name: 'n' }", "tx(t, { v: o.name })"]);
  });

  test("E1112 does not report a destructured `name` of `{ token: reveal(p.k), name: 'n' }`", () => {
    expectNone(["const { name } = { token: reveal(p.k), name: 'n' }", "tx(t, { v: name })"]);
  });

  test("E1112 does not report `o.name` after a member write of the value to `o.token`", () => {
    expectNone(["const o = { name: 'n' }", "o.token = reveal(p.k)", "tx(t, { v: o.name })"]);
  });

  test("E1112 does not report `set` on a `new Map()` named `storage`", () => {
    expectNone(["const storage = new Map()", "storage.set('k', reveal(p.k))"]);
  });

  test("E1112 does not report a `createHash` digest of the value", () => {
    expectNoneWith(
      ["tx(t, { v: createHash('sha256').update(reveal(p.k)).digest('hex') })"],
      "import { createHash } from 'node:crypto'",
    );
  });

  test("E1112 does not report a `scryptSync` derivation from the value", () => {
    expectNoneWith(
      ["tx(t, { v: scryptSync(reveal(p.k), 's', 64).toString('hex') })"],
      "import { scryptSync } from 'node:crypto'",
    );
  });

  // Known limit: a same-file helper's body is not read, so the encoding in it is not seen.
  test("E1112 does not report a value passed through a local helper that encodes it (known limit)", () => {
    expectNone(["const enc = (x) => btoa(x)", "tx(t, { v: enc(reveal(p.k)) })"]);
  });

  // Known limit: a callback's parameter is not followed.
  test("E1112 does not report a value reaching a sink through a callback's parameter (known limit)", () => {
    expectNone(["[reveal(p.k)].forEach((v) => ctx.storage.set('k', v))"]);
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
  { name: "concat", wrap: (e) => `'x'.concat(${e})` },
  { name: "btoa", wrap: (e) => `btoa(${e})` },
  {
    name: "push",
    wrap: (e, n, pre) => {
      pre.push(`const q${n} = []`, `q${n}.push(${e})`);
      return `q${n}`;
    },
  },
  { name: "field", wrap: (e) => `({ a: ${e}, b: 1 }).a` },
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
