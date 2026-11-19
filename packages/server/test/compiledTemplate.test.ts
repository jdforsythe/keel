// @vitest-environment node
// Compiled templates on the server DOM (backlog 0156, k.server node adapter): a template with a bound non-root
// element finds it with `root.querySelector('[id="…"]')`, so the server DOM must answer that selector, or every
// such page 500s under plain node. Runs with no DOM global: the server tree is the only DOM.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { err, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { installServerDom } from "../src/internal/dom/installServerDom.ts";
import { renderUnit } from "../src/internal/renderUnit.ts";

const compiled = (source: string): ((props: Record<string, unknown>) => unknown) => {
  const r = compile([{ path: "a.tsx", source }]);
  const code = r.outputs[0]?.code ?? "";
  const fn = evaluate(code);
  if (typeof fn !== "function") throw new Error(`no default export: ${JSON.stringify(r.diagnostics)}`);
  return (props) => Reflect.apply(fn, undefined, [props]);
};

const outer = (n: unknown): string => {
  const html = typeof n === "object" && n !== null ? Reflect.get(n, "outerHTML") : undefined;
  return typeof html === "string" ? html : "";
};

describe("compiled templates render on the server DOM", () => {
  it("backlog 0156 repro: a bound span under a div renders (querySelector on the cloned root)", () => {
    expect(typeof document).toBe("undefined");
    installServerDom();
    const A = compiled("export default function A(p:{x:string}){return <div><span>{p.x}</span></div>;}");
    expect(outer(renderUnit(() => A({ x: "a<" })))).toBe('<div id="a.0"><span id="a.1">a&lt;</span></div>');
  });

  it("binds text, attributes, a user id, a conditional, a list and a handler below the root", () => {
    installServerDom();
    const A = compiled(`import { For, If } from "@keel/runtime-dom";
    export default function A(p:{x:string; items: {t: string}[]; on: boolean}){
      return <div class="a"><span>{p.x}</span><p id="q" title={p.x}>hi {p.x} there</p><If when={p.on} fallback={() => <i>no</i>}>{() => <b>yes</b>}</If><ul><For each={p.items} key="t">{(i) => <li>{i.t}</li>}</For></ul><button onClick={() => undefined}>b</button></div>;
    }`);
    const html = outer(renderUnit(() => A({ x: "v", items: [{ t: "1" }, { t: "2" }], on: true })));
    expect(html).toContain('<span id="a.1">v</span>');
    expect(html).toContain('title="v"');
    expect(html).toContain("hi <!---->v<!----> there");
    expect(html).toMatch(/<b[^>]*>yes<\/b>/);
    expect(html).toContain(">1</li>");
    expect(html).toContain(">2</li>");
    expect(html).toContain('data-k="a.');
  });

  it("backlog 0167 repro: cloned controls keep their class, so a bound button value and a select value work", () => {
    installServerDom();
    const A = compiled(
      'export default function A(p:{v:string}){return <form><button name="op" value={p.v}>Go</button><select value={p.v}><option value="a">A</option><option value="delete">D</option></select></form>;}',
    );
    const form = renderUnit(() => A({ v: "delete" }));
    expect(outer(form)).toContain('<button id="a.1" name="op" value="delete">Go</button>');
    const select = typeof form === "object" && form !== null ? Reflect.get(form, "lastChild") : null;
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(Reflect.get(select, "value")).toBe("delete");
  });

  it("a compiled errorElement renders in a render unit: a loader's keel.notFound is a 404 page, not a 500", async () => {
    const Missing = compiled(
      "export default function M(p:{error:{message:string}}){return <section><p>{p.error.message}</p></section>;}",
    );
    const Params = s.object({ id: s.string() });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: manifest({
        "app.item": {
          path: "/items/:id",
          params: Params,
          loader: loader({ output: s.string(), params: Params }, async ({ params }) =>
            err({ code: "keel.notFound", message: `No item ${params.id}`, data: null }),
          ),
          component: () => document.createElement("i"),
          errorElement: (props) => {
            const n = Missing(props);
            if (!(n instanceof Node)) throw new Error("errorElement returned no node");
            return n;
          },
        },
      }),
      ctx: createCtx({ mode: "sim", seed: 1 }),
    });
    const res = await app.fetch(new Request("http://localhost/items/7", { headers: { accept: "text/html" } }));
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('<section id="a.0"><p id="a.1">No item 7</p></section>');
  });
});
