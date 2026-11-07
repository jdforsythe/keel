// @vitest-environment happy-dom
// Spec: k.runtime, clause "A `createApp` document with an island loads a module script whose URL answers 200 JavaScript that calls `resume`." (RFC 0046)
// Spec: k.runtime Islands: the generated resume entry imports `components` from `/@keel/islands.ts` and calls `resume(document.body, components, { ctx, stores })`.
// Spec: k.server Topology: `node` serves the resume entry.
// Seed: 1337 (fc.assert seed below). Real compiled TSX (compile + evaluate), in-process createApp, no listening server.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

type Component = (props: RouteProps) => Node;
type Fetcher = { fetch(req: Request): Promise<Response> };

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
  return <section aria-label="Static"><h1>Hello</h1><p>{props.data.title}</p></section>
}
`;
const COUNTER = `import { signal } from "@keel/reactive";
export default function Counter() {
  const n = signal(0);
  return <div><button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="c.out">{n.get()}</span></div>
}
`;

const Page = s.object({ title: s.string() });
const pageLoader = loader({ output: Page }, () => Promise.resolve(ok({ title: "T" })));
const ctx = createCtx({ mode: "sim", seed: 1337 });

async function appFor(mode: "production" | "dev", modules: string[]): Promise<Fetcher> {
  const entries: Record<string, { path: string; component: Component; loader?: typeof pageLoader }> = {
    "static.page": { path: "/static", component: compileComponent("Static", STATIC), loader: pageLoader },
  };
  for (const m of modules) {
    entries[`${m}.page`] = { path: `/${m}`, component: compileComponent("Counter", COUNTER) };
  }
  return createApp({
    topology: topology({ web: { modules: ["static", ...modules], adapter: "node" } }),
    routes: manifest(entries),
    ctx,
    mode,
  });
}

async function moduleSrc(app: Fetcher, p: string): Promise<string> {
  const res = await app.fetch(new Request(`http://localhost${p}`));
  expect(res.status).toBe(200);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const scripts = doc.querySelectorAll('script[type="module"]');
  expect(scripts).toHaveLength(1);
  const src = scripts[0]?.getAttribute("src");
  if (src === null || src === undefined) throw new Error("module script has no src");
  return src;
}

async function expectResumeEntry(app: Fetcher, src: string): Promise<void> {
  const res = await app.fetch(new Request(new URL(src, "http://localhost")));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type") ?? "").toContain("javascript");
  const body = await res.text();
  expect(body).toContain("resume(");
  expect(body).toMatch(/import\s*\{[^}]*\bresume\b[^}]*\}\s*from\s*["']@keel\/runtime-dom\/ops["']/);
  expect(body).toContain("/@keel/islands.ts");
}

describe("k.runtime: resume entry served by createApp", () => {
  it("a createApp document with an island loads a module script whose URL answers 200 JavaScript that calls resume", async () => {
    const app = await appFor("production", ["counter"]);
    await expectResumeEntry(app, await moduleSrc(app, "/counter"));
  });

  it("HEAD of the module script URL answers 200 with an empty body", async () => {
    const app = await appFor("production", ["counter"]);
    const src = await moduleSrc(app, "/counter");
    const res = await app.fetch(new Request(new URL(src, "http://localhost"), { method: "HEAD" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("in dev mode the module script URL answers 200 JavaScript that calls resume", async () => {
    const app = await appFor("dev", ["counter"]);
    await expectResumeEntry(app, await moduleSrc(app, "/counter"));
  });

  it("a page with no island has no module script", async () => {
    const app = await appFor("production", ["counter"]);
    const doc = await (await app.fetch(new Request("http://localhost/static"))).text();
    expect(doc).not.toMatch(/<script[^>]*type=["']module["']/);
  });

  it("property: for any set of node deployable modules, every island document's module script answers 200 JavaScript calling resume", async () => {
    const names = fc.uniqueArray(fc.constantFrom("alpha", "beta", "gamma", "delta", "omega"), {
      minLength: 1,
      maxLength: 4,
    });
    // seed 1337
    await fc.assert(
      fc.asyncProperty(names, async (modules) => {
        const app = await appFor("production", modules);
        for (const m of modules) {
          await expectResumeEntry(app, await moduleSrc(app, `/${m}`));
        }
      }),
      { seed: 1337, numRuns: 5 },
    );
  }, 120_000);
});
