// Mutation-killing tests for compile() and the compile-time rules: exact diagnostics (code, position, message, see).
import { compile } from "@keel/compiler";
import { describe, expect, it } from "vitest";
import { clientOnly } from "../src/internal/clientOnly.ts";
import type { Diagnostic } from "../src/types/Diagnostic.ts";

type D = Diagnostic;
const d = (code: string, path: string, line: number, col: number, message: string, see: string): D => ({
  code,
  path,
  line,
  col,
  message,
  see,
});
const run = (source: string, path = "a.tsx", options = {}) => compile([{ path, source }], options);
const diags = (source: string, path = "a.tsx", options = {}): D[] => run(source, path, options).diagnostics;

const FLOW = `import { For, Match, Case } from '@keel/runtime-dom'\nimport { s } from '@keel/schema'\n`;

describe("E1403 a && <jsx/>", () => {
  it("flags && with element, fragment, and parenthesized forms only", () => {
    const msg = "`a && <jsx/>` renders conditionally; use <If when={a}>";
    const src =
      "export default function C(p) { return <div>{p.a && <b/>}{p.a && (<b/>)}{p.a && <></>}{p.a && (<></>)}{p.a || <b/>}{p.a && p.b}{p.a && p.b.c}</div> }";
    expect(diags(src)).toEqual([
      d("E1403", "a.tsx", 1, 45, msg, "k.component"),
      d("E1403", "a.tsx", 1, 58, msg, "k.component"),
      d("E1403", "a.tsx", 1, 73, msg, "k.component"),
      d("E1403", "a.tsx", 1, 87, msg, "k.component"),
    ]);
  });
  it("does not flag a fragment on the left or && with a non-JSX call", () => {
    expect(diags("export default function C(p) { return <div>{<b/> && p.a}{p.a && f(<b/>)}</div> }")).toEqual([]);
  });
});

describe("E1002 raw HTML", () => {
  it("reports sinks, inline handler strings (also valueless) and member accesses", () => {
    const src = `export default function C(p) { return <div dangerouslySetInnerHTML={x} onclick="x()" onClick={f} onload={f} ontoggle onx="1" xonclick="1" on="1" on1="1">{p.innerHTML}{el.outerHTML}</div> }`;
    expect(diags(src)).toEqual([
      d("E1002", "a.tsx", 1, 44, "raw HTML via dangerouslySetInnerHTML; render text or elements instead", "k.compiler"),
      d("E1002", "a.tsx", 1, 72, "inline handler string in onclick; pass a function", "k.compiler"),
      d("E1002", "a.tsx", 1, 109, "inline handler string in ontoggle; pass a function", "k.compiler"),
      d("E1002", "a.tsx", 1, 118, "inline handler string in onx; pass a function", "k.compiler"),
      d("E1002", "a.tsx", 1, 157, "raw HTML via innerHTML; render text or elements instead", "k.compiler"),
      d("E1002", "a.tsx", 1, 171, "raw HTML via outerHTML; render text or elements instead", "k.compiler"),
    ]);
  });
  it("ignores inline handler strings on non-HTML elements", () => {
    expect(
      diags(`import {Box} from '@keel/ui'; export default function C(p) { return <Box onclick="x()" ontoggle /> }`),
    ).toEqual([]);
  });
});

describe("E1004 server imports", () => {
  it("reports server specifiers (with and without extension), not type imports or look-alikes", () => {
    const src = `import a from './x.server.ts'; import b from './y.server'; import type c from './z.server.ts'; import d from './w.serverx.ts'; import e from './q.server.tsx'; import {f} from './v.server.mjs'; import g from './server.ts'; import h from './x.server.cts'`;
    const m = (s: string) => `client code imports server module ${s}`;
    expect(diags(src)).toEqual([
      d("E1004", "a.tsx", 1, 1, m("./x.server.ts"), "k.compiler"),
      d("E1004", "a.tsx", 1, 32, m("./y.server"), "k.compiler"),
      d("E1004", "a.tsx", 1, 128, m("./q.server.tsx"), "k.compiler"),
      d("E1004", "a.tsx", 1, 160, m("./v.server.mjs"), "k.compiler"),
      d("E1004", "a.tsx", 1, 223, m("./x.server.cts"), "k.compiler"),
    ]);
  });
  it("exempts server modules and (via topology) client-only files", () => {
    expect(diags(`import a from './x.server.ts'`, "a.server.ts")).toEqual([]);
    expect(diags(`import a from './x.server.ts'`, "a.server.tsx")).toEqual([]);
    expect(diags(`import a from './x.server.ts'`, "a.server.mts")).toEqual([]);
    expect(diags(`import a from './x.server.ts'`, "a.server.js")).toEqual([]);
    const topology = { web: { modules: ["a"], adapter: "client" as const } };
    expect(diags(`import a from './x.server.ts'`, "modules/a/a.ts", { topology })).toEqual([]);
    const node = { web: { modules: ["a"], adapter: "node" as const } };
    expect(diags(`import a from './x.server.ts'`, "modules/a/a.ts", { topology: node })).toHaveLength(1);
  });
});

