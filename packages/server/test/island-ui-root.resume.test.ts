// @vitest-environment happy-dom
// Backlog 0182 (rfc:0067): a route of base elements that createApp marked as an island resumes in place. Property seed
// 1337 over random trees of bound and static base elements with thunk children: resume reports no E1253 and every
// server element keeps its identity. An eager `Node` child is made before its parent, so it is E1253 (k.ui).
import { createCtx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { manifest } from "@keel/router";
import { resume } from "@keel/runtime-dom/ops";
import { Box, Button, Input, Text } from "@keel/ui";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const ctx = createCtx({ mode: "sim", seed: 1 });

type Tree =
  | { readonly k: "input"; readonly on: boolean; readonly sig: boolean }
  | { readonly k: "button"; readonly on: boolean; readonly sig: boolean }
  | { readonly k: "text"; readonly sig: boolean }
  | { readonly k: "box"; readonly sig: boolean; readonly kids: readonly Tree[] };

const { tree } = fc.letrec<{ tree: Tree }>((t) => ({
  tree: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.record({ k: fc.constant("input" as const), on: fc.boolean(), sig: fc.boolean() }),
    fc.record({ k: fc.constant("button" as const), on: fc.boolean(), sig: fc.boolean() }),
    fc.record({ k: fc.constant("text" as const), sig: fc.boolean() }),
    fc.record({ k: fc.constant("box" as const), sig: fc.boolean(), kids: fc.array(t("tree"), { maxLength: 3 }) }),
  ),
}));

const bound = (t: Tree): boolean =>
  t.k === "box" ? t.sig || t.kids.some(bound) : t.k === "text" ? t.sig : t.on || t.sig;

const build = (t: Tree): Node => {
  switch (t.k) {
    case "input":
      return Input({
        label: "L",
        ...(t.on ? { onInput: () => undefined } : {}),
        ...(t.sig ? { value: signal("v") } : {}),
      });
    case "button":
      return Button({
        children: "B",
        ...(t.on ? { onClick: () => undefined } : {}),
        ...(t.sig ? { disabled: signal(false) } : {}),
      });
    case "text":
      return Text({ children: t.sig ? signal("v") : "t" });
    case "box":
      return Box({ p: t.sig ? signal<"1">("1") : "1", children: () => t.kids.map(build) });
  }
};

/** Serve `component` at `/` through createApp and put the document's body (no module script) into this document. */
async function serve(component: () => Node): Promise<void> {
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({ "app.page": { path: "/", component } }),
    ctx,
  });
  const res = await app.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }));
  const body = /<body>([\s\S]*)<\/body>/.exec(await res.text())?.[1] ?? "";
  document.body.innerHTML = body.replace(/<script type="module"[^>]*><\/script>/, "");
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a route of base elements resumes in place (backlog 0182)", () => {
  it("property (seed 1337): a bound tree is one island that resumes with no E1253, keeping every server element", async () => {
    await fc.assert(
      fc.asyncProperty(tree, async (t) => {
        const component = (): Node => build(t);
        await serve(component);
        const islands = document.body.querySelectorAll("[data-k-island]");
        expect(islands.length).toBe(bound(t) ? 1 : 0);
        const before = [...document.body.querySelectorAll("main *")];
        const { warnings } = resume(document.body, { "app.page": component }, { ctx });
        expect(warnings).toEqual([]);
        expect([...document.body.querySelectorAll("main *")]).toEqual(before);
        for (const el of before) expect(el.isConnected).toBe(true);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("an input event typed into the resumed server input reaches onInput", async () => {
    const seen: string[] = [];
    const component = (): Node => Box({ children: () => Input({ label: "Title", onInput: (v) => seen.push(v) }) });
    await serve(component);
    const input = document.body.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("fixture: no server input");
    expect(resume(document.body, { "app.page": component }, { ctx }).warnings).toEqual([]);
    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(seen).toEqual(["x"]);
    expect(document.body.querySelector("input")).toBe(input);
  });

  it("an eager Node child is made before its parent: E1253, and the island re-renders on the client", async () => {
    const component = (): Node => Box({ children: Input({ label: "Title", onInput: () => undefined }) });
    await serve(component);
    const { warnings } = resume(document.body, { "app.page": component }, { ctx });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^E1253 \[data-k-island="app\.page"\]/);
    expect(document.body.querySelector("input")).toBeInstanceOf(HTMLInputElement);
  });
});
