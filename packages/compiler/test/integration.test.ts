// @vitest-environment happy-dom
// Compiler integration (D23-D31): style usages and class rewrite, topology and E1004, routes input, ctx to
// child components, `uses` scope, slot/children calls as nodes, module-level stores.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { scope } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { describe, expect, it } from "vitest";

const one = (path: string, source: string) => {
  const r = compile([{ path, source }]);
  return { r, code: r.outputs[0]?.code ?? "" };
};

const host = (C: unknown, props: unknown = {}, ctx?: unknown): HTMLElement => {
  if (typeof C !== "function") throw new Error("no component");
  const el = document.createElement("div");
  mount(() => C(props, undefined, ctx), el);
  return el;
};

describe("styles.json and the class rewrite", () => {
  const src = `import { Box, Text as T, styles } from "@keel/ui";
const css = styles({ card: { p: "3", states: { hover: { bg: "accent" } } } });
export default function Row(props: { done: boolean }) {
  return <Box p="2" fg={props.done ? "muted" : "fg"} class="extra">
    <T as="span" px={{ base: "1", md: "2" }}>a</T>
    <T class={css.card} py="1">b</T>
    <Box {...props} m="1" />
  </Box>;
}`;

  it("collects every literal token per prop/breakpoint/state, sorted and deduplicated", () => {
    const { r } = one("modules/todos/Row.tsx", src);
    expect(r.diagnostics).toEqual([]);
    const usages = r.artifacts["styles.json"].usages;
    for (const u of [
      { props: { p: "2" } },
      { props: { fg: "muted" } },
      { props: { fg: "fg" } },
      { props: { px: "1" } },
      { breakpoint: "md", props: { px: "2" } },
      { props: { py: "1" } },
      { props: { m: "1" } },
      { props: { p: "3" } },
      { props: { bg: "accent" }, state: "hover" },
    ])
      expect(usages).toContainEqual(u);
    expect(usages.length).toBe(9);
    expect(compile([{ path: "modules/todos/Row.tsx", source: src }])).toEqual(r);
    expect(r.hashes["styles.json"]).toMatch(/^fnv1a:/);
  });

  it("moves static style props into class, keeps dynamic ones, and leaves spreads and dynamic class alone", () => {
    const { code } = one("modules/todos/Row.tsx", src);
    expect(code).toContain('class: "k-p-2 extra"');
    expect(code).toContain("get fg()");
    expect(code).toContain('class: "k-px-1 k-md-px-2"');
    expect(code).not.toMatch(/\bpx: /);
    expect(code).toContain('py: "1"');
    expect(code).toContain('m: "1"');
  });

  it("leaves elements not imported from @keel/ui untouched", () => {
    const { r, code } = one(
      "A.tsx",
      `function Box(p: { p: string }) { return <i /> }\nexport default () => <Box p="2" />`,
    );
    expect(r.artifacts["styles.json"].usages).toEqual([]);
    expect(code).toContain('p: "2"');
  });
});

