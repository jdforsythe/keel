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
/** Each finding of `body` as `line sink`; the first body line is line 4 under `HEAD`. */
const hits = (body: string[], head = HEAD): string[] =>
  out(file(body.map((l) => `  ${l}`).join("\n"), head)).map(
    (l) => `${l.split(":")[0]} ${l.split(" ")[5]?.slice(0, -1)}`,
  );

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
      "  snapshot(reveal(p.k))",
    ].join("\n");
    expect(out(file(body, `${HEAD}import { snapshot } from '@keel/store'\n`))).toEqual([]);
  });

  it("ends the flow at a comparison, a test operator, a call off the conversion list, and a parameter", () => {
    const body = [
      "  const ok = reveal(p.k) === h",
      "  const n = !reveal(p.k)",
      "  const ty = typeof reveal(p.k)",
      "  const b = digest(reveal(p.k))",
      "  tx(t, { ok, n, ty, b })",
      "  const g = (v) => console.log(v)",
    ].join("\n");
    expect(out(file(body))).toEqual([]);
  });

  it("follows each value a local is given, destructuring, a closure, and assignment in an expression", () => {
    expect(out(file("  let v = 1\n  v = reveal(p.k)\n  tx(t, { v })"))).toHaveLength(1);
    expect(out(file("  const { a, b } = { a: reveal(p.k), b: 1 }\n  console.log(a)"))).toHaveLength(1);
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
    expect(out(file("  console.log(reveal(p.k))", "import { reveal } from './schema.ts'\n"))).toEqual([]);
  });

  it("points at k.reveal", () => {
    const ds = check([file("  console.log(reveal(p.k))")], { types: false }).diagnostics;
    expect(ds.filter((d) => d.code === "E1112").map((d) => d.see)).toEqual(["k.reveal"]);
  });
});

