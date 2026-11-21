// @vitest-environment node
// Backlog 0182 (rfc:0067), property seed 1337: over random route chains (an optional layout and a page) whose trees mix
// @keel/ui base elements and compiled JSX elements, as JSX source or as direct calls, every level with a bound element
// (an event prop, a signal or computed, a JSX read of a signal) gets `data-k-island` exactly once, and a static level
// gets none. The document loads the resume entry iff some level is an island. Plain node: the DOM-free server tree.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import * as reactive from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import * as ui from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { installServerDom } from "../src/internal/dom/installServerDom.ts";

const SEED = 1337;

type Tree =
  | { readonly k: "input"; readonly on: boolean; readonly sig: boolean }
  | { readonly k: "button"; readonly on: boolean; readonly sig: boolean }
  | { readonly k: "text"; readonly sig: boolean }
  | { readonly k: "p"; readonly sig: boolean }
  | { readonly k: "box"; readonly sig: boolean; readonly kids: readonly Tree[] }
  | { readonly k: "section"; readonly kids: readonly Tree[] };

const { tree } = fc.letrec<{ tree: Tree }>((t) => ({
  tree: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.record({ k: fc.constant("input" as const), on: fc.boolean(), sig: fc.boolean() }),
    fc.record({ k: fc.constant("button" as const), on: fc.boolean(), sig: fc.boolean() }),
    fc.record({ k: fc.constant("text" as const), sig: fc.boolean() }),
    fc.record({ k: fc.constant("p" as const), sig: fc.boolean() }),
    fc.record({ k: fc.constant("box" as const), sig: fc.boolean(), kids: fc.array(t("tree"), { maxLength: 3 }) }),
    fc.record({ k: fc.constant("section" as const), kids: fc.array(t("tree"), { maxLength: 3 }) }),
  ),
}));

/** True when some element of `t` is bound. */
const bound = (t: Tree): boolean => {
  if (t.k === "box") return t.sig || t.kids.some((c) => bound(c));
  if (t.k === "section") return t.kids.some((c) => bound(c));
  if (t.k === "input" || t.k === "button") return t.on || t.sig;
  return t.sig;
};

/** Only base elements (no `p` or `section`), so the tree can also be built by direct calls. */
const uiOnly = (t: Tree): boolean => (t.k === "box" ? t.kids.every(uiOnly) : t.k !== "p" && t.k !== "section");

const jsxOf = (t: Tree): string => {
  const kids = (ks: readonly Tree[]): string => ks.map(jsxOf).join("");
  switch (t.k) {
    case "input":
      return `<Input label="L"${t.on ? " onInput={() => undefined}" : ""}${t.sig ? " value={sv}" : ""} />`;
    case "button":
      return `<Button${t.on ? " onClick={() => undefined}" : ""}${t.sig ? " disabled={sd}" : ""}>B</Button>`;
    case "text":
      return t.sig ? "<Text children={sv} />" : "<Text>t</Text>";
    case "p":
      return `<p>${t.sig ? "{sv.get()}" : "x"}</p>`;
    case "box":
      return `<Box p={${t.sig ? "sp" : '"1"'}}>${kids(t.kids)}</Box>`;
    case "section":
      return `<section>${kids(t.kids)}</section>`;
  }
};

type Component = (props: Readonly<Record<string, unknown>>) => Node;

const asNode = (n: unknown): Node => {
  if (!(n instanceof Node)) throw new Error("fixture: the component returned no Node");
  return n;
};

/** Compile `t` as a TSX component rooted at `t`; a layout wraps it and its `children` slot in a `<section>`. */
const compiled = (t: Tree, layout: boolean): Component => {
  const slot = layout ? "{p.children()}" : "";
  const source = `import { signal } from "@keel/reactive";
import { Box, Button, Input, Text } from "@keel/ui";
export default function C(p: { children: () => Node }) {
  const sv = signal("v"); const sd = signal(false); const sp = signal("1");
  return ${layout ? `<section>${jsxOf(t)}${slot}</section>` : jsxOf(t)};
}`;
  const r = compile([{ path: "C.tsx", source }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "", { "@keel/reactive": reactive, "@keel/ui": ui });
  if (typeof fn !== "function") throw new Error("fixture: no default export");
  return (props) => asNode(Reflect.apply(fn, undefined, [props]));
};

/** Build `t` (base elements only) by direct calls with thunk children. */
const called = (t: Tree): Node => {
  switch (t.k) {
    case "input":
      return ui.Input({
        label: "L",
        ...(t.on ? { onInput: () => undefined } : {}),
        ...(t.sig ? { value: reactive.signal("v") } : {}),
      });
    case "button":
      return ui.Button({
        children: "B",
        ...(t.on ? { onClick: () => undefined } : {}),
        ...(t.sig ? { disabled: reactive.signal(false) } : {}),
      });
    case "text":
      return ui.Text({ children: t.sig ? reactive.signal("v") : "t" });
    case "box":
      return ui.Box({ p: t.sig ? reactive.signal<"1">("1") : "1", children: () => t.kids.map(called) });
    default:
      throw new Error("fixture: not a base element");
  }
};

/** A direct-call component; a layout appends its `children` slot after the tree. */
const direct =
  (t: Tree, layout: boolean): Component =>
  (props) =>
    ui.Box({
      children: () => {
        const kids: Node[] = [called(t)];
        const slot = props.children;
        if (layout && typeof slot === "function") kids.push(asNode(slot()));
        return kids;
      },
    });

type Level = { readonly tree: Tree; readonly calls: boolean };
const level = tree.chain((t) =>
  uiOnly(t) ? fc.record({ tree: fc.constant(t), calls: fc.boolean() }) : fc.constant({ tree: t, calls: false }),
);

const pageOnly = contract("app", { "app.page": { path: "/" } });
const withShell = contract("app", { "app.shell": { layout: true }, "app.page": { path: "/" } });

const count = (html: string, id: string): number => html.split(`data-k-island="${id}"`).length - 1;

describe("ui and JSX route roots are marked exactly when bound (backlog 0182)", () => {
  it("property (seed 1337): each bound level has one data-k-island, a static level none, the entry iff any", async () => {
    // Compiled modules hoist their templates at evaluation, before createApp would install the server tree.
    installServerDom();
    await fc.assert(
      fc.asyncProperty(fc.option(level, { nil: undefined }), level, async (shell, pageLevel) => {
        const make = (l: Level, layout: boolean): Component =>
          l.calls ? direct(l.tree, layout) : compiled(l.tree, layout);
        const page = make(pageLevel, false);
        const routes =
          shell === undefined
            ? manifest(pageOnly, { "app.page": { component: page } })
            : manifest(withShell, {
                "app.shell": { component: make(shell, true) },
                "app.page": { component: page, layout: "app.shell" },
              });
        const app = await createApp({
          topology: topology({ web: { modules: ["app"], adapter: "node" } }),
          routes,
          ctx: createCtx({ mode: "sim", seed: 1 }),
        });
        const res = await app.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }));
        expect(res.status).toBe(200);
        const html = await res.text();
        const pageBound = bound(pageLevel.tree);
        const shellBound = shell !== undefined && bound(shell.tree);
        expect(count(html, "app.page")).toBe(pageBound ? 1 : 0);
        expect(count(html, "app.shell")).toBe(shellBound ? 1 : 0);
        expect(html.includes('<script type="module"')).toBe(pageBound || shellBound);
        expect(html.includes("data-k=")).toBe(pageBound || shellBound);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
