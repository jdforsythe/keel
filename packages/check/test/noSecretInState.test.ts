// E1303 examples pinned by location and message: schema resolution (a) and `reveal` in a reducer (b).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });
const S = "import { s } from '@keel/schema'\n";
const STORE = "import { store } from '@keel/store'\n";
const TX = "import { transaction } from '@keel/store'\n";
const out = (files: SourceFile[]): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === "E1303")
    .map((d) => `${d.path} ${d.line}:${d.col} ${d.message}${d.fix === undefined ? "" : " +fix"}`);
const cart = (arg: string, head = ""): SourceFile =>
  f("modules/app/cart.ts", `${STORE}${head}export const cart = store(${arg}, {})\n`);
const schema = (name: string, body: string, head = ""): SourceFile =>
  f(`modules/app/${name}.schema.ts`, `${S}${head}export const ${name} = ${body}\n`);

describe("E1303 (a) a secret in a store state schema", () => {
  it("reports at the first argument with the field path, no fix", () => {
    expect(out([cart("s.object({ a: s.object({ b: s.secret(s.string()) }) })", S)])).toEqual([
      "modules/app/cart.ts 3:27 store state schema holds s.secret at a.b; state never holds a secret",
    ]);
  });

  it("follows consts, relative imports with and without an extension, and imports of imports", () => {
    const local = `${S}const Inner = s.object({ pin: s.secret(s.int()) })\nconst State = s.object({ x: Inner })\n`;
    expect(out([cart("State", local)])).toEqual([`modules/app/cart.ts 5:27 ${msg("x.pin")}`]);
    const ext = [schema("State", "s.object({ t: s.secret(s.string()) })"), cart("State", imp("./State.schema.ts"))];
    expect(out(ext)).toEqual([`modules/app/cart.ts 3:27 ${msg("t")}`]);
    const bare = [schema("State", "s.object({ t: s.secret(s.string()) })"), cart("State", imp("./State.schema"))];
    expect(out(bare)).toHaveLength(1);
    const deep = [
      schema("Creds", "s.object({ token: s.secret(s.string()) })"),
      schema("User", "s.object({ creds: Creds })", "import { Creds } from './Creds.schema.ts'\n"),
      f(
        "modules/app/types/State.schema.ts",
        `${S}import { User } from '../User.schema.ts'\nexport const State = s.object({ user: User })\n`,
      ),
      cart("State", imp("./types/State.schema.ts")),
    ];
    expect(out(deep)).toEqual([`modules/app/cart.ts 3:27 ${msg("user.creds.token")}`]);
  });

  it("reads arrays, records, unions, modifiers, parentheses and `as`", () => {
    const cases = [
      "s.object({ l: s.array(s.secret(s.string())) })",
      "s.object({ r: s.record(s.secret(s.string())) })",
      "s.object({ u: s.union([s.string(), s.secret(s.string())]) })",
      "s.object({ o: s.secret(s.string()).optional() })",
      "s.object({ o: s.object({ k: s.secret(s.string()) }).nullable() })",
      "(s.object({ p: s.secret(s.string()) }) as never)",
      "s.object({ 'q': s.secret(s.string()) })",
    ];
    for (const c of cases) expect(out([cart(c, S)]), c).toHaveLength(1);
  });

  it("walks a method's receiver and its arguments", () => {
    const base = `${S}const Base = s.object({ id: s.string() })\n`;
    expect(out([cart("Base.extend({ token: s.secret(s.string()) })", base)])).toEqual([
      `modules/app/cart.ts 4:27 ${msg("token")}`,
    ]);
    expect(out([cart("Unknown.merge(s.object({ k: s.secret(s.string()) }))", S)])).toEqual([
      `modules/app/cart.ts 3:27 ${msg("k")}`,
    ]);
    expect(out([cart("Base.extend({ token: s.string() })", base)])).toEqual([]);
  });

  it("names the root, and an aliased `s` and `store`", () => {
    expect(out([cart("s.secret(s.string())", S)])).toEqual([`modules/app/cart.ts 3:27 ${msg("(root)")}`]);
    const aliased = f(
      "modules/app/cart.ts",
      "import { s as z } from '@keel/schema'\nimport { store as mk } from '@keel/store'\nexport const cart = mk(z.object({ k: z.secret(z.string()) }), {})\n",
    );
    expect(out([aliased])).toEqual([`modules/app/cart.ts 3:24 ${msg("k")}`]);
  });

  it("clips a long path to one line under 90 chars", () => {
    const long = "a".repeat(80);
    const [line = ""] = out([cart(`s.object({ ${long}: s.secret(s.string()) })`, S)]);
    const message = line.slice(line.indexOf(" ", line.indexOf(" ") + 1) + 1);
    expect(message.length).toBeLessThanOrEqual(89);
    expect(message.endsWith("...")).toBe(true);
  });

  it("reports nothing it cannot resolve or that holds no secret", () => {
    const quiet = [
      cart("s.object({ a: s.string(), b: s.array(s.int()) })", S),
      cart("State", "import { State } from '@keel/std-x'\n"),
      cart("State", imp("./Missing.schema.ts")),
      cart("make(s.secret(s.string()))", S),
      cart("s.object({ [k]: s.secret(s.string()) })", S),
      cart("s.object({ ...Base })", S),
      cart("s.object({ a: s.secret(s.string()) })", "import { s } from 'not-keel'\n"),
      f(
        "modules/app/cart.ts",
        `${S}import { store } from 'elsewhere'\nexport const cart = store(s.secret(s.string()), {})\n`,
      ),
      f("modules/app/cart.test.ts", `${S}${STORE}export const cart = store(s.secret(s.string()), {})\n`),
      f("modules/app/cart.ts", `${S}${STORE}export const cart = store(...args)\n`),
      f("modules/app/cart.ts", `${S}${STORE}export const cart = store()\n`),
      f("modules/app/cart.ts", `${S}${STORE}export const cart = x.store(s.secret(s.string()), {})\n`),
      f("modules/app/cart.ts", `${S}${STORE}let State = s.secret(s.string())\nexport const cart = store(State, {})\n`),
    ];
    for (const q of quiet) expect(out([q]), q.source).toEqual([]);
    const broken = f("modules/app/State.schema.ts", `${S}export const State = s.object({ t: s.secret(s.string()) )\n`);
    expect(out([broken, cart("State", imp("./State.schema.ts"))])).toEqual([]);
  });

  it("terminates on import cycles and stops after 8 bindings", () => {
    const cycle = [
      schema("A", "s.object({ b: B })", "import { B } from './B.schema.ts'\n"),
      schema("B", "s.object({ a: A })", "import { A } from './A.schema.ts'\n"),
      cart("A", imp("./A.schema.ts")),
    ];
    expect(out(cycle)).toEqual([]);
    const chain = (n: number): string =>
      `${S}${Array.from({ length: n }, (_, i) => `const C${i} = ${i === 0 ? "s.secret(s.string())" : `C${i - 1}`}\n`).join("")}`;
    expect(out([cart("C6", chain(7))])).toHaveLength(1);
    expect(out([cart("C7", chain(8))])).toHaveLength(1);
    expect(out([cart("C8", chain(9))])).toEqual([]);
  });

  it("reports a reused binding once, at each store", () => {
    const head = `${S}const T = s.secret(s.string())\n`;
    const two = f(
      "modules/app/cart.ts",
      `${STORE}${head}export const a = store(s.object({ x: T, y: T }), {})\nexport const b = store(s.object({ y: s.int(), z: T }), {})\n`,
    );
    expect(out([two])).toEqual([`modules/app/cart.ts 4:24 ${msg("x")}`, `modules/app/cart.ts 5:24 ${msg("z")}`]);
  });
});