describe("E1112 sinks", () => {
  it("reports process.stdout.write, process.stderr.write and Promise.reject, and no other member of them", () => {
    const body = [
      "process.stdout.write(reveal(p.k))",
      "process.stderr.write('a', reveal(p.k))",
      "Promise.reject(reveal(p.k))",
      "process.stdout.end(reveal(p.k))",
      "process.stdin.write(reveal(p.k))",
      "Promise.resolve(reveal(p.k))",
      "ctx.process.stdout.write(reveal(p.k))",
    ];
    expect(hits(body)).toEqual(["4 process.stdout.write", "5 process.stderr.write", "6 Promise.reject"]);
  });

  it("reports each node:fs write imported by name, under its imported name, from each of the four module names", () => {
    const head = [
      "import { reveal } from '@keel/schema'",
      "import { writeFile, writeFileSync as wfs } from 'node:fs'",
      "import { appendFile, appendFileSync } from 'fs'",
      "import { write } from 'node:fs/promises'",
      "import { writeSync, readFile, writeFiles, overwrite } from 'fs/promises'",
      "import { writeFile as other } from './fs'",
      "import { appendFile as far } from 'node:fs/promises/x'",
      "",
    ].join("\n");
    const body = [
      "writeFile('f', reveal(p.k))",
      "wfs('f', reveal(p.k))",
      "appendFile('f', reveal(p.k))",
      "appendFileSync('f', reveal(p.k))",
      "write(1, reveal(p.k))",
      "writeSync(1, reveal(p.k))",
      "readFile(reveal(p.k))",
      "writeFiles('f', reveal(p.k))",
      "overwrite('f', reveal(p.k))",
      "other('f', reveal(p.k))",
      "far('f', reveal(p.k))",
      "const g = (writeFile) => writeFile('f', reveal(p.k))",
    ];
    expect(hits(body, head)).toEqual([
      "9 writeFile",
      "10 writeFileSync",
      "11 appendFile",
      "12 appendFileSync",
      "13 write",
      "14 writeSync",
    ]);
  });

  it("reports a node:fs write as a member of a default or namespace import, of its promises, and of a promises import", () => {
    const head = [
      "import { reveal } from '@keel/schema'",
      "import fs from 'node:fs'",
      "import * as fsp from 'fs/promises'",
      "import { promises, constants, default as dfs } from 'node:fs'",
      "import path from 'node:path'",
      "",
    ].join("\n");
    const body = [
      "fs.writeFileSync('f', reveal(p.k))",
      "fsp.appendFile('f', reveal(p.k))",
      "fs.promises.writeFile('f', reveal(p.k))",
      "promises.write(1, reveal(p.k))",
      "dfs.writeSync(1, reveal(p.k))",
      "fs.readFileSync(reveal(p.k))",
      "fs.constants.writeFile('f', reveal(p.k))",
      "constants.writeFile('f', reveal(p.k))",
      "path.writeFile('f', reveal(p.k))",
      "ctx.fs.writeFile('f', reveal(p.k))",
      "fs['writeFileSync']('f', reveal(p.k))",
      "const g = (fs) => fs.writeFileSync('f', reveal(p.k))",
    ];
    expect(hits(body, head)).toEqual([
      "7 writeFileSync",
      "8 appendFile",
      "9 writeFile",
      "10 write",
      "11 writeSync",
      "17 writeFileSync",
    ]);
  });

  it("reports the value thrown at the value, and a thrown Error once, at the constructor's argument", () => {
    const body = [
      "if (p.a) throw reveal(p.k)",
      "if (p.b) throw { t: reveal(p.k) }",
      "if (p.c) throw new Error(reveal(p.k))",
      "if (p.d) throw digest(reveal(p.k))",
      "throw p.k",
    ];
    expect(hits(body)).toEqual(["4 throw", "5 throw", "6 Error"]);
    expect(out(file("  throw reveal(p.k)"))).toEqual([
      "4:9 a revealed value reaches throw; store a value derived from it",
    ]);
  });

  it("names a sink under a local name and under .bind(), through each value the name is given", () => {
    const body = [
      "const log = console.log.bind(console)",
      "log(reveal(p.k))",
      "const w = process.stderr.write.bind(process.stderr)",
      "w(reveal(p.k))",
      "const send = tx",
      "send(t, { v: reveal(p.k) })",
      "let warn",
      "warn = console.warn",
      "warn(reveal(p.k))",
      "const again = log",
      "again(reveal(p.k))",
      "const twice = log.bind(null)",
      "twice(reveal(p.k))",
      "const called = console.log.call(console)",
      "called(reveal(p.k))",
      "const made = make.bind(console.log)",
      "made(reveal(p.k))",
      "const [first] = [console.log]",
      "first(reveal(p.k))",
      "let quiet = console.log",
      "quiet = send2",
      "quiet(reveal(p.k))",
      "const { x } = console.log",
      "x(reveal(p.k))",
      "const list = []",
      "list.push(console.log)",
      "list(reveal(p.k))",
    ];
    expect(hits(body)).toEqual([
      "5 console.log",
      "7 process.stderr.write",
      "9 tx",
      "12 console.warn",
      "14 console.log",
      "16 console.log",
    ]);
  });

  it("takes ctx.storage by where it came from: a .storage member, a local from one, a storage key or parameter", () => {
    const body = [
      "const st = ctx.storage",
      "st.set('k', reveal(p.k))",
      "const { storage: s } = ctx",
      "s.commit(reveal(p.k))",
      "const save = ({ storage: mine = S }) => mine.set('k', reveal(p.k))",
      "const keep = (storage) => storage.set('k', reveal(p.k))",
      "const st2 = st",
      "st2.set('k', reveal(p.k))",
      "req.ctx.storage.commit(reveal(p.k))",
      "const deep = ({ ctx: { storage: inner } }) => inner.set('k', reveal(p.k))",
    ];
    expect(hits(body)).toEqual([
      "5 storage.set",
      "7 storage.commit",
      "8 storage.set",
      "9 storage.set",
      "11 storage.set",
      "12 storage.commit",
      "13 storage.set",
    ]);
  });

  it("does not take an app object for ctx.storage: a storage given another value, another key, another method", () => {
    const body = [
      "const a = () => { const storage = new Map(); storage.set('k', reveal(p.k)) }",
      "const b = () => { const { cache: storage } = ctx; storage.set('k', reveal(p.k)) }",
      "const c = (cache) => cache.set('k', reveal(p.k))",
      "const d = () => { let st = ctx.storage; st = new Map(); st.set('k', reveal(p.k)) }",
      "const e = () => { const [st] = ctx.storage; st.set('k', reveal(p.k)) }",
      "const f = ({ [storage]: st }) => st.set('k', reveal(p.k))",
      "const g = ({ storage: { st } }) => st.set('k', reveal(p.k))",
      "const h = ({ ...storage }) => storage.get('k', reveal(p.k))",
      "ctx[storage].set('k', reveal(p.k))",
      "ctx.storage.get(reveal(p.k))",
      "ctx.storage.x.set('k', reveal(p.k))",
    ];
    expect(hits(body)).toEqual([]);
  });
});