describe("topology and routes inputs", () => {
  const files = [
    {
      path: "modules/todos/routes.ts",
      source: `import { loadList } from "./loadList.server.ts";\nexport const r = loadList;\n`,
    },
    { path: "src/shared.ts", source: `import { x } from "../modules/todos/x.server.ts";\nexport const y = x;\n` },
  ];

  it("reports E1004 without a topology or for a static deployable", () => {
    expect(compile(files).diagnostics.map((d) => `${d.code} ${d.path}`)).toEqual([
      "E1004 modules/todos/routes.ts",
      "E1004 src/shared.ts",
    ]);
    const stat = compile(files, { topology: { web: { modules: ["todos"], adapter: "static" } } });
    expect(stat.diagnostics.map((d) => `${d.code} ${d.path}`)).toEqual(["E1004 modules/todos/routes.ts"]);
  });

  it("is per deployable: node-only routes.ts and files outside modules/ are legal (D40)", () => {
    const node = { web: { modules: ["todos"], adapter: "node" as const } };
    expect(compile(files, { topology: node }).diagnostics).toEqual([]);
    const comp = [{ path: "modules/todos/List.tsx", source: files[0]?.source ?? "" }];
    expect(compile(comp, { topology: node }).diagnostics.map((d) => d.code)).toEqual(["E1004"]);
    const mixed = {
      web: { modules: ["todos"], adapter: "node" as const },
      app: { modules: ["todos"], adapter: "client" as const },
    };
    expect(compile(files, { topology: mixed }).diagnostics).toEqual([]);
    const other = { api: { modules: ["admin"], adapter: "node" as const } };
    expect(compile([files[1] ?? { path: "", source: "" }], { topology: other }).diagnostics).toEqual([]);
    const t = { path: "test/a.test.ts", source: files[0]?.source ?? "" };
    expect(compile([t], { topology: node }).diagnostics).toEqual([]);
  });

  it("skips E1004 for files whose deployables are all client-only", () => {
    const client = compile(files, { topology: { web: { modules: ["todos"], adapter: "client" } } });
    expect(client.diagnostics).toEqual([]);
    const split = compile(files, {
      topology: { app: { modules: ["todos"], adapter: "client" }, api: { modules: ["admin"], adapter: "node" } },
    });
    expect(split.diagnostics).toEqual([]);
  });

  it("copies a precomputed routes artifact, sorted, into routes.json; default is {}", () => {
    expect(compile(files).artifacts["routes.json"]).toEqual({});
    const entry = (path: string | null) => ({
      actions: [],
      guard: null,
      layout: null,
      module: "todos",
      params: null,
      path,
      search: null,
    });
    const r = compile([], { routes: { "todos.z": entry("/z"), "todos.a": entry("/") } });
    expect(Object.keys(r.artifacts["routes.json"])).toEqual(["todos.a", "todos.z"]);
    expect(r.hashes["routes.json"]).not.toBe(compile([]).hashes["routes.json"]);
  });
});

