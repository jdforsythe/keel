// @vitest-environment happy-dom
// Spec: k.runtime, clause "A page with no islands loads no runtime JS: its document has no `<script type=\"module\">`, `data-k`, or `data-k-island`; a page with an event handler has all three, and `resume` attaches the handler to server nodes."
// k.server, "Document" (route levels are the island roots, keyed by route id; RFC 0037).
// Seed: 1337 (fc.assert seed below). Real compiled TSX (compile + evaluate), real createApp, real resume.
import { fixedTime } from "@keel/tooling/test-time";
import type { Ctx } from "@keel/ctx";
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
import { resume } from "@keel/runtime-dom/ops";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

type Component = (props: RouteProps, ctx: Ctx) => Node;

function compileComponent(name: string, source: string): Component {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props, ctx) => {
    const node: unknown = fn(props, ctx);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

const STATIC = `export default function Static(props) {
  return <section aria-label="Static"><h1>Hello</h1><p>{props.data.title}</p></section>
}
`;
const COUNTER = `import { signal } from "@keel/reactive";
export default function Counter() {
  const n = signal(0);
  return <div><button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="c.out">{n.get()}</span></div>
}
`;
const SHELL = `export default function Shell(props) {
  return <div id="shell">{props.children?.()}</div>
}
`;

const Page = s.object({ title: s.string() });
const ctx = createCtx({ mode: "sim", seed: 1337 });
const MODULES = ["static", "counter", "nested", "plain"];

async function appFor(generated?: Component) {
  const staticC = contract("static", { "static.page": { path: "/static" } });
  const counterC = contract("counter", { "counter.page": { path: "/counter" } });
  const nestedC = contract("nested", { "nested.layout": { layout: true }, "nested.page": { path: "/nested" } });
  const plainC = contract("plain", { "plain.layout": { layout: true }, "plain.page": { path: "/plain" } });
  const genC = contract("gen", { "gen.page": { path: "/gen" } });
  const tables = [
    manifest(staticC, {
      "static.page": {
        component: compileComponent("Static", STATIC),
        loader: loader(staticC, "static.page", { output: Page }, () => Promise.resolve(ok({ title: "T" }))),
      },
    }),
    manifest(counterC, { "counter.page": { component: compileComponent("Counter", COUNTER) } }),
    manifest(nestedC, {
      "nested.layout": { component: compileComponent("Shell", SHELL) },
      "nested.page": { component: compileComponent("Counter", COUNTER), layout: "nested.layout" },
    }),
    manifest(plainC, {
      "plain.layout": { component: compileComponent("Shell", SHELL) },
      "plain.page": {
        component: compileComponent("Static", STATIC),
        layout: "plain.layout",
        loader: loader(plainC, "plain.page", { output: Page }, () => Promise.resolve(ok({ title: "T" }))),
      },
    }),
    ...(generated === undefined
      ? []
      : [
          manifest(genC, {
            "gen.page": {
              component: generated,
              loader: loader(genC, "gen.page", { output: Page }, () => Promise.resolve(ok({ title: "T" }))),
            },
          }),
        ]),
  ];
  const routes = routeTable(...tables);
  return createApp({
    topology: topology({ web: { modules: generated === undefined ? MODULES : [...MODULES, "gen"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
}

async function html(app: { fetch(req: Request): Promise<Response> }, p: string): Promise<string> {
  const res = await app.fetch(new Request(`http://localhost${p}`));
  expect(res.status).toBe(200);
  return res.text();
}

// `data-keel-*` attributes must not match: markers are `data-k=` and `data-k-island`.
const MODULE_SCRIPT = /<script[^>]*type=["']module["']/;
const DATA_K = /\sdata-k=/;
const DATA_K_ISLAND = /data-k-island/;

describe("k.runtime: document islands (k.server documents)", () => {
  it("k.runtime: A page with no islands loads no runtime JS.", async () => {
    const app = await appFor();
    for (const p of ["/static", "/plain"]) {
      const doc = await html(app, p);
      expect(doc).not.toMatch(MODULE_SCRIPT);
      expect(doc).not.toContain("/@keel/entry.ts");
    }
  });

  it('a page with no islands: its document has no <script type="module">, data-k, or data-k-island', async () => {
    const app = await appFor();
    for (const p of ["/static", "/plain"]) {
      const doc = await html(app, p);
      expect(doc).toContain("Hello");
      expect(doc).not.toMatch(MODULE_SCRIPT);
      expect(doc).not.toMatch(DATA_K);
      expect(doc).not.toMatch(DATA_K_ISLAND);
    }
  });

  it("a page with an event handler has all three: data-k-island on the level, data-k on the handler element, the module script", async () => {
    const app = await appFor();
    const doc = await html(app, "/counter");
    expect(doc.match(/<script[^>]*type=["']module["'][^>]*>/g)).toHaveLength(1);
    expect(doc).toMatch(
      /<script[^>]*type=["']module["'][^>]*src=["']\/@keel\/entry\.ts["']|<script[^>]*src=["']\/@keel\/entry\.ts["'][^>]*type=["']module["']/,
    );
    expect(doc).toMatch(/data-k-island=["']counter\.page["']/);
    const body = new DOMParser().parseFromString(doc, "text/html");
    expect(body.querySelectorAll("[data-k-island]")).toHaveLength(1);
    expect(body.querySelector("button")?.getAttribute("data-k")).toBe("c.inc");
    expect(body.querySelector("span")?.hasAttribute("data-k")).toBe(true);
  });

  it("only the island level is marked: a static layout around an island child carries no data-k-island of its own", async () => {
    const app = await appFor();
    const doc = new DOMParser().parseFromString(await html(app, "/nested"), "text/html");
    const marked = [...doc.querySelectorAll("[data-k-island]")];
    expect(marked.map((e) => e.getAttribute("data-k-island"))).toEqual(["nested.page"]);
    expect(doc.querySelector("#shell")?.hasAttribute("data-k-island")).toBe(false);
    expect(doc.querySelector("#shell")?.hasAttribute("data-k")).toBe(false);
    expect(doc.querySelectorAll('script[type="module"]')).toHaveLength(1);
  });

  it("resume attaches the handler to the server nodes", async () => {
    const app = await appFor();
    const doc = new DOMParser().parseFromString(await html(app, "/counter"), "text/html");
    document.body.innerHTML = doc.body.innerHTML;
    const button = document.querySelector("button");
    const span = document.querySelector("span");
    if (button === null || span === null) throw new Error("server document lacks the counter nodes");
    expect(span.textContent).toBe("0");

    const { warnings } = resume(
      document.body,
      { "counter.page": compileComponent("Counter", COUNTER) },
      { ctx: simCtx },
    );
    expect(warnings).toEqual([]);

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    for (let i = 0; i < 4; i++) await Promise.resolve();
    expect(document.querySelector("span")).toBe(span);
    expect(document.querySelector("button")).toBe(button);
    expect(span.textContent).toBe("1");
  });

  it(
    "property: static trees carry no module script and no markers; the same trees plus one onClick carry both",
    async () => {
      type Tree = { tag: string; kids: (string | Tree)[] };
      const leaf = fc.constantFrom("text", "{props.data.title}");
      const tree: fc.Arbitrary<Tree> = fc.letrec<{ tree: Tree }>((tie) => ({
        tree: fc.record({
          tag: fc.constantFrom("section", "div", "p", "span"),
          kids: fc.array(fc.oneof({ depthSize: "small" }, leaf, tie("tree")), { minLength: 1, maxLength: 3 }),
        }),
      })).tree;
      const render = (t: Tree): string =>
        `<${t.tag}>${t.kids.map((k) => (typeof k === "string" ? k : render(k))).join("")}</${t.tag}>`;
      const source = (jsx: string): string => `export default function Gen(props) { return ${jsx} }\n`;
      // seed 1337
      await fc.assert(
        fc.asyncProperty(tree, async (t) => {
          const plain = render(t);
          const staticApp = await appFor(compileComponent("Gen", source(plain)));
          const sdoc = await html(staticApp, "/gen");
          expect(sdoc).not.toMatch(MODULE_SCRIPT);
          expect(sdoc).not.toMatch(DATA_K);
          expect(sdoc).not.toMatch(DATA_K_ISLAND);

          const withHandler = `<div>${plain}<button id="g.btn" onClick={() => {}}>go</button></div>`;
          const islandApp = await appFor(compileComponent("Gen", source(withHandler)));
          const idoc = await html(islandApp, "/gen");
          expect(idoc.match(/<script[^>]*type=["']module["']/g)).toHaveLength(1);
          expect(idoc).toMatch(/data-k-island=["']gen\.page["']/);
          expect(idoc).toMatch(/\sdata-k=["']g\.btn["']/);
        }),
        { seed: 1337, numRuns: 8 },
      );
    },
    fixedTime(120_000),
  );
});