describe("E1003 / E1501 URL literals", () => {
  const UI = `import { Box, Text, Link, Image } from '@keel/ui'\n`;
  it("reports each literal URL with its attribute name, decoding entities and trimming", () => {
    const src = `${UI}export default function C() { return <div><a href="javascript:x">1</a><a href="/p">2</a><a href="&#106;avascript:x">3</a><Image src="orders" /><Link to="/x" /><a href="  data:x ">4</a><a href="  #frag ">5</a><a href={x}>6</a><a href>7</a><Box src="/x"/></div> }`;
    const bad = "it renders as about:blank";
    expect(diags(src).map(({ fix: _, ...rest }) => rest)).toEqual([
      d("E1003", "a.tsx", 2, 46, `href is a literal script/data URL; ${bad}`, "k.compiler"),
      d("E1501", "a.tsx", 2, 74, "href is a string path; use routes.href(routeId, params)", "k.router"),
      d("E1003", "a.tsx", 2, 92, `href is a literal script/data URL; ${bad}`, "k.compiler"),
      d("E1501", "a.tsx", 2, 150, "to is a string path; use routes.href(routeId, params)", "k.router"),
      d("E1003", "a.tsx", 2, 163, `href is a literal script/data URL; ${bad}`, "k.compiler"),
    ]);
  });
  it("decodes entities only for JSX string attributes", () => {
    expect(
      diags(`export default function C() { return <a href={"&#106;avascript:x"}>1</a> }`).map((x) => x.code),
    ).toEqual([]);
    expect(diags(`export default function C() { return <a href="&#47;p">1</a> }`).map((x) => x.code)).toEqual([
      "E1501",
    ]);
    expect(diags(`export default function C() { return <a href={"&#47;p"}>1</a> }`).map((x) => x.code)).toEqual([]);
  });
});

describe("E1001 For key", () => {
  it("reports missing, bare, empty and unknown keys with clipped names", () => {
    const src = `${FLOW}export const Props = s.object({ xs: s.array(s.object({ id: s.string(), name: s.string() })), n: s.int() });
export default function C(props) { return <ul>
<For each={props.xs} key="zzz">{(x) => <li>{x.id}</li>}</For>
<For each={props.xs} key="averyveryverylongkeyname_that_is_long">{(x) => <li>{x.id}</li>}</For>
<For each={props.xs}>{(x) => <li>{x.id}</li>}</For>
<For each={props.xs} key="">{(x) => <li>{x.id}</li>}</For>
<For each={props.xs} key>{(x) => <li>{x.id}</li>}</For>
<For each={props.xs} key={"id"}>{(x) => <li>{x.id}</li>}</For>
<For each={props.xs} key="id">{(x) => <li>{x.id}</li>}</For>
<For each={props.n} key="id">{(x) => <li>{x.id}</li>}</For>
<For each={props.xs} key={k}>{(x) => <li>{x.id}</li>}</For>
<For key="id">{(x) => <li>{x.id}</li>}</For>
<For each={props.zz} key="id">{(x) => <li>{x.id}</li>}</For>
</ul> }`;
    const need = 'For needs key="<field>" naming a field of the item';
    expect(diags(src)).toEqual([
      d("E1001", "a.tsx", 5, 22, 'For key "zzz" is not a field of the item (id, name)', "k.compiler"),
      d("E1001", "a.tsx", 6, 22, 'For key "averyveryverylong..." is not a field of the item (id, name)', "k.compiler"),
      d("E1001", "a.tsx", 7, 1, need, "k.compiler"),
      d("E1001", "a.tsx", 8, 1, need, "k.compiler"),
      d("E1001", "a.tsx", 9, 1, need, "k.compiler"),
      d("E1001", "a.tsx", 13, 1, need, "k.compiler"),
    ]);
  });
  it("clips the field list to 30 characters", () => {
    const src = `${FLOW}export const Props = s.object({ xs: s.array(s.object({ aaaaaaaaaa: s.string(), bbbbbbbbbb: s.string(), cccccccccc: s.string(), dddddddddd: s.string() })) });
export default function C(props) { return <ul><For each={props.xs} key="k">{(x) => <li>{x.id}</li>}</For></ul> }`;
    expect(diags(src)).toEqual([
      d(
        "E1001",
        "a.tsx",
        4,
        68,
        'For key "k" is not a field of the item (aaaaaaaaaa, bbbbbbbbbb, ccc...)',
        "k.compiler",
      ),
    ]);
  });
  it("accepts a key of exactly the clip length unclipped", () => {
    const k20 = "k".repeat(20);
    const src = `${FLOW}export const Props = s.object({ xs: s.array(s.object({ id: s.string() })) });
export default function C(props) { return <ul><For each={props.xs} key="${k20}">{(x) => <li>{x.id}</li>}</For></ul> }`;
    expect(diags(src)[0]?.message).toBe(`For key "${k20}" is not a field of the item (id)`);
  });
});