// Seed 1337
describe("E1303 (a) property: fires iff a secret is reachable within 8 consts", () => {
  // B0 holds the leaf under `depth` wrappers; B1..B(n-1) each wrap the one before. The first `inFiles` live in their
  // own schema files, the rest are consts in cart.ts; with `cycle`, B0 also refers back to B(n-1).
  const where = (i: number, inFiles: number): string =>
    i < inFiles ? `modules/app/B${i}.schema.ts` : "modules/app/cart.ts";
  const spec = (from: string, to: string): string => `./${to.slice("modules/app/".length)}`;
  const build = (n: number, inFiles: number, depth: number, secret: boolean, cycle: boolean): SourceFile[] => {
    let leaf = secret ? "s.secret(s.string())" : "s.string()";
    for (let d = 0; d < depth; d++) leaf = d % 2 === 0 ? `s.object({ w: ${leaf} })` : `s.array(${leaf})`;
    const body = (i: number): string =>
      i > 0 ? `s.object({ f: B${i - 1} })` : cycle ? `s.object({ back: B${n - 1}, leaf: ${leaf} })` : leaf;
    const refs = (i: number): number[] => [...(i > 0 ? [i - 1] : []), ...(i === 0 && cycle ? [n - 1] : [])];
    const head = (path: string, ids: number[]): string =>
      ids
        .filter((j) => where(j, inFiles) !== path)
        .map((j) => `import { B${j} } from '${spec(path, where(j, inFiles))}'\n`)
        .join("");
    const files: SourceFile[] = [];
    for (let i = 0; i < inFiles; i++)
      files.push(f(where(i, inFiles), `${S}${head(where(i, inFiles), refs(i))}export const B${i} = ${body(i)}\n`));
    const local = Array.from({ length: n - inFiles }, (_, k) => inFiles + k);
    const imports = head("modules/app/cart.ts", [...new Set([...local.flatMap(refs), n - 1])]);
    const consts = local.map((i) => `const B${i} = ${body(i)}\n`).join("");
    files.push(f("modules/app/cart.ts", `${S}${STORE}${imports}${consts}export const cart = store(B${n - 1}, {})\n`));
    return files;
  };

  it("over chain length, file placement, nesting depth, secret and cycle", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }).chain((n) => fc.tuple(fc.constant(n), fc.integer({ min: 0, max: n }))),
        fc.integer({ min: 0, max: 4 }),
        fc.boolean(),
        fc.boolean(),
        ([n, inFiles], depth, secret, cycle) => {
          const fired = out(build(n, inFiles, depth, secret, cycle));
          expect(fired).toHaveLength(secret && n <= 8 ? 1 : 0);
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  });
});

