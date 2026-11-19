// @vitest-environment happy-dom
// Spec: std.messages, clause "A node document holds a static level's message text and no `#k-state` entry for it; an island level's `#k-state` holds the served locale's entry and no other locale's text."
// Seed 1337 (no random inputs: the two locales are exhaustive). Real compiled TSX, real createApp, as packages/server/conformance/document-islands.test.ts.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { expect, test } from "vitest";
import { AppLocale } from "./fixtures/AppLocale.schema.ts";

type Component = (props: RouteProps) => Node;

function compileComponent(name: string, source: string): Component {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props) => {
    const node: unknown = fn(props);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

const STATIC = `export default function Static(props) {
  return <section aria-label="Static"><h1>{props.data.text.title}</h1></section>
}
`;
const ISLAND = `export default function Island(props) {
  return <section aria-label="Island"><h1>{props.data.text.title}</h1><button id="i.go" onClick={() => undefined}>go</button></section>
}
`;

async function page(path: string): Promise<{ html: string; state: string }> {
  const { Demo } = await import("./fixtures/Demo.schema.ts");
  const Params = s.object({ locale: AppLocale });
  const textLoader = loader({ output: s.object({ text: Demo }), params: Params }, async ({ params }) =>
    ok({ text: await Demo.load(params.locale) }),
  );
  const app = await createApp({
    topology: topology({ web: { modules: ["static", "island"], adapter: "node" } }),
    routes: manifest({
      "static.page": {
        path: "/:locale/static",
        params: Params,
        component: compileComponent("Static", STATIC),
        loader: textLoader,
      },
      "island.page": {
        path: "/:locale/island",
        params: Params,
        component: compileComponent("Island", ISLAND),
        loader: textLoader,
      },
    }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  const html = await res.text();
  const state = new DOMParser().parseFromString(html, "text/html").getElementById("k-state")?.textContent ?? "";
  return { html, state };
}

test("A node document holds a static level's message text and no `#k-state` entry for it; an island level's `#k-state` holds the served locale's entry and no other locale's text.", async () => {
  for (const [served, other] of [
    ["de-DE", "en-US"],
    ["en-US", "de-DE"],
  ] as const) {
    const text = { "de-DE": "Rezepte", "en-US": "Recipes" } as const;
    const staticDoc = await page(`/${served}/static`);
    expect(staticDoc.html).toContain(text[served]);
    expect(staticDoc.state).not.toContain(text[served]);
    expect(staticDoc.state).not.toContain(text[other]);
    expect(staticDoc.html).not.toContain(text[other]);

    const islandDoc = await page(`/${served}/island`);
    expect(islandDoc.html).toContain(text[served]);
    expect(islandDoc.state).toContain(text[served]);
    expect(islandDoc.state).toContain(served === "de-DE" ? "# Rezept" : "# recipe");
    expect(islandDoc.state).not.toContain(text[other]);
    expect(islandDoc.state).not.toContain(served === "de-DE" ? "# recipe" : "# Rezept");
  }
});