describe("E1402 Match exhaustiveness", () => {
  const props = (tags: string[]): string =>
    `export const Props = s.object({ st: s.union("kind", [${tags.map((t) => `s.object({ kind: s.literal("${t}") })`).join(", ")}]), n: s.int() });\n`;
  it("lists missing cases, ignoring bare, dynamic and non-Case children", () => {
    const src = `${FLOW + props(["a", "b", "c"])}export default function C(props) { return <div>
<Match on={props.st}><Case tag="a">x</Case></Match>
<Match on={props.st}><Case tag="a">x</Case><Case tag="b">x</Case><Case tag="c">y</Case></Match>
<Match on={props.st}><Case tag={"a"}>x</Case><Case tag="b">x</Case><Case tag>y</Case><Case>y</Case><Case tag={t}>y</Case>{"s"}<b/></Match>
<Match on={props.n}><Case tag="a">x</Case></Match>
<Match><Case tag="a">x</Case></Match>
</div> }`;
    expect(diags(src)).toEqual([
      d("E1402", "a.tsx", 5, 1, "Match on kind has no Case for: b, c", "k.component"),
      d("E1402", "a.tsx", 7, 1, "Match on kind has no Case for: c", "k.component"),
    ]);
  });
  it("clips the missing list to 50 characters", () => {
    const tags = ["a", "b", "c", "d", "e"].map((c) => c.repeat(12));
    const src = `${
      FLOW + props(tags)
    }export default function C(props) { return <div><Match on={props.st}><Case tag="${"a".repeat(12)}">x</Case></Match></div> }`;
    expect(diags(src)).toEqual([
      d(
        "E1402",
        "a.tsx",
        4,
        48,
        "Match on kind has no Case for: bbbbbbbbbbbb, cccccccccccc, dddddddddddd, eeeee...",
        "k.component",
      ),
    ]);
  });
  it("ignores a Match with a Case from another namespace", () => {
    const src = `${
      FLOW + props(["a", "b"])
    }export default function C(props) { return <div><Match on={props.st}><Other tag="a">x</Other></Match></div> }`;
    expect(diags(src).map((x) => x.code)).toEqual(["E1402"]);
  });
});

