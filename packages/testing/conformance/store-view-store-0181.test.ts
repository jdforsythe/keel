// @vitest-environment happy-dom
// Spec: k.store, clause "A page component creating `store(S, { items: props.data.items }, { id })` in its body shows the loader's items under `renderRoute`, a click handler's `tx` on it updates the page and `state()`, and `resumeDocument` of its `createApp` document gives `state()` for that id equal to the server's."
// Spec: k.store, View stores "A store a component creates is owned by its scope and starts from `initial` on the server and in a client router."
// Seed: 1337 (fc.assert below). Pending: the clause is not in the spec text yet beyond the RFC diff; the fixture is view-store-page.ts.
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, control, routes } from "./view-store-page.ts";
import { simCtx } from "./fixtures.ts";

const items = fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 4 });

test("a page whose component creates `store(S, { items: props.data.items }, { id: 'v.list' })` in its body, under `renderRoute`, shows the loader's items; a click whose handler `tx`es one of its transactions shows the change, and `state()` holds `v.list`.", async () => {
  await fc.assert(
    fc.asyncProperty(items, async (list) => {
      control.items = list;
      const h = await renderRoute("v.page", { routes, ctx: simCtx() });
      expect(h.find("v.items").text).toBe(list.join(","));
      await h.fire("v.add", { type: "click" });
      expect(h.find("v.items").text).toBe([...list, "new"].join(","));
      expect(h.state()["v.list"]).toBeDefined();
      h.dispose();
    }),
    { seed: SEED, numRuns: 10 },
  );
});