describe("E1112 flow", () => {
  it("follows a local bound to reveal or to <namespace>.reveal, and not one bound to another function", () => {
    const head =
      "import { reveal } from '@keel/schema'\nimport * as sc from '@keel/schema'\nimport all from '@keel/schema'\n";
    const body = [
      "const open = reveal",
      "console.log(open(p.k))",
      "const again = open",
      "console.log(again(p.k))",
      "const ns = sc.reveal",
      "console.log(ns(p.k))",
      "const fake = digest",
      "console.log(fake(p.k))",
      "let was = reveal",
      "was = digest",
      "console.log(was(p.k))",
      "const [part] = [reveal]",
      "console.log(part(p.k))",
      "const { ...rest } = reveal",
      "console.log(rest(p.k))",
      "for (const each of reveal) console.log(each(p.k))",
      "console.log(new reveal(p.k))",
      "const shadow = (sc) => console.log(sc.reveal(p.k))",
      "console.log(sc.secret(p.k), sc[reveal](p.k), ctx.sc.reveal(p.k), all.reveal(p.k))",
    ];
    expect(hits(body, head)).toEqual(["6 console.log", "8 console.log", "10 console.log"]);
  });

  it("follows a for...of head, each name its pattern binds, and not a for...in head", () => {
    const body = [
      "for (const v of [reveal(p.k)]) console.log(v)",
      "for (const [k, w] of Object.entries({ a: reveal(p.k) })) console.log(w)",
      "for (const v of [digest(reveal(p.k))]) console.log(v)",
      "for (const v in [reveal(p.k)]) console.log(v)",
    ];
    expect(hits(body)).toEqual(["4 console.log", "5 console.log"]);
  });

  it("follows a member write into the field it names: the first key of the chain, any field for a computed key", () => {
    const body = [
      "const o = {}",
      "o.k = reveal(p.k)",
      "console.log(o)",
      "console.log(o.k)",
      "console.log(o.name)",
      "const q = {}",
      "q.a.b = reveal(p.k)",
      "console.log(q.a)",
      "console.log(q.b)",
      "const c = {}",
      "c[p.x] = reveal(p.k)",
      "console.log(c.any)",
      "const s = {}",
      "s['na' + 'me'] = reveal(p.k)",
      "console.log(s.name)",
      "console.log(s.other)",
    ];
    expect(hits(body)).toEqual([
      "6 console.log",
      "7 console.log",
      "11 console.log",
      "15 console.log",
      "18 console.log",
    ]);
  });

  it("follows each argument of push, unshift, set, add and append on a local, and no other method's", () => {
    const body = [
      "const a = []",
      "a.push(1, reveal(p.k))",
      "console.log(a)",
      "const b = []",
      "b.unshift(reveal(p.k))",
      "console.log(b)",
      "const m = new Map()",
      "m.set('k', reveal(p.k))",
      "console.log(m.get('k'))",
      "const s = new Set()",
      "s.add(reveal(p.k))",
      "console.log([...s])",
      "const f = new FormData()",
      "f.append('k', reveal(p.k))",
      "console.log(f)",
      "const y = []",
      "y.push(...[reveal(p.k)])",
      "console.log(y)",
      "const w = { list: [] }",
      "w.list.push(reveal(p.k))",
      "console.log(w.list)",
      "console.log(w.other)",
      "const z = []",
      "z.pop(reveal(p.k))",
      "z['push'](reveal(p.k))",
      "console.log(z)",
      "console.log(a.length, m.size)",
    ];
    expect(hits(body)).toEqual([
      "6 console.log",
      "9 console.log",
      "12 console.log",
      "15 console.log",
      "18 console.log",
      "21 console.log",
      "24 console.log",
    ]);
  });

  it("follows each source of Object.assign into its target, field by field", () => {
    const body = [
      "const o = {}",
      "Object.assign(o, { n: 1 }, { k: reveal(p.k) })",
      "console.log(o)",
      "console.log(o.k)",
      "console.log(o.n)",
      "const u = {}",
      "Object.keys(u, { k: reveal(p.k) })",
      "console.log(u)",
      "const first = { k: reveal(p.k) }",
      "const into = {}",
      "Object.assign(first, into)",
      "console.log(into)",
    ];
    expect(hits(body)).toEqual(["6 console.log", "7 console.log"]);
  });

  it("carries an argument of concat, replace, replaceAll, padStart and padEnd, and of no other method", () => {
    const body = [
      "console.log('x'.concat('y', reveal(p.k)))",
      "console.log('x'.replace('x', reveal(p.k)))",
      "console.log('x'.replaceAll('x', reveal(p.k)))",
      "console.log('x'.padStart(9, reveal(p.k)))",
      "console.log('x'.padEnd(9, reveal(p.k)))",
      "console.log('x'['concat'](reveal(p.k)))",
      "console.log('x'.split(reveal(p.k)))",
      "console.log(enc.encode(reveal(p.k)))",
      "console.log(new 'x'.concat(reveal(p.k)))",
    ];
    expect(hits(body)).toEqual([4, 5, 6, 7, 8, 9].map((n) => `${n} console.log`));
  });

  it("carries any argument of each standard conversion and encoding, new String, and the String.raw tag", () => {
    const body = [
      "console.log(String(reveal(p.k)))",
      "console.log(new String(reveal(p.k)))",
      "console.log(String.raw`a${reveal(p.k)}`)",
      "console.log(String.raw({ raw: [] }, reveal(p.k)))",
      "console.log(JSON.stringify(1, null, reveal(p.k)))",
      "console.log(structuredClone(reveal(p.k)))",
      "console.log(Array.from(reveal(p.k)))",
      "console.log(Object.assign({}, reveal(p.k)))",
      "console.log(Object.values(reveal(p.k)))",
      "console.log(Object.entries(reveal(p.k)))",
      "console.log(btoa(reveal(p.k)))",
      "console.log(encodeURI(reveal(p.k)))",
      "console.log(encodeURIComponent(reveal(p.k)))",
      "console.log(Buffer.from(reveal(p.k)).toString('base64'))",
      "console.log(new Array(reveal(p.k)))",
      "console.log(new structuredClone(reveal(p.k)))",
      "console.log(tag`a${reveal(p.k)}`)",
      "console.log(Object.keys(reveal(p.k)))",
      "console.log(Buffer.byteLength(reveal(p.k)))",
      "console.log(atob(reveal(p.k)))",
    ];
    expect(hits(body)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((n) => `${n} console.log`));
  });

  it("follows a compound assignment to a name", () => {
    expect(hits(["let s = 'a'", "s += reveal(p.k)", "console.log(s)"])).toEqual(["6 console.log"]);
  });
});