describe("E1401 props destructuring", () => {
  const msg = (name: string, first: string): string => `props destructured in ${name}; read props.${first} instead`;
  const fixOf = (src: string, path = "src/cart.tsx", n = 0): string | undefined => diags(src, path)[n]?.fix;

  it("rewrites reads and emits an exact patch", () => {
    const src =
      "export default function C({ a, b: c }) { return <p title={a}>{c}{(() => { const a = 2; return a })()}</p> }";
    const out = run(src, "src/cart.tsx");
    expect(out.diagnostics).toEqual([
      {
        ...d("E1401", "src/cart.tsx", 1, 27, msg("C", "a"), "k.component"),
        fix: `--- a/src/cart.tsx\n+++ b/src/cart.tsx\n@@ -1,1 +1,1 @@\n-${src}\n\\ No newline at end of file\n+export default function C(props) { return <p title={props.a}>{props.b}{(() => { const a = 2; return a })()}</p> }\n\\ No newline at end of file`,
      },
    ]);
    expect(out.outputs[0]?.code).toContain("function C(props) {");
    expect(out.outputs[0]?.code).toContain("props.b");
  });
  it("names the stem for an anonymous default export and gives no fix for non-simple patterns", () => {
    expect(diags("export default ({ a, ...rest }) => <p>{a}</p>", "src/cart.tsx")).toEqual([
      d("E1401", "src/cart.tsx", 1, 17, msg("cart", "a"), "k.component"),
    ]);
    expect(run("export default ({ a, ...rest }) => <p>{a}</p>", "src/cart.tsx").outputs[0]?.code).toContain(
      "({ a, ...rest })",
    );
  });
  it("treats defaults, computed keys, literal keys and nested patterns as non-simple", () => {
    const first = (src: string): D | undefined => diags(src, "src/cart.tsx")[0];
    expect(first("export default function C({ a = 1, b }) { return <p>{a}</p> }")).toEqual(
      d("E1401", "src/cart.tsx", 1, 27, msg("C", "b"), "k.component"),
    );
    expect(first("export default function C({ [k]: v, a }) { return <p>{a}</p> }")).toEqual(
      d("E1401", "src/cart.tsx", 1, 27, msg("C", "a"), "k.component"),
    );
    expect(first(`export default function C({ "x": y, a }) { return <p>{a}</p> }`)).toEqual(
      d("E1401", "src/cart.tsx", 1, 27, msg("C", "a"), "k.component"),
    );
    expect(first("export default function C({ a: { z }, b }) { return <p>{b}</p> }")).toEqual(
      d("E1401", "src/cart.tsx", 1, 27, msg("C", "b"), "k.component"),
    );
    expect(first("export default function C({ a = 1 }) { return <p>{a}</p> }")).toEqual(
      d("E1401", "src/cart.tsx", 1, 27, msg("C", "x"), "k.component"),
    );
    const out = run("export default function C({ [k]: v, a }) { return <p>{a}</p> }", "src/cart.tsx").outputs[0]?.code;
    expect(out).toContain("C({ [k]: v, a })");
  });
  it("clips the prop name to 20 and the component name to 30 characters", () => {
    const src = "export default function C({ averyveryveryverylongpropnameover20: x }) { return <p>{x}</p> }";
    const [first] = diags(src, "src/cart.tsx");
    expect(first?.message).toBe(msg("C", "averyveryveryverylon"));
    expect(first?.fix).toContain(
      "+export default function C(props) { return <p>{props.averyveryveryverylongpropnameover20}</p> }",
    );
    const src2 =
      "function Averyveryveryverylongcomponentnameover30xxxxx({ a }) { return <p>{a}</p> }\nexport default function Q({}) { return <p/> }";
    const ds = diags(src2, "src/cart.tsx");
    expect(ds.map((x) => x.message)).toEqual([msg("Averyveryveryverylongcomponent", "a"), msg("Q", "x")]);
    expect(ds[0]?.fix).toBe(
      "--- a/src/cart.tsx\n+++ b/src/cart.tsx\n@@ -1,2 +1,2 @@\n-function Averyveryveryverylongcomponentnameover30xxxxx({ a }) { return <p>{a}</p> }\n+function Averyveryveryverylongcomponentnameover30xxxxx(props) { return <p>{props.a}</p> }\n export default function Q({}) { return <p/> }\n\\ No newline at end of file",
    );
    expect(ds[1]?.fix).toBe(
      "--- a/src/cart.tsx\n+++ b/src/cart.tsx\n@@ -1,2 +1,2 @@\n function Averyveryveryverylongcomponentnameover30xxxxx({ a }) { return <p>{a}</p> }\n-export default function Q({}) { return <p/> }\n\\ No newline at end of file\n+export default function Q(props) { return <p/> }\n\\ No newline at end of file",
    );
  });
  it("keeps the type annotation as the props type and leaves outer and shadowed names alone", () => {
    expect(fixOf("export default function C({ a }: { a: string }) { return <p>{a}{a}</p> }")).toContain(
      "+export default function C(props: { a: string }) { return <p>{props.a}{props.a}</p> }",
    );
    expect(fixOf("export default function C({ a }) { return <p>{a}</p> }\nconst a = 5; const q = a;")).toBe(
      "--- a/src/cart.tsx\n+++ b/src/cart.tsx\n@@ -1,2 +1,2 @@\n-export default function C({ a }) { return <p>{a}</p> }\n+export default function C(props) { return <p>{props.a}</p> }\n const a = 5; const q = a;\n\\ No newline at end of file",
    );
    expect(fixOf("export default function C({ a }) { return <p {...{a}} x={{a}}>{a}</p> }")).toContain(
      "{...{a: props.a}} x={{a: props.a}}>{props.a}",
    );
    expect(fixOf("export default function C({ a }, other) { return <p>{a}</p> }")).toContain("C(props, other)");
  });
  it("only rewrites reads inside the body (not parameter defaults) and at the body's edges", () => {
    const outDefault = run("export default function C({ a }, x = a) { return <p>{a}{x}</p> }", "src/cart.tsx");
    expect(outDefault.outputs[0]?.code).toContain("C(props, x = a)");
    expect(outDefault.outputs[0]?.code).toContain("props.a");
    const edgeStart = run("const C = ({ a }) => a ?? <p/>;\nexport default C;", "src/cart.tsx");
    expect(edgeStart.outputs[0]?.code).toContain("(props) => __kscoped(() => (props.a ?? ");
    const edgeEnd = run("const C = ({ a }) => <p/> ?? a;\nexport default C;", "src/cart.tsx");
    expect(edgeEnd.outputs[0]?.code).toContain("?? props.a");
  });
});

