// @vitest-environment happy-dom
// Spec: k.host-element, Conformance "A server document with a `Host` holds `<div data-k-host data-k=... role="img" aria-label=...>` with no children; its island loads the resume entry."
// Spec: k.host-element, Lifecycle "Client only. The server writes the element with its attributes and no children."
// Seed: 1337. Same app shape as route-of-base-elements-island.test.ts; the element's `code` is never called on the server.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { Box, Host } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const ctx = createCtx({ mode: "sim", seed: 1337 });
const MODULE_SCRIPT = /<script[^>]*type=["']module["']/;
const Input = s.object({ points: s.array(s.number()) });

const documentOf = async (label: string): Promise<string> => {
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({
      "app.chart": {
        path: "/chart",
        component: () =>
          Box({
            children: () =>
              Host({
                id: "app.chart.host",
                role: "img",
                label,
                input: Input,
                value: { points: [1, 2, 3] },
                code: () => Promise.reject(new Error("the server never loads host element code")),
              }),
          }),
      },
    }),
    ctx,
    mode: "production",
  });
  const res = await app.fetch(new Request("http://localhost/chart", { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  return res.text();
};

const hostNode = (html: string): Element => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const node = parsed.body.querySelector("[data-k-host]");
  if (node === null) throw new Error("fixture: no host element in the document");
  return node;
};

describe("k.host-element: server document", () => {
  it('a server document with a `Host` holds `<div data-k-host data-k=... role="img" aria-label=...>` with no children', async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z]{1,10}$/), async (label) => {
        const node = hostNode(await documentOf(label));
        expect(node.tagName).toBe("DIV");
        expect(node.hasAttribute("data-k")).toBe(true);
        expect(node.getAttribute("role")).toBe("img");
        expect(node.getAttribute("aria-label")).toBe(label);
        expect(node.childNodes).toHaveLength(0);
      }),
      { seed: 1337, numRuns: 5 },
    );
  });

  it("its island loads the resume entry", async () => {
    const doc = await documentOf("Chart");
    expect(doc).toMatch(/data-k-island=["']app\.chart["']/);
    expect(doc).toMatch(MODULE_SCRIPT);
  });
});
