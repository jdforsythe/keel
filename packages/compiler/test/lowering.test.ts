// @vitest-environment happy-dom
// Example tests for JSX lowering beyond the conformance suite.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import type { Signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { describe, expect, it } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1 });

function component(source: string, path = "T.tsx"): { C: () => Node; mod: unknown } {
  const r = compile([{ path, source }]);
  expect(r.diagnostics).toEqual([]);
  const C = evaluate(r.outputs[0]?.code ?? "");
  if (typeof C !== "function") throw new Error("no component");
  return { C: () => C(), mod: C };
}

function isSignal(x: unknown): x is Signal<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    "get" in x &&
    "set" in x &&
    typeof x.get === "function" &&
    typeof x.set === "function"
  );
}

function sig(owner: unknown, key: string): Signal<unknown> {
  const v: unknown = typeof owner === "function" ? Reflect.get(owner, key) : undefined;
  if (!isSignal(v)) throw new Error(`no signal ${key}`);
  return v;
}

const render = (C: () => Node) => {
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = mount(C, host, { ctx: simCtx });
  return {
    host,
    dispose: () => {
      dispose();
      host.remove();
    },
  };
};

describe("lowering", () => {
  it("binds events by element id and updates text in place", () => {
    const { C, mod } = component(`
import { signal } from '@keel/reactive'
const n = signal(0)
function T() { return <button onClick={() => n.set(n.get() + 1)}>n={n.get()}</button> }
T.n = n
export default T`);
    const { host, dispose } = render(C);
    const b = host.querySelector("button");
    b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    b?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(b?.textContent).toBe("n=2");
    expect(sig(mod, "n").get()).toBe(2);
    dispose();
  });

  it("lowers If, root-level For and Match with plain-value callbacks", () => {
    const { C, mod } = component(`
import { signal } from '@keel/reactive'
import { For, If, Match, Case } from '@keel/runtime-dom'
const on = signal(false)
const xs = signal([{ id: 'a', n: 1 }, { id: 'b', n: 2 }])
const st = signal({ state: 'loading' })
function T() {
  return <section>
    <If when={on.get()}><em>on</em></If>
    <ol><For each={xs.get()} key="id">{(x, i) => <li>{i}:{x.id}={x.n}</li>}</For></ol>
    <Match on={st.get()}>
      <Case tag="loading"><i>wait</i></Case>
      <Case tag="ready">{(v) => <b>{v.value}</b>}</Case>
    </Match>
  </section>
}
T.on = on; T.xs = xs; T.st = st
export default T`);
    const { host, dispose } = render(C);
    expect(host.querySelector("em")).toBeNull();
    sig(mod, "on").set(true);
    expect(host.querySelector("em")?.textContent).toBe("on");
    expect([...host.querySelectorAll("li")].map((l) => l.textContent)).toEqual(["0:a=1", "1:b=2"]);
    sig(mod, "xs").set([
      { id: "b", n: 5 },
      { id: "a", n: 1 },
    ]);
    expect([...host.querySelectorAll("li")].map((l) => l.textContent)).toEqual(["0:b=5", "1:a=1"]);
    expect(host.querySelector("i")?.textContent).toBe("wait");
    sig(mod, "st").set({ state: "ready", value: "done" });
    expect(host.querySelector("i")).toBeNull();
    expect(host.querySelector("b")?.textContent).toBe("done");
    dispose();
  });

  it("passes props as getters so a child binding tracks the parent's signal", () => {
    const { C, mod } = component(`
import { signal } from '@keel/reactive'
const s = signal('a')
function Label(props) { return <span title={props.t}>{props.t}</span> }
function T() { return <div><Label t={s.get()} /></div> }
T.s = s
export default T`);
    const { host, dispose } = render(C);
    const span = host.querySelector("span");
    sig(mod, "s").set("b");
    expect(host.querySelector("span")).toBe(span);
    expect(span?.textContent).toBe("b");
    expect(span?.getAttribute("title")).toBe("b");
    dispose();
  });

  it("rewrites simple destructured props (E1401) into props reads that still work", () => {
    const src = `function Hi({ name }) { return <p>hi {name}</p> }\nexport default function T() { return <div><Hi name="x" /></div> }`;
    const r = compile([{ path: "T.tsx", source: src }]);
    expect(r.diagnostics.map((d) => d.code)).toEqual(["E1401"]);
    expect(r.diagnostics[0]?.fix).toBe(
      [
        "--- a/T.tsx",
        "+++ b/T.tsx",
        "@@ -1,2 +1,2 @@",
        "-function Hi({ name }) { return <p>hi {name}</p> }",
        "+function Hi(props) { return <p>hi {props.name}</p> }",
        ' export default function T() { return <div><Hi name="x" /></div> }',
        "\\ No newline at end of file",
      ].join("\n"),
    );
    const T = evaluate(r.outputs[0]?.code ?? "");
    if (typeof T !== "function") throw new Error("no component");
    const { host, dispose } = render(() => T());
    expect(host.textContent).toBe("hi x");
    dispose();
  });

  it("leaves E1401 reads alone when an inner function redeclares the name", () => {
    const src = "export default function T({ n }) { return <p title={[1].map((n) => n).join()}>{n}</p> }";
    const fix = compile([{ path: "T.tsx", source: src }]).diagnostics[0]?.fix ?? "";
    expect(fix).toContain(
      "+export default function T(props) { return <p title={[1].map((n) => n).join()}>{props.n}</p> }",
    );
  });

  it("rewrites For row reads scope-aware: an inner (item) => item.n keeps its own item", () => {
    const { C, mod } = component(`
import { signal } from '@keel/reactive'
import { For } from '@keel/runtime-dom'
const rows = signal([{ id: 'a', tags: [{ n: 1 }, { n: 2 }] }])
function T() {
  return <ul><For each={rows.get()} key="id">{(item) => <li>{item.id}:{item.tags.map((item) => item.n).join(",")}</li>}</For></ul>
}
T.rows = rows
export default T`);
    const { host, dispose } = render(C);
    expect(host.querySelector("li")?.textContent).toBe("a:1,2");
    const li = host.querySelector("li");
    sig(mod, "rows").set([{ id: "a", tags: [{ n: 3 }] }]);
    expect(host.querySelector("li")).toBe(li);
    expect(li?.textContent).toBe("a:3");
    dispose();
  });

  it("keeps rows with a destructured param live when the item for a key changes", () => {
    const { C, mod } = component(`
import { signal } from '@keel/reactive'
import { For } from '@keel/runtime-dom'
const rows = signal([{ id: 'a', name: 'x', meta: { n: 1 } }])
function T() {
  return <ul><For each={rows.get()} key="id">{({ id, name, meta: { n } }, i) => <li title={name}>{i}{id}{name}{n}</li>}</For></ul>
}
T.rows = rows
export default T`);
    const { host, dispose } = render(C);
    const li = host.querySelector("li");
    expect(li?.textContent).toBe("0ax1");
    sig(mod, "rows").set([{ id: "a", name: "y", meta: { n: 2 } }]);
    expect(host.querySelector("li")).toBe(li);
    expect(li?.textContent).toBe("0ay2");
    expect(li?.getAttribute("title")).toBe("y");
    dispose();
  });

  it("keeps explicit ids that collide with Object.prototype names", () => {
    const r = compile([
      {
        path: "P.tsx",
        source: `export default function P() { return <div id="constructor"><b id="__proto__">x</b><i id="toString"/></div> }`,
      },
    ]);
    expect(r.diagnostics).toEqual([]);
    const ids = r.artifacts["ids.json"];
    expect(Object.keys(ids).sort()).toEqual(["__proto__", "constructor", "toString"]);
    expect(Object.hasOwn(ids, "__proto__") && ids.__proto__?.tag).toBe("b");
    expect(JSON.stringify(ids)).toContain('"__proto__"');
    expect(Object.keys(r.artifacts["a11y.json"]).length).toBe(3);
  });

  it("derives ids from the root-relative path, so same-named files in two folders do not collide", () => {
    const r = compile([
      { path: "a/index.tsx", source: "export default function A() { return <p>a</p> }" },
      { path: "b/index.tsx", source: "export default function B() { return <p>b</p> }" },
      {
        path: "src/orders/OrderList.tsx",
        source: "export default function OrderList() { return <ul><li>o</li></ul> }",
      },
    ]);
    expect(r.diagnostics).toEqual([]);
    expect(Object.keys(r.artifacts["ids.json"])).toEqual([
      "a.index.0",
      "b.index.0",
      "src.orders.OrderList.0",
      "src.orders.OrderList.1",
    ]);
  });

  it("treats any-case on* attributes as event bindings and rejects inline handler strings", () => {
    const { C, mod } = component(`
import { signal } from '@keel/reactive'
const n = signal(0)
function T() { return <button onclick={() => n.set(n.get() + 1)}>go</button> }
T.n = n
export default T`);
    const { host, dispose } = render(C);
    host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(sig(mod, "n").get()).toBe(1);
    expect(host.querySelector("button")?.hasAttribute("onclick")).toBe(false);
    dispose();
    const r = compile([
      { path: "S.tsx", source: `export default function S() { return <a onClick="alert(1)" onmouseover="x()">x</a> }` },
    ]);
    expect(r.diagnostics.map((d) => d.code)).toEqual(["E1002", "E1002"]);
    expect(r.outputs[0]?.code).not.toContain("alert(1)");
  });

  it("keeps the JSX tree when HTML parsing would restructure it (p > div, table > tr)", () => {
    const { C } = component(
      "export default function T() { return <div><p><div>a</div></p><table><tr><td>1</td></tr></table></div> }",
    );
    const { host, dispose } = render(C);
    expect(host.querySelector("p > div")?.textContent).toBe("a");
    expect(host.querySelector("table > tr > td")?.textContent).toBe("1");
    dispose();
  });

  it("lowers a root fragment, a root-level For and a Boundary with its fallback", () => {
    const { C } = component(`
import { For, Boundary } from '@keel/runtime-dom'
function Bad() { throw new Error('boom') }
function Rows() { return <For each={[{ id: 1 }, { id: 2 }]} key="id">{(r) => <i>{r.id}</i>}</For> }
export default function T() {
  return <>
    <Rows />
    <Boundary fallback={(e) => <b>caught</b>}><Bad /></Boundary>
    tail
  </>
}`);
    const { host, dispose } = render(C);
    expect([...host.querySelectorAll("i")].map((i) => i.textContent)).toEqual(["1", "2"]);
    expect(host.querySelector("b")?.textContent).toBe("caught");
    expect(host.textContent).toContain("tail");
    dispose();
  });

  it("keeps TypeScript outside JSX byte for byte", () => {
    const head = "type P = { n: number }\nconst f = <T,>(x: T): T => x\n";
    const r = compile([
      { path: "T.tsx", source: `${head}export default function T(props: P) { return <p>{f(props.n)}</p> }` },
    ]);
    expect(r.outputs[0]?.code).toContain(head);
  });

  it("drops literal javascript: URLs from the template and still reports E1003", () => {
    const r = compile([
      { path: "T.tsx", source: `export default function T() { return <a href="javascript:alert(1)">x</a> }` },
    ]);
    expect(r.diagnostics.map((d) => d.code)).toEqual(["E1003"]);
    expect(r.outputs[0]?.code).not.toContain("javascript:");
    expect(r.outputs[0]?.code).toContain("about:blank");
  });

  it("reports E1501 for a literal string path in a URL attribute", () => {
    const r = compile([{ path: "T.tsx", source: `export default function T() { return <a href="/orders">x</a> }` }]);
    expect(r.diagnostics.map((d) => d.code)).toEqual(["E1501"]);
  });

  it("records a11y roles and name sources", () => {
    const r = compile([
      {
        path: "F.tsx",
        source: `export default function F() { return <form><label for="F.email">Email</label><input id="F.email" type="email"/><img src="https://x/y.png" alt="logo"/><button aria-label="close"/></form> }`,
      },
    ]);
    const a = r.artifacts["a11y.json"];
    expect(a["F.email"]).toEqual({ name: "label", role: "textbox", tag: "input" });
    expect(a["F.3"]).toEqual({ name: "alt", role: "img", tag: "img" });
    expect(a["F.4"]).toEqual({ name: "aria", role: "button", tag: "button" });
    expect(a["F.0"]).toEqual({ name: "none", role: "form", tag: "form" });
  });

  it("records deps edges from signals and props to the bindings that read them", () => {
    const r = compile([
      {
        path: "D.tsx",
        source: `import { signal, computed } from '@keel/reactive'\nconst a = signal(1)\nconst b = computed(() => a.get() * 2)\nexport default function D(props) { return <p title={props.t}>{b.get()}</p> }`,
      },
    ]);
    const edges = r.artifacts["deps.json"].edges;
    expect(edges).toContainEqual({ from: "D.tsx#a", to: "D.tsx#b" });
    expect(edges).toContainEqual({ from: "D.tsx#b", to: "D.0:text:#text" });
    expect(edges).toContainEqual({ from: "D.tsx#props.t", to: "D.0:attr:title" });
  });
});