describe("E1112 ends", () => {
  it("ends at length and size, read by name or by a constant key, and at no other member", () => {
    const body = [
      "console.log(reveal(p.k).length)",
      "console.log(reveal(p.k).size)",
      "console.log(reveal(p.k)['length'])",
      "console.log([reveal(p.k)].length)",
      "console.log(reveal(p.k).lengths)",
      "console.log(reveal(p.k)[p.i])",
      "console.log(reveal(p.k).length.x)",
    ];
    expect(hits(body)).toEqual(["8 console.log", "9 console.log"]);
  });

  it("ends at includes, startsWith, endsWith, indexOf and has, and at no other method", () => {
    const body = [
      "console.log(reveal(p.k).includes('a'))",
      "console.log(reveal(p.k).startsWith('a'))",
      "console.log(reveal(p.k).endsWith('a'))",
      "console.log(reveal(p.k).indexOf('a'))",
      "console.log(reveal(p.k).has('a'))",
      "console.log(reveal(p.k)['includes']('a'))",
      "console.log('x'.concat(reveal(p.k)).includes('a'))",
      "console.log(reveal(p.k).lastIndexOf('a'))",
      "console.log(reveal(p.k).at(0))",
      "console.log(reveal(p.k).includes)",
      "console.log(reveal(p.k)[p.m]('a'))",
    ];
    expect(hits(body)).toEqual(["11 console.log", "12 console.log", "13 console.log", "14 console.log"]);
  });

  it("ends at the left side of &&, and carries its right side and both sides of || and ??", () => {
    const body = [
      "console.log(reveal(p.k) && p.on)",
      "console.log(p.on && reveal(p.k))",
      "console.log(reveal(p.k) || p.on)",
      "console.log(reveal(p.k) ?? p.on)",
      "console.log(p.on || reveal(p.k))",
    ];
    expect(hits(body)).toEqual(["5 console.log", "6 console.log", "7 console.log", "8 console.log"]);
  });

  it("reads only the named field of an object literal; a spread, a computed or a numeric key is every field", () => {
    const body = [
      "console.log({ token: reveal(p.k), name: 'n' }.token)",
      "console.log({ token: reveal(p.k), name: 'n' }.name)",
      "console.log({ token: reveal(p.k), name: 'n' }['token'])",
      "console.log({ token: reveal(p.k), name: 'n' }[p.x])",
      "console.log({ ...{ token: reveal(p.k) }, name: 'n' }.name)",
      "console.log({ [p.x]: reveal(p.k), name: 'n' }.name)",
      "console.log({ 0: reveal(p.k), name: 'n' }.other)",
      "console.log({ 'token': reveal(p.k), name: 'n' }.token)",
      "console.log({ token: reveal(p.k), length: 1 }.length)",
      "console.log({ length: reveal(p.k) }.length)",
      "console.log(({ token: reveal(p.k), name: 'n' } as T)!.name)",
    ];
    expect(hits(body)).toEqual([4, 6, 7, 8, 9, 10, 11, 13].map((n) => `${n} console.log`));
  });

  it("reads only the named field of a local, through each value and member write the local is given", () => {
    const body = [
      "const o = { token: reveal(p.k), name: 'n' }",
      "console.log(o.token)",
      "console.log(o.name)",
      "console.log(o[p.x])",
      "const same = o",
      "console.log(same.name)",
      "console.log(same.token)",
      "const v = reveal(p.k)",
      "console.log(v.length)",
      "console.log(v.name)",
    ];
    expect(hits(body)).toEqual(["5 console.log", "7 console.log", "10 console.log", "13 console.log"]);
  });

  it("reads a destructured name at its first key; an array pattern or a rest reads the whole value", () => {
    const body = [
      "const { name, token } = { token: reveal(p.k), name: 'n' }",
      "console.log(name)",
      "console.log(token)",
      "const { a: { b } } = { a: { b: reveal(p.k) }, c: 1 }",
      "console.log(b)",
      "const { c: { d } } = { a: reveal(p.k), c: { d: 1 } }",
      "console.log(d)",
      "const [x] = [reveal(p.k)]",
      "console.log(x)",
      "const { n, ...rest } = { m: reveal(p.k), n: 1 }",
      "console.log(rest)",
      "console.log(n)",
      "const { [key]: y } = { m: reveal(p.k), key: 1 }",
      "console.log(y)",
      "const [{ z }] = [{ m: reveal(p.k), z: 1 }]",
      "console.log(z)",
      "const { m: [e] } = { m: 1, e: reveal(p.k) }",
      "console.log(e)",
      "const { f = 1 } = { g: reveal(p.k) }",
      "console.log(f)",
      "const { t: named } = { token: reveal(p.k), t: 1 }",
      "console.log(named.token)",
      "const [...every] = [reveal(p.k)]",
      "console.log(every)",
    ];
    expect(hits(body)).toEqual([
      "6 console.log",
      "8 console.log",
      "12 console.log",
      "14 console.log",
      "17 console.log",
      "19 console.log",
      "27 console.log",
    ]);
  });

  it("hides earlier values after a `name = value` statement of an enclosing block, and keeps later ones", () => {
    const body = [
      "let d = reveal(p.k)",
      "d = digest(d)",
      "console.log(d)",
      "let e = reveal(p.k)",
      "if (p.on) e = digest(e)",
      "console.log(e)",
      "let f = reveal(p.k)",
      "if (p.on) { f = digest(f) }",
      "console.log(f)",
      "let g = reveal(p.k)",
      "{ g = 1; console.log(g) }",
      "console.log(g)",
      "let i = reveal(p.k)",
      "i = 1",
      "const later = () => { console.log(i) }",
      "i = reveal(p.k)",
      "let j = reveal(p.k)",
      "const early = () => console.log(j)",
      "j = 1",
      "let k = reveal(p.k)",
      "k += 'x'",
      "console.log(k)",
      "let l = reveal(p.k)",
      "console.log((l = 1), l)",
      "let m = reveal(p.k)",
      "m = 1; console.log(m)",
    ];
    expect(hits(body)).toEqual([
      "9 console.log",
      "12 console.log",
      "15 console.log",
      "18 console.log",
      "21 console.log",
      "25 console.log",
      "27 console.log",
    ]);
  });

  it("never hides a member write or a mutation behind an assignment to the name", () => {
    const body = [
      "let o = {}",
      "o.k = reveal(p.k)",
      "o = {}",
      "console.log(o)",
      "let a = []",
      "a.push(reveal(p.k))",
      "a = []",
      "console.log(a)",
    ];
    expect(hits(body)).toEqual(["7 console.log", "11 console.log"]);
  });

  it("ends names bound to each other, and a field given itself, without looping", () => {
    const body = [
      "let a = b",
      "let b = a",
      "a(reveal(p.k))",
      "a.set('k', reveal(p.k))",
      "console.log(a(p.k))",
      "let o = {}",
      "o = { f: o.f }",
      "console.log(o.f)",
      "console.log(reveal(p.k))",
    ];
    expect(hits(body)).toEqual(["12 console.log"]);
  });

  it("keeps a local's values to its own binding", () => {
    const body = [
      "const v = reveal(p.k)",
      "const f = (v) => console.log(v)",
      "const g = () => { const v = 1; console.log(v) }",
      "const o = {}",
      "const h = (o) => { o.k = reveal(p.k) }",
      "console.log(o)",
      "const st = new Map()",
      "const i = ({ storage: st }) => 1",
      "st.set('k', v)",
    ];
    expect(hits(body)).toEqual([]);
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
  (e) => `encodeURIComponent(${e})`,
  (e) => `'x'.concat(${e})`,
  (e) => `(h && ${e})`,
  (e, n, pre) => {
    pre.push(`const q${n} = []`, `q${n}.push(${e})`);
    return `q${n}`;
  },
];
const END: Wrap[] = [
  (e) => `hash(${e})`,
  (e) => `(${e} !== h)`,
  (e) => `(${e}).length`,
  (e) => `(${e}).includes('a')`,
  (e) => `(${e} && h)`,
];

describe("E1112 sinks read through a namespace or a string key", () => {
  it("reports tx and store as members of a namespace import of @keel/store", () => {
    const head = "import { reveal } from '@keel/schema'\nimport * as ks from '@keel/store'\n";
    expect(hits(["ks.tx(t, { v: reveal(p.k) })", "ks.store(S, { v: reveal(p.k) })"], head)).toEqual([
      "4 tx",
      "5 store",
    ]);
    expect(hits(["ks.transaction(t, { v: reveal(p.k) })"], head)).toEqual([]);
  });

  it("reports no member named tx of a local that is not that import", () => {
    expect(hits(["const ks = { tx: (a, b) => b }", "ks.tx(t, { v: reveal(p.k) })"])).toEqual([]);
    const shadowed = "import { reveal } from '@keel/schema'\nimport * as ks from '@keel/store'\n";
    expect(hits(["const run = (ks) => ks.tx(t, { v: reveal(p.k) })"], shadowed)).toEqual([]);
  });

  it("reads a string key as the member it names", () => {
    expect(
      hits([
        "ctx.storage['set']('a', reveal(p.k))",
        "ctx['storage'].commit(reveal(p.k))",
        "ctx.storage[m]('a', reveal(p.k))",
      ]),
    ).toEqual(["4 storage.set", "5 storage.commit"]);
    const head = "import { reveal } from '@keel/schema'\nimport fs from 'node:fs'\n";
    expect(hits(["fs['promises'].writeFile('f', reveal(p.k))", "fs['writeFileSync']('f', reveal(p.k))"], head)).toEqual(
      ["4 writeFile", "5 writeFileSync"],
    );
  });
});

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