describe("generated component code", () => {
  it("passes the enclosing component's ctx to child components as the third argument", () => {
    const { r, code } = one(
      "C.tsx",
      `function Child(props: object, slots: unknown, ctx: { name: string }) { return <p>{ctx.name}</p> }
function Named(props: object, slots: unknown, c: { name: string }) { return <div><Child /></div> }
export default function App() { return <section><Child /><Named /></section> }`,
    );
    expect(r.diagnostics).toEqual([]);
    expect(code).toContain("Child({}, undefined, c)");
    expect(host(evaluate(code), {}, { name: "real" }).textContent).toBe("realreal");
  });

  it("runs a component exporting uses in its own scope that declares them", () => {
    const { code } = one(
      "modules/t/C.tsx",
      `import { store, transaction, tx } from "@keel/store";
import { s } from "@keel/schema";
const st = store(s.object({ n: s.int() }), { n: 0 });
const inc = transaction(st, "t.inc", s.object({}), (x) => ({ n: x.n + 1 }));
const dec = transaction(st, "t.dec", s.object({}), (x) => ({ n: x.n - 1 }));
export const uses = [inc];
export default function C() {
  const b = tx(dec, {});
  C.seen = b.ok ? "ok" : b.error.code;
  return <p>x</p>;
}
C.outside = () => tx(dec, {}).ok;`,
    );
    // the body is wrapped in a child scope that declares `uses` before anything else runs
    expect(code).toMatch(/__kscoped\(\(\) => \{ for \(const __ku of uses\) __ku\.store\.uses\(\[__ku\]\);/);
    const C = evaluate(code);
    let outside: unknown;
    scope(() => {
      host(C);
      outside = typeof C === "function" ? Reflect.get(C, "outside")() : undefined;
    });
    // undeclared inside the component (rejected before any write); a sibling scope stays unrestricted
    expect(typeof C === "function" ? Reflect.get(C, "seen") : undefined).toBe("store.undeclared");
    expect(outside).toBe(true);
  });

  it("runs every component instance in its own scope, a child of its caller's, disposed with it", () => {
    const { code } = one(
      "S.tsx",
      `import { owner, signal, effect } from "@keel/reactive";
function Leaf(props: { tag: string }) { S.seen.push([props.tag, owner()]); const n = signal(0); effect(() => { S.runs.push(n.get()); }); S.sigs.push(n); return <i>{props.tag}</i> }
export default function S() { S.seen.push(["root", owner()]); return <p><Leaf tag="a" /><Leaf tag="b" /></p> }`,
    );
    const S = evaluate(code);
    if (typeof S !== "function") throw new Error("no component");
    const seen: [string, unknown][] = [];
    const runs: number[] = [];
    const sigs: { set(v: number): void }[] = [];
    Object.assign(S, { seen, runs, sigs });
    const el = document.createElement("div");
    const dispose = mount(() => S({}, undefined, undefined), el);
    const [root, a, b] = seen.map(([, o]) => o);
    expect(seen.map(([t]) => t)).toEqual(["root", "a", "b"]);
    expect(new Set([root, a, b]).size).toBe(3);
    expect(Reflect.get(Object(a), "parent")).toBe(root);
    expect(Reflect.get(Object(b), "parent")).toBe(root);
    expect(el.textContent).toBe("ab");
    dispose();
    runs.length = 0;
    for (const n of sigs) n.set(1);
    expect(runs).toEqual([]);
  });

  it("inserts props.children() and slots calls as nodes, not text", () => {
    const { code } = one(
      "W.tsx",
      `function Wrap(props: { children: () => Node }) { return <section>{props.children()}</section> }
function Opt(props: { children?: () => Node }) { return <aside>{props.children?.()}</aside> }
export default function C() { return <div><Wrap><b>x</b><i>y</i></Wrap><Opt>z</Opt></div> }`,
    );
    const el = host(evaluate(code));
    expect(el.querySelector("section > b")?.textContent).toBe("x");
    expect(el.querySelector("section > i")?.textContent).toBe("y");
    expect(el.querySelector("aside")?.textContent).toBe("z");
    expect(el.textContent).not.toContain("[object");
  });

  it("inserts `props.children?.() ?? <fallback>` as a node and renders the fallback when the thunk is absent", () => {
    const { code } = one(
      "W.tsx",
      `function Shell(props: { children?: () => Node }) { return <main>{props.children?.() ?? ""}</main> }
function Fb(props: { children?: () => Node }) { return <aside>{props.children?.() ?? "none"}</aside> }
export default function C() { return <div><Shell><b>x</b></Shell><Fb /><Fb>y</Fb></div> }`,
    );
    const el = host(evaluate(code));
    expect(el.querySelector("main > b")?.textContent).toBe("x");
    expect([...el.querySelectorAll("aside")].map((a) => a.textContent)).toEqual(["none", "y"]);
    expect(el.textContent).not.toContain("[object");
  });

  it("creates module-level stores in a root scope and fills their id from the module and export", () => {
    const { code } = one(
      "modules/todos/board.ts",
      `import { store } from "@keel/store";
import { s } from "@keel/schema";
export const board = store(s.object({ n: s.int() }), { n: 0 });
export const named = store(s.object({ n: s.int() }), { n: 0 }, { id: "todos.other" });
export default board;`,
    );
    expect(code).toContain('{ id: "todos.board" }');
    expect(code).not.toContain('"todos.named"');
    const b = evaluate(code);
    expect(typeof b === "object" && b !== null ? Reflect.get(b, "id") : undefined).toBe("todos.board");
  });
});

describe("For empty slot (compiler D39)", () => {
  it("lowers `empty` to the fifth argument of list", () => {
    const { code } = one(
      "A.tsx",
      `import { For } from "@keel/runtime-dom";\nexport default (p: { xs: { id: string }[] }) => <ul><For each={p.xs} key="id" empty={() => <li>none</li>}>{(x) => <li>{x.id}</li>}</For></ul>;\n`,
    );
    expect(code).toMatch(/\.list\(/);
    expect(code).toContain("none");
    const noEmpty = one(
      "B.tsx",
      `import { For } from "@keel/runtime-dom";\nexport default (p: { xs: { id: string }[] }) => <ul><For each={p.xs} key="id">{(x) => <li>{x.id}</li>}</For></ul>;\n`,
    ).code;
    expect(noEmpty).not.toContain("none");
  });
});
