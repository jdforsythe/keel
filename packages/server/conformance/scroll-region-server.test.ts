// @vitest-environment happy-dom
// Spec: k.ui, clause "`<Box scroll=\"x\" label=\"Prices\">` renders a `div` with `role=\"region\"`, `tabindex=\"0\"`, `aria-label=\"Prices\"` and class `k-scroll`, in server and client output, and has no axe violations holding a `table`; `labelledBy=\"t\"` writes `aria-labelledby=\"t\"` and no `aria-label`; a `Box` without `scroll` writes none of these."
// Seed 1337. The server-output half; the client half and axe are packages/ui/conformance/scroll-region.test.ts.
// Not built yet (rfc:0203): the cases fail until `Box` takes `scroll`; plain `test`, not skipped.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import { Box } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;

const serverEl = async (make: () => Node): Promise<Element | null> => {
  const appContract = contract("app", { "app.home": { path: "/" } });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.home": { component: make } }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "dev",
  });
  const res = await app.fetch(new Request("http://localhost/"));
  const tpl = document.createElement("template");
  tpl.innerHTML = await res.text();
  return tpl.content.getElementById("x");
};

describe("k.ui scroll region (server output)", () => {
  test('`<Box scroll="x" label="Prices">` renders a `div` with `role="region"`, `tabindex="0"`, `aria-label="Prices"` and class `k-scroll` in server output', async () => {
    const el = await serverEl(() => Box({ id: "x", scroll: "x", label: "Prices", children: "c" }));
    expect(el?.tagName).toBe("DIV");
    expect(el?.getAttribute("role")).toBe("region");
    expect(el?.getAttribute("tabindex")).toBe("0");
    expect(el?.getAttribute("aria-label")).toBe("Prices");
    expect(el?.classList.contains("k-scroll")).toBe(true);
  });

  test('`labelledBy="t"` writes `aria-labelledby="t"` and no `aria-label` in server output', async () => {
    const el = await serverEl(() => Box({ id: "x", scroll: "x", labelledBy: "t", children: "c" }));
    expect(el?.getAttribute("aria-labelledby")).toBe("t");
    expect(el?.hasAttribute("aria-label")).toBe(false);
  });

  test("a `Box` without `scroll` writes none of these in server output", async () => {
    const el = await serverEl(() => Box({ id: "x", children: "c" }));
    expect(el).not.toBeNull();
    for (const a of ["role", "tabindex", "aria-label", "aria-labelledby"]) expect(el?.hasAttribute(a)).toBe(false);
    expect(el?.classList.contains("k-scroll")).toBe(false);
  });

  test("any label is written as the `aria-label` of the region in server output (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,15}$/), async (label) => {
        const el = await serverEl(() => Box({ id: "x", scroll: "x", label, children: "c" }));
        expect(el?.getAttribute("aria-label")).toBe(label);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });
});
