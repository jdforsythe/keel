// @vitest-environment node
// Backlog 0182 (rfc:0067): a route component built only from @keel/ui base elements is an island when one of them is
// bound (an event prop, a `field`, a signal or computed). Served by createApp under plain node (the DOM-free server
// tree), its root gets `data-k-island` and the document loads the resume entry; a static one ships no runtime JS.
import { createCtx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { Box, Button, Input, Text } from "@keel/ui";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const c = contract("app", { "app.form": { path: "/" } });
const ENTRY = '<script type="module" src="/@keel/entry.ts" nonce="';

async function page(component: () => Node): Promise<string> {
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(c, { "app.form": { component } }),
    ctx: createCtx({ mode: "sim", seed: 1 }),
  });
  const res = await app.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return res.text();
}

describe("a route of base elements is an island when one is bound (backlog 0182)", () => {
  it("the 0182 repro: Box({ children: Input({ onInput }) }) has data-k, data-k-island on its root and the entry", async () => {
    expect(typeof document).toBe("undefined");
    const html = await page(() => Box({ children: Input({ label: "Title", onInput: () => undefined }) }));
    expect(html).toContain('<div data-k-island="app.form"><div><label for="');
    expect(html).toMatch(/<input type="text" id="[^"]+" class="k-control" data-k="">/);
    expect(html.split("data-k-island=").length).toBe(2);
    expect(html).toContain(ENTRY);
  });

  it("a signal value, a computed disabled, a signal child or a signal style prop is bound like an event prop", async () => {
    const cases: (() => Node)[] = [
      () => Box({ children: () => Input({ label: "Title", value: signal("a") }) }),
      () => Box({ children: () => Button({ disabled: signal(false), children: "Go" }) }),
      () => Box({ children: () => Text({ children: signal("a") }) }),
      () => Box({ p: signal<"1" | "2">("1"), children: "x" }),
    ];
    for (const c of cases) {
      const html = await page(c);
      expect(html).toContain('data-k=""');
      expect(html).toContain('data-k-island="app.form"');
      expect(html).toContain(ENTRY);
    }
  });

  it("base elements with no event prop, field or signal stay static HTML: no data-k, no island, no entry", async () => {
    const html = await page(() =>
      Box({ p: "1", children: () => [Text({ children: "hi" }), Button({ children: "Go" }), Input({ label: "T" })] }),
    );
    expect(html).toContain("hi");
    expect(html).not.toContain("data-k");
    expect(html).not.toContain('type="module"');
  });
});
