// E1112 over destructuring assignment, more mutations and conversions, a sink's .call, .apply, .bind and
// Reflect.apply, and a destructured name read at `length`; each case beside a look-alike that is none.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const HEAD = "import { reveal } from '@keel/schema'\nimport { tx } from '@keel/store'\nconst hash = (x) => x.length\n";
/** Each finding of `body` as `line sink`; the first body line is line 5 under `HEAD`. */
const hits = (body: string[]): string[] =>
  check(
    [
      {
        path: "modules/app/x.server.ts",
        source: `${HEAD}export async function act(ctx, p) {\n${body.map((l) => `  ${l}`).join("\n")}\n}\n`,
      },
    ],
    { types: false },
  )
    .diagnostics.filter((d) => d.code === "E1112")
    .map((d) => `${d.line} ${d.message.split(" ")[4]?.slice(0, -1)}`);

describe("E1112 destructuring assignment and for...of heads", () => {
  it("follows an array or object pattern assignment, a rest, a default and a member target", () => {
    expect(hits(["let a", "[a] = [reveal(p.k)]", "console.log(a)"])).toEqual(["7 console.log"]);
    expect(hits(["let a", "({ a } = { a: reveal(p.k) })", "console.log(a)"])).toEqual(["7 console.log"]);
    expect(hits(["let a, b", "[a, ...b] = [1, reveal(p.k)]", "console.log(b)"])).toEqual(["7 console.log"]);
    expect(hits(["let a", "({ a = 1 } = { a: reveal(p.k) })", "console.log(a)"])).toEqual(["7 console.log"]);
    expect(hits(["const o = {}", "[o.k] = [reveal(p.k)]", "console.log(o.k)"])).toEqual(["7 console.log"]);
  });

  it("reads an object pattern assignment at its key", () => {
    expect(hits(["let b", "({ b } = { a: reveal(p.k), b: 1 })", "console.log(b)"])).toEqual([]);
    expect(hits(["let c", "({ a: c } = { a: reveal(p.k), b: 1 })", "console.log(c)"])).toEqual(["7 console.log"]);
  });

  it("hides earlier values after a pattern assignment statement, and not after one in a branch", () => {
    expect(hits(["let a = reveal(p.k)", "[a] = [hash(a)]", "console.log(a)"])).toEqual([]);
    expect(hits(["let a = reveal(p.k)", "({ a } = { a: hash(a) })", "console.log(a)"])).toEqual([]);
    expect(hits(["let a = reveal(p.k)", "if (p.on) [a] = [hash(a)]", "console.log(a)"])).toEqual(["7 console.log"]);
    expect(hits(["let a = 1", "[a] = [reveal(p.k)]", "console.log(a)"])).toEqual(["7 console.log"]);
  });

  it("follows a for...of head with no declaration: a name, a pattern, a member", () => {
    expect(hits(["let x", "for (x of [reveal(p.k)]) console.log(x)"])).toEqual(["6 console.log"]);
    expect(hits(["let x", "for ([x] of [[reveal(p.k)]]) console.log(x)"])).toEqual(["6 console.log"]);
    expect(hits(["const o = {}", "for (o.x of [reveal(p.k)]) console.log(o.x)"])).toEqual(["6 console.log"]);
    expect(hits(["let x", "for (x of [hash(reveal(p.k))]) console.log(x)"])).toEqual([]);
    expect(hits(["let x", "for (x in { k: reveal(p.k) }) console.log(x)"])).toEqual([]);
  });
});

describe("E1112 splice and fill", () => {
  it("follows an argument of splice or fill on a local, and ends at its length", () => {
    expect(hits(["const q = []", "q.splice(0, 0, reveal(p.k))", "console.log(q)"])).toEqual(["7 console.log"]);
    expect(hits(["const q = [0]", "q.fill(reveal(p.k))", "console.log(q)"])).toEqual(["7 console.log"]);
    expect(hits(["const q = [0]", "q.fill(reveal(p.k))", "console.log(q.length)"])).toEqual([]);
    expect(hits(["const q = [1, 2]", "q.splice(0, 1)", "console.log(q)"])).toEqual([]);
    expect(hits(["const q = [1, 2]", "q.slice(0, reveal(p.k))", "console.log(q)"])).toEqual([]);
  });

  it("carries an argument of fill, set and add into the result", () => {
    expect(
      hits([
        "console.log(Array(2).fill(reveal(p.k)))",
        "console.log(new Map().set('k', reveal(p.k)))",
        "console.log(new Set().add(reveal(p.k)))",
        "console.log(new Map().get(reveal(p.k)))",
        "console.log(new Set().delete(reveal(p.k)))",
      ]),
    ).toEqual(["5 console.log", "6 console.log", "7 console.log"]);
  });
});

describe("E1112 collections and conversions", () => {
  const forms = [
    "new Map([['k', reveal(p.k)]])",
    "new Set([reveal(p.k)])",
    "Object.fromEntries([['k', reveal(p.k)]])",
    "Array.of(reveal(p.k))",
    "new Map().set('k', reveal(p.k))",
    "new Set().add(reveal(p.k))",
  ];

  it("carries each new conversion, and ends at its size or has", () => {
    for (const x of forms) {
      expect(hits([`tx(t, { v: ${x} })`])).toEqual(["5 tx"]);
      expect(hits([`tx(t, { v: ${x}.size })`])).toEqual([]);
      expect(hits([`tx(t, { v: ${x}.has('k') })`])).toEqual([]);
    }
  });

  it("carries a conversion of a local, and no constructor off the list", () => {
    expect(hits(["const e = [['k', reveal(p.k)]]", "const m = new Map(e)", "console.log(m)"])).toEqual([
      "7 console.log",
    ]);
    expect(
      hits([
        "console.log(new WeakMap([[{}, reveal(p.k)]]))",
        "console.log(new WeakSet([reveal(p.k)]))",
        "console.log(new Map([['k', hash(reveal(p.k))]]))",
      ]),
    ).toEqual([]);
  });
});

