// Spec: k.security, Conformance "No document of the fixture app has an inline script other than `#k-state`, a `<style>`, a `style` attribute or an `on*` attribute."
// Seed: 1337.
// @vitest-environment happy-dom
import type { Ctx } from "@keel/ctx";
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import type { RouteProps } from "@keel/router";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { build, get } from "./fixtures.ts";

const MODES: ("dev" | "production")[] = ["dev", "production"];
type Component = (props: RouteProps, ctx: Ctx) => Node;

const COUNTER = `import { signal } from "@keel/reactive";
export default function Counter() {
  const n = signal(0);
  return <div><button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="c.out">{n.get()}</span></div>
}
`;

function compileComponent(source: string): Component {
  const r = compile([{ path: "Counter.tsx", source }]);
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

/** Every way a document can run or style itself without a file: inline script, `<style>`, `style=`, `on*=`. */
function inlineSources(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found: string[] = [];
  for (const el of doc.querySelectorAll("script")) {
    if (!el.hasAttribute("src") && el.id !== "k-state") found.push("inline <script>");
    if (el.id === "k-state" && el.getAttribute("type") !== "application/json") found.push("#k-state not json");
  }
  if (doc.querySelector("style") !== null) found.push("<style>");
  for (const el of doc.querySelectorAll("*")) {
    for (const name of el.getAttributeNames()) {
      const n = name.toLowerCase();
      if (n === "style") found.push("style attribute");
      if (n.startsWith("on")) found.push(`${n} attribute`);
    }
  }
  return found;
}

async function island(mode: "dev" | "production") {
  const appContract = contract("app", {
    "app.counter": { path: "/counter" },
    "app.plain": { path: "/plain" },
  });

  const routes = manifest(appContract, {
    "app.counter": { component: compileComponent(COUNTER) },
    "app.plain": { component: () => document.createElement("main") },
  });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode,
  });
}

describe("k.security: no inline script, style or handler", () => {
  test("No document of the fixture app has an inline script other than `#k-state`, a `<style>`, a `style` attribute or an `on*` attribute", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...MODES), fc.constantFrom("open", "closed"), async (mode, kind) => {
        const { app } = await build({}, mode);
        for (const p of [`/orders/${kind}`, "/login"]) {
          const res = await app.fetch(get(p));
          expect(res.status).toBe(200);
          expect(inlineSources(await res.text())).toEqual([]);
        }
        const isl = await island(mode);
        for (const p of ["/counter", "/plain"]) {
          const res = await isl.fetch(get(p));
          expect(res.status).toBe(200);
          expect(inlineSources(await res.text())).toEqual([]);
        }
      }),
      { seed: 1337, numRuns: 4 },
    );
  });
});
