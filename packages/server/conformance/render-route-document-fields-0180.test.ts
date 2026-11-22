// @vitest-environment happy-dom
// Spec: k.testing, Conformance "With `app`, a valid submit whose action answers `keel.fields` `{ amount: 'Too many decimals' }` leaves the amount field `invalid`, holding the submitted value, its error text that message, and one POST in `documents()` of exactly the named fields; an invalid submit reaches no action."
// Spec: k.testing, Harness "With `app` (a `createApp` result) `renderRoute` runs a built `node` page, no router: a GET through `app.fetch` ... A valid `<Form>` submit (k.mount Form) is POSTed urlencoded, `sec-fetch-site: same-origin`, to `app`; ... the answer (a 422 too) replaces the page, resumed, before `fire` resolves."
// Seed: 1337 (fc.assert below). Pending: `renderRoute` has no `app` option yet. See render-route-document-support.ts for the assumed fixture shape.
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { MESSAGE, SEED, appOn, control, reset, routes, simCtx } from "./render-route-document-support.ts";

const amounts = fc.stringMatching(/^[a-z]{1,8}$/);

test("With `app`, a valid submit whose action answers `keel.fields` `{ amount: 'Too many decimals' }` leaves the amount field `invalid`, holding the submitted value, its error text that message, and one POST in `documents()` of exactly the named fields.", async () => {
  await fc.assert(
    fc.asyncProperty(amounts, async (value) => {
      reset("fields");
      const ctx = simCtx();
      const app = await appOn(ctx);
      const opts = { routes, ctx, app };
      const h = await renderRoute("f.page", opts);
      await h.fire("f.amount", { type: "input", value });
      await h.fire("f.save", { type: "click" });
      expect(h.a11y("f.amount").state.invalid).toBe(true);
      expect(h.find("f.shown").text).toBe(value);
      expect(h.find("f.error").text).toBe(MESSAGE);
      const posts = h.documents().filter((d) => d.method === "POST");
      expect(posts).toHaveLength(1);
      expect([...new URLSearchParams(posts[0]?.body ?? "").entries()]).toEqual([["amount", value]]);
      expect(control.posts).toBe(1);
      h.dispose();
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("With `app`, an invalid submit shows the schema error and reaches no action: no POST to `app`, the action records no call.", async () => {
  reset("fields");
  const ctx = simCtx();
  const app = await appOn(ctx);
  const opts = { routes, ctx, app };
  const h = await renderRoute("f.page", opts);
  await h.fire("f.amount", { type: "input", value: "" });
  await h.fire("f.save", { type: "click" });
  expect(h.a11y("f.amount").state.invalid).toBe(true);
  expect(h.find("f.error").text).not.toBe("");
  expect(h.find("f.error").text).not.toBe(MESSAGE);
  expect(control.posts).toBe(0);
  expect(app.requests.filter((r) => r.startsWith("POST"))).toEqual([]);
  expect(h.documents().filter((d) => d.method === "POST")).toEqual([]);
  h.dispose();
});

test("With `app`, the page is a GET of its URL through `app.fetch` (the harness starts from `GET /f`).", async () => {
  reset("fields");
  const ctx = simCtx();
  const app = await appOn(ctx);
  const opts = { routes, ctx, app };
  const h = await renderRoute("f.page", opts);
  expect(app.requests[0]).toBe("GET /f");
  h.dispose();
});
