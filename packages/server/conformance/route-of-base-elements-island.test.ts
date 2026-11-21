// @vitest-environment happy-dom
// Spec: k.ui, clause "A route whose component returns only base elements, one with an event prop, is an island: its document loads the resume entry, and resume adopts its server nodes without E1253 when children are thunks; a route of base elements with no event prop, `field` or signal has no `data-k`."
// Examples only (no generated space here); packages/server/test/island-ui-root.property.test.ts has the property.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { resume } from "@keel/runtime-dom/ops";
import { createApp, topology } from "@keel/server";
import { Box, Button, Input, Text } from "@keel/ui";
import { afterEach, describe, expect, it } from "vitest";

const ctx = createCtx({ mode: "sim", seed: 1 });
const MODULE_SCRIPT = /<script[^>]*type=["']module["']/;

async function appFor(id: string, component: () => Node) {
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(contract("app", { [id]: { path: "/x" } }), { [id]: { component } }),
    ctx,
    mode: "production",
  });
}

async function html(app: { fetch(req: Request): Promise<Response> }): Promise<string> {
  const res = await app.fetch(new Request("http://localhost/x", { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return res.text();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("k.ui: route of base elements is an island", () => {
  const seen: string[] = [];
  const input = (): Node =>
    Input({
      label: "Title",
      onInput: (v: unknown) => {
        seen.push(String(v));
      },
    });
  const island = (): Node => Box({ children: () => input() });
  const eager = (): Node => Box({ children: input() });

  it("a route whose component returns only base elements, one with an event prop, is an island: its document loads the resume entry", async () => {
    for (const component of [island, eager]) {
      const doc = await html(await appFor("app.form", component));
      expect(doc).toMatch(/data-k-island=["']app\.form["']/);
      expect(doc).toMatch(/\sdata-k=/);
      expect(doc).toMatch(MODULE_SCRIPT);
    }
  });

  it("resume adopts its server nodes without E1253, keeping the elements and reaching the handler", async () => {
    const doc = await html(await appFor("app.form", island));
    const parsed = new DOMParser().parseFromString(doc, "text/html");
    for (const sc of parsed.body.querySelectorAll("script[type=module]")) sc.remove();
    document.body.innerHTML = parsed.body.innerHTML;
    const input = document.body.querySelector("input");
    const wrapper = document.body.querySelector("[data-k-island]");
    if (!(input instanceof HTMLInputElement)) throw new Error("fixture: no server input");
    if (!(wrapper instanceof Element)) throw new Error("fixture: no island element");
    const result = resume(document.body, { "app.form": island }, { ctx });
    expect(result.warnings.filter((w) => /E1253/.test(w))).toEqual([]);
    expect(document.body.contains(input)).toBe(true);
    expect(document.body.contains(wrapper)).toBe(true);
    expect(document.body.querySelector("input")).toBe(input);
    seen.length = 0;
    input.value = "x";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(seen).toContain("x");
  });

  it("a route of base elements with no event prop, `field` or signal has no `data-k`", async () => {
    const stat = (): Node => Box({ children: [Text({ children: "hi" }), Button({ children: "Go" })] });
    const doc = await html(await appFor("app.page", stat));
    expect(doc).toContain("hi");
    expect(doc).not.toMatch(/\sdata-k=/);
    expect(doc).not.toMatch(/data-k-island/);
    expect(doc).not.toMatch(MODULE_SCRIPT);
  });
});
