// @vitest-environment happy-dom
// Spec: k.store, clause "A page component creating `store(S, { items: props.data.items }, { id })` in its body shows the loader's items under `renderRoute`, a click handler's `tx` on it updates the page and `state()`, and `resumeDocument` of its `createApp` document gives `state()` for that id equal to the server's."
// Spec: k.store, View stores "A store a component creates ... starts from `initial` on the server and in a client router, and from its `#k-state` snapshot at resume."
// Seed: 1337 (fc.assert below). Pending: the View stores paragraph is not built into spec text for k.store yet.
// ASSUMPTION: "the server's" is the `state()['v.list']` of the same page under `renderRoute` (a server render starts the store from `initial`), the loader answering the same items;
// the loader changing its answer between the serve and the resume does not change the resumed store (it is restored from the snapshot).
import { renderRoute, resumeDocument } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, control, routes } from "../../testing/conformance/view-store-page.ts";
import { simCtx } from "../../testing/conformance/fixtures.ts";
import { appOf } from "./resume-graph-app.ts";

const items = fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 4 });
const FRESH = () => import("../../testing/conformance/view-store-page.ts");

test("`resumeDocument` of the page's document from `createApp` gives `state()['v.list']` equal to the server's.", async () => {
  await fc.assert(
    fc.asyncProperty(items, items, async (served, later) => {
      control.items = served;
      const app = await appOf(routes, ["v"]);
      const res = await app.fetch(new Request("http://localhost/v", { headers: { accept: "text/html" } }));
      expect(res.status).toBe(200);
      const html = await res.text();
      const reference = await renderRoute("v.page", { routes, ctx: simCtx() });
      const server = reference.state()["v.list"];
      reference.dispose();
      expect(server).toBeDefined();
      control.items = later;
      const t = await resumeDocument(html, { routes: FRESH });
      expect(t.state()["v.list"]).toEqual(server);
      expect(t.find("v.items").text).toBe(served.join(","));
      await t.fire("v.add", { type: "click" });
      expect(t.find("v.items").text).toBe([...served, "new"].join(","));
      t.dispose();
    }),
    { seed: SEED, numRuns: 8 },
  );
});