describe("compile()", () => {
  it("reports syntax errors with only E1000 and no output (RFC 0030)", () => {
    const r = run("const = ;", "s.tsx");
    expect(r.diagnostics).toEqual([d("E1000", "s.tsx", 1, 7, "syntax error: Unexpected token", "k.compiler")]);
    expect(r.outputs).toEqual([]);
    expect(r.artifacts["deps.json"]).toEqual({ edges: [], nodes: [] });
    expect(r.artifacts["styles.json"]).toEqual({ usages: [] });
    const other = compile([
      {
        path: "b.tsx",
        source: `const s = signal(0);\nexport default function B() { return <a id="x" href="/y" innerHTML={s}>`,
      },
      { path: "c.tsx", source: `export default function C() { return <p id="x">c</p> }` },
    ]);
    expect(other.diagnostics.map((x) => x.code)).toEqual(["E1000"]);
    expect(Object.keys(other.artifacts["ids.json"])).toEqual(["x"]);
    expect(other.artifacts["ids.json"].x?.file).toBe("c.tsx");
    expect(other.outputs.map((o) => o.path)).toEqual(["c.tsx"]);
  });

  it("clips the E1000 message to one line under 90 chars", () => {
    const long = compile([{ path: "l.tsx", source: `const x = <${"a".repeat(120)}></b>;` }]).diagnostics;
    for (const x of long) {
      expect(x.message.startsWith("syntax error: ")).toBe(true);
      expect(x.message.length).toBeLessThan(90);
      expect(x.message).not.toContain("\n");
    }
    expect(long.some((x) => x.message.endsWith("..."))).toBe(true);
  });

  it("rethrows anything thrown inside as E1049, never as an app code", () => {
    const file = {
      path: "a.tsx",
      get source(): string {
        throw new Error("kaput");
      },
    };
    let caught: unknown;
    try {
      compile([file]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toMatchObject({ code: "E1049", message: "internal compiler failure: kaput" });
    expect(() => compile([file])).toThrow(/^internal compiler failure: kaput$/);
  });

  it("reports duplicate ids across files with clipped id and location", () => {
    const long = "dup".repeat(14);
    const r = compile([
      {
        path: "modules/aaaaaaaaaaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/c.tsx",
        source: `export default function A() { return <p id="dup">a</p> }`,
      },
      {
        path: "z.tsx",
        source: `export default function B() { return <p id="${long}">a</p> }\nexport function Q() { return <p id="dup">a</p> }`,
      },
      { path: "y.tsx", source: `export default function B() { return <p id="${long}">a</p> }` },
    ]);
    expect(r.diagnostics).toEqual([
      d("E1404", "y.tsx", 1, 38, `duplicate element id "${long.slice(0, 30)}" (first at z.tsx:1:38)`, "k.component"),
      d(
        "E1404",
        "z.tsx",
        2,
        30,
        'duplicate element id "dup" (first at bbbbbbbbbbbbbbbbbbbbbbbbbbbbb/c.tsx:1:38)',
        "k.component",
      ),
    ]);
    expect(r.artifacts["ids.json"].dup?.file).toBe(
      "modules/aaaaaaaaaaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/c.tsx",
    );
    expect(r.artifacts["ids.json"][long]?.file).toBe("z.tsx");
    expect(r.artifacts["a11y.json"].dup).toEqual({ name: "none", role: "paragraph", tag: "p" });
  });

  it("sorts diagnostics by path, line, column, then code", () => {
    const r = compile([
      { path: "b.tsx", source: `export default function B() { return <a href="javascript:x">a</a> }` },
      { path: "a.tsx", source: `export default function A() { return <a href="javascript:x">a</a> }` },
      {
        path: "c.tsx",
        source: `export default function A() { return <div>
<a href="javascript:x">a</a><a   onclick="x" href="javascript:x">a</a><p innerHTML={x}  />{y.innerHTML}
{z.innerHTML}<a href="javascript:x">a</a></div> }`,
      },
      {
        path: "d.tsx",
        source: `import q from './x.server.ts';export default function A() { return <a href="javascript:x">a</a> }`,
      },
    ]);
    expect(r.diagnostics.map((x) => `${x.path}:${x.line}:${x.col}:${x.code}`)).toEqual([
      "a.tsx:1:41:E1003",
      "b.tsx:1:41:E1003",
      "c.tsx:2:4:E1003",
      "c.tsx:2:34:E1002",
      "c.tsx:2:46:E1003",
      "c.tsx:2:74:E1002",
      "c.tsx:2:94:E1002",
      "c.tsx:3:4:E1002",
      "c.tsx:3:17:E1003",
      "d.tsx:1:1:E1004",
      "d.tsx:1:71:E1003",
    ]);
  });

  it("copies given routes sorted by id, skipping undefined entries", () => {
    const entry = (path: string) => ({
      actions: [],
      guard: null,
      layout: null,
      module: "m",
      params: null,
      path,
      search: null,
    });
    const routes: Record<string, ReturnType<typeof entry>> = { b: entry("/b"), a: entry("/a") };
    Reflect.set(routes, "hole", undefined);
    const r = compile([], { routes });
    expect(Object.keys(r.artifacts["routes.json"])).toEqual(["a", "b"]);
    expect(r.artifacts["routes.json"].a?.path).toBe("/a");
    expect(r.hashes["routes.json"]).toMatch(/^fnv1a:[0-9a-f]{8}$/);
  });

  it("returns no artifacts or outputs for no files", () => {
    const r = compile([]);
    expect(r.outputs).toEqual([]);
    expect(r.diagnostics).toEqual([]);
  });
});

describe("clientOnly (mutation)", () => {
  const top = (adapter: "node" | "static" | "client", mods = ["a"]) => ({ web: { modules: mods, adapter } });
  it("is false without a topology", () => {
    expect(clientOnly("modules/a/x.ts", undefined)).toBe(false);
    expect(clientOnly("other/x.ts", undefined)).toBe(false);
  });
  it("exempts files outside a module once a topology is known", () => {
    const t = { n: { modules: ["a"], adapter: "node" as const } };
    expect(clientOnly("a/b/c.ts", t)).toBe(true);
    expect(clientOnly("modules/a", t)).toBe(true);
    expect(clientOnly("x.ts", t)).toBe(true);
  });
  it("normalizes backslashes", () => {
    const t = top("client");
    expect(clientOnly("modules\\a\\x.ts", t)).toBe(true);
    expect(clientOnly("modules\\a\\x.ts", top("node"))).toBe(false);
  });
  it("applies owner rules", () => {
    expect(clientOnly("modules/zzz/x.ts", top("client"))).toBe(false);
    expect(clientOnly("modules/a/x.ts", top("client"))).toBe(true);
    expect(clientOnly("modules/a/x.ts", { c: top("client").web, n: top("node").web })).toBe(false);
    expect(clientOnly("modules/a/routes.ts", top("node"))).toBe(true);
    expect(clientOnly("modules/a/routes.ts", top("static"))).toBe(false);
    expect(clientOnly("modules/a/routes.ts", { s: top("static").web, n: top("node").web })).toBe(false);
    expect(clientOnly("modules/a/routes.ts", { c: top("client").web, n: top("node").web })).toBe(true);
    expect(clientOnly("modules/a/sub/routes.ts", top("node"))).toBe(false);
    expect(clientOnly("modules/a/other.ts", top("node"))).toBe(false);
    expect(clientOnly("src/modules/a/routes.ts", top("node"))).toBe(true);
    expect(clientOnly("modules/a/routes.ts", { x: top("node", ["b"]).web, n: top("static").web })).toBe(false);
  });
});