describe("E1112 .call, .apply, .bind and Reflect.apply of a sink", () => {
  it("passes the arguments after the this value to the sink", () => {
    expect(
      hits([
        "console.log.call(console, reveal(p.k))",
        "console.log.apply(console, [reveal(p.k)])",
        "Reflect.apply(console.log, console, [reveal(p.k)])",
        "ctx.storage.set.call(ctx.storage, 'k', reveal(p.k))",
        "tx.call(null, t, { v: reveal(p.k) })",
        "console['log']['call'](console, reveal(p.k))",
      ]),
    ).toEqual(["5 console.log", "6 console.log", "7 console.log", "8 storage.set", "9 tx", "10 console.log"]);
  });

  it("reports bound arguments once, at the bind", () => {
    expect(hits(["const l = console.log.bind(console, reveal(p.k))", "l()", "l('x')"])).toEqual(["5 console.log"]);
  });

  it("names the sink under a local name, and reports at the first carrying argument", () => {
    expect(hits(["const log = console.log", "log.call(null, 'x', reveal(p.k))"])).toEqual(["6 console.log"]);
    expect(hits(["console.log.call(", "  console,", "  'x',", "  reveal(p.k),", ")"])).toEqual(["8 console.log"]);
  });

  it("does not report the this value, a call off a sink, or a hashed argument", () => {
    expect(
      hits([
        "console.log.call(reveal(p.k))",
        "console.log.bind(reveal(p.k))",
        "console.log.apply(reveal(p.k), [])",
        "console.log.apply(console, [], reveal(p.k))",
        "hash.call(null, reveal(p.k))",
        "Reflect.apply(hash, null, [reveal(p.k)])",
        "Reflect.apply(console.log, reveal(p.k), [])",
        "console.log.call(console, hash(reveal(p.k)))",
        "console.log.toString(reveal(p.k))",
      ]),
    ).toEqual([]);
  });
});

describe("E1112 a destructured name read at a member", () => {
  it("ends at length and size of a destructured name, and carries its other members", () => {
    expect(hits(["const { a } = { a: reveal(p.k) }", "console.log(a.length)", "console.log(a.size)"])).toEqual([]);
    expect(hits(["const { a: { b } } = { a: { b: reveal(p.k) } }", "console.log(b.length)"])).toEqual([]);
    expect(hits(["let a", "({ a } = { a: reveal(p.k) })", "console.log(a.length)"])).toEqual([]);
    expect(
      hits([
        "const { a } = { a: reveal(p.k), b: 1 }",
        "console.log(a)",
        "console.log(a.trim())",
        "console.log(a.x)",
        "console.log(a['length'])",
      ]),
    ).toEqual(["6 console.log", "7 console.log", "8 console.log"]);
  });

  it("keeps a callback's parameter and a field of this as ends", () => {
    expect(hits(["[reveal(p.k)].forEach((x) => console.log(x))"])).toEqual([]);
    expect(hits(["this.x = reveal(p.k)", "console.log(this.x)"])).toEqual([]);
  });
});

type Wrap = (e: string, n: number, pre: string[]) => string;
const NEW: Wrap[] = [
  (e, n, pre) => {
    pre.push(`let d${n}`, `[d${n}] = [${e}]`);
    return `d${n}`;
  },
  (e, n, pre) => {
    pre.push(`let o${n}`, `({ o${n} } = { o${n}: ${e} })`);
    return `o${n}`;
  },
  (e, n, pre) => {
    pre.push(`const q${n} = []`, `q${n}.splice(0, 0, ${e})`);
    return `q${n}`;
  },
  (e, n, pre) => {
    pre.push(`const f${n} = [0]`, `f${n}.fill(${e})`);
    return `f${n}`;
  },
  (e) => `Array(1).fill(${e})`,
  (e) => `new Map([['k', ${e}]])`,
  (e) => `new Set([${e}])`,
  (e) => `Object.fromEntries([['k', ${e}]])`,
  (e) => `Array.of(${e})`,
  (e) => `new Map().set('k', ${e})`,
  (e, n, pre) => {
    pre.push(`const { g${n} } = { g${n}: ${e} }`);
    return `g${n}`;
  },
];
const SINKS: ((e: string) => string)[] = [
  (e) => `console.log(${e})`,
  (e) => `console.log.call(console, ${e})`,
  (e) => `console.log.apply(console, [${e}])`,
  (e) => `Reflect.apply(console.log, console, [${e}])`,
];

describe("E1112 property over the new forms", () => {
  it("reports one finding through 1 to 4 new carriers into any sink form, and none from a hash", () => {
    const link = fc.nat({ max: NEW.length - 1 });
    fc.assert(
      fc.property(
        fc.array(link, { minLength: 1, maxLength: 4 }),
        fc.nat({ max: SINKS.length - 1 }),
        fc.boolean(),
        (links, s, hashed) => {
          const pre: string[] = [];
          let e = hashed ? "hash(reveal(p.k))" : "reveal(p.k)";
          links.forEach((l, n) => {
            const w = NEW[l];
            if (w !== undefined) e = w(e, n, pre);
          });
          const sink = SINKS[s];
          if (sink === undefined) return;
          expect(hits([...pre, sink(e)])).toHaveLength(hashed ? 0 : 1);
          expect(hits([...pre, sink(`(${e}).size`)])).toHaveLength(0);
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});
