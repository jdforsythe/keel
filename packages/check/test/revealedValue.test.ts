// E1112 examples pinned by location and message, and a property over carrier chains.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";

const HEAD = "import { reveal } from '@keel/schema'\nimport { tx, store } from '@keel/store'\n";
const file = (body: string, head = HEAD, path = "modules/app/run.server.ts"): SourceFile => ({
  path,
  source: `${head}export async function action(ctx, p) {\n${body}\n}\n`,
});
const out = (f: SourceFile): string[] =>
  check([f], { types: false })
    .diagnostics.filter((d) => d.code === "E1112")
    .map((d) => `${d.line}:${d.col} ${d.message}${d.fix === undefined ? "" : " +fix"}`);

describe("E1112 a revealed value reaching a sink", () => {
  it("reports at the first carrying argument, naming the sink, with no fix", () => {
    expect(out(file("  tx(t, 1, { v: reveal(p.k) })"))).toEqual([
      "4:12 a revealed value reaches tx; store a value derived from it",
    ]);
    expect(out(file("  console.warn('a', reveal(p.k))"))).toEqual([
      "4:21 a revealed value reaches console.warn; store a value derived from it",
    ]);
  });

  it("names each sink: an aliased tx, store, storage set and commit, Error globals called or constructed", () => {
    const head = "import { reveal as rv } from '@keel/schema'\nimport { tx as t2, store } from '@keel/store'\n";
    const body = [
      "  t2(t, { v: rv(p.k) })",
      "  store(S, { v: rv(p.k) })",
      "  ctx.storage.set('k', rv(p.k))",
      "  const { storage } = ctx",
      "  storage.commit(rv(p.k))",
      "  Error(rv(p.k))",
      "  new TypeError(`${rv(p.k)}`)",
    ].join("\n");
    expect(out(file(body, head)).map((l) => l.split(" ")[5])).toEqual([
      "tx;",
      "store;",
      "storage.set;",
      "storage.commit;",
      "Error;",
      "TypeError;",
    ]);
  });

  it("does not report a shadowed reveal, a local Error, an other receiver, or a call that is not a sink", () => {
    const body = [
      "  const f = (reveal) => tx(t, { v: reveal(p.k) })",
      "  const Error = (x) => x",
      "  Error(reveal(p.k))",
      "  ctx.cache.set('k', reveal(p.k))",
      "  send(reveal(p.k))",
    ].join("\n");
    expect(out(file(body))).toEqual([]);
  });

  it("ends the flow at a comparison, a test operator, an encoding call, and a parameter", () => {
    const body = [
      "  const ok = reveal(p.k) === h",
      "  const n = !reveal(p.k)",
      "  const ty = typeof reveal(p.k)",
      "  const b = btoa(reveal(p.k))",
      "  tx(t, { ok, n, ty, b })",
      "  const g = (v) => console.log(v)",
    ].join("\n");
    expect(out(file(body))).toEqual([]);
  });

  it("follows each value a local is given, destructuring, a closure, and assignment in an expression", () => {
    expect(out(file("  let v = 1\n  v = reveal(p.k)\n  tx(t, { v })"))).toHaveLength(1);
    expect(out(file("  const { a, b } = { a: reveal(p.k), b: 1 }\n  console.log(b)"))).toHaveLength(1);
    expect(out(file("  const a = reveal(p.k)\n  return () => console.log(a)"))).toHaveLength(1);
    expect(out(file("  let x\n  console.log((x = reveal(p.k)))"))).toHaveLength(1);
    expect(out(file("  const n = -reveal(p.k)\n  console.log(n)"))).toHaveLength(1);
  });

  it("ends a self-referencing local without looping", () => {
    expect(out(file("  let a = 1\n  a = a + a\n  a = a + reveal(p.k)\n  console.log(a)"))).toHaveLength(1);
    expect(out(file("  let a = 1\n  a = a + a\n  console.log(a)"))).toEqual([]);
  });

  it("checks app code only, and needs the @keel/schema import", () => {
    expect(out(file("  console.log(reveal(p.k))", HEAD, "modules/app/run.server.test.ts"))).toEqual([]);
    expect(out(file("  console.log(reveal(p.k))", "const reveal = (x) => x\n"))).toEqual([]);
  });
});

type Wrap = (e: string, n: number, pre: string[]) => string;
const KEEP: Wrap[] = [
  (e, n, pre) => {
    pre.push(`const a${n} = ${e}`);
    return `a${n}`;
  },
  (e) => `({ m: ${e} }).m`,
  (e) => `\`x\${${e}}\``,
  (e) => `[...[${e}]]`,
  (e) => `(p.on ? 'z' : ${e})`,
  (e) => `(p.x ?? ${e})`,
  (e) => `(await ${e})`,
  (e) => `JSON.stringify(${e})`,
  (e) => `${e}.slice(1)`,
];
const END: Wrap[] = [(e) => `hash(${e})`, (e) => `(${e} !== h)`, (e) => `encodeURIComponent(${e})`];

describe("E1112 property", () => {
  it("reports one finding exactly when no ending link sits on the path from reveal to the sink", () => {
    const link = fc.record({ end: fc.boolean(), i: fc.nat() });
    fc.assert(
      fc.property(fc.array(link, { minLength: 1, maxLength: 5 }), (links) => {
        const pre: string[] = [];
        let e = "reveal(p.k)";
        links.forEach((l, n) => {
          const set = l.end ? END : KEEP;
          const w = set[l.i % set.length];
          if (w !== undefined) e = w(e, n, pre);
        });
        const body = [...pre, `console.error(${e})`].map((s) => `  ${s}`).join("\n");
        expect(out(file(body))).toHaveLength(links.some((l) => l.end) ? 0 : 1);
      }),
      { seed: 1337, numRuns: 200 },
    );
  });
});