describe("E1303 (b) reveal in a transaction function", () => {
  const head = `import { reveal } from '@keel/schema'\n${TX}`;
  const login = (fn: string, h = head): SourceFile =>
    f("modules/app/login.server.ts", `${h}export const login = transaction(cart, 'cart.login', Login, ${fn})\n`);

  it("reports each reference with the transaction name, no fix", () => {
    expect(out([login("(st, p) => ({ ...st, a: reveal(p.t), b: p.l.map(reveal) })")])).toEqual([
      "modules/app/login.server.ts 3:85 transaction cart.login uses reveal; state never holds a secret",
      "modules/app/login.server.ts 3:109 transaction cart.login uses reveal; state never holds a secret",
    ]);
  });

  it("covers function expressions, aliases, namespaces, and an unnamed transaction", () => {
    expect(out([login("function (st, p) { return { ...st, a: reveal(p.t) } }")])).toHaveLength(1);
    const alias = `import { reveal as r } from '@keel/schema'\n${TX}`;
    expect(out([login("(st, p) => ({ ...st, a: r(p.t) })", alias)])).toHaveLength(1);
    const ns = `import * as k from '@keel/schema'\n${TX}`;
    expect(out([login("(st, p) => ({ ...st, a: k.reveal(p.t) })", ns)])).toHaveLength(1);
    const unnamed = f(
      "modules/app/login.server.ts",
      `${head}export const login = transaction(cart, name, Login, (st, p) => ({ ...st, a: reveal(p.t) }))\n`,
    );
    expect(out([unnamed])).toEqual([
      "modules/app/login.server.ts 3:77 transaction ? uses reveal; state never holds a secret",
    ]);
  });

  it("ignores reveal outside the reducer, other modules, computed and other members", () => {
    const outside = f(
      "modules/app/login.server.ts",
      `${head}export const show = (p: { t: never }) => reveal(p.t)\nexport const login = transaction(cart, 'x', Login, (st) => st)\n`,
    );
    expect(out([outside])).toEqual([]);
    const ns = `import * as k from '@keel/schema'\nimport * as other from 'other'\n${TX}`;
    expect(
      out([login("(st, p) => ({ ...st, a: other.reveal(p.t), b: k['reveal'], c: k.parse, d: p.reveal })", ns)]),
    ).toEqual([]);
    const notKeel = `import { reveal } from 'other'\n${TX}`;
    expect(out([login("(st, p) => ({ ...st, a: reveal(p.t) })", notKeel)])).toEqual([]);
    const notTx = `import { reveal } from '@keel/schema'\nimport { transaction } from 'other'\n`;
    expect(out([login("(st, p) => ({ ...st, a: reveal(p.t) })", notTx)])).toEqual([]);
    expect(out([login("reducer")])).toEqual([]);
  });
});

function msg(path: string): string {
  return `store state schema holds s.secret at ${path}; state never holds a secret`;
}

function imp(spec: string): string {
  return `import { State } from '${spec}'\n`;
}
