// @vitest-environment happy-dom
// Spec: k.testing, Conformance "`app` with `state` or `shell` rejects E1722, `app` unrequested; W1723 fires on `renderRoute('f.page', { routes })` when a `node` deployable serves `f`, not with `app` nor for a `client` one."
// Spec: k.testing, Rules "E1722 `renderRoute` given `app` with `state` or `shell`" (W1723 is packages/check/conformance/render-route-w1723-0180.test.ts).
// Seed: 1337 (no generated input beyond the two options). Pending: `renderRoute` has no `app` option yet.
// ASSUMPTION: `state` is `[]` (a list of store, value pairs) and `shell` is `true` (return-support.ts); E1722 is the rejection's `code`, as E1720 is for `resumeDocument`.
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { appOn, routes, simCtx } from "./render-route-document-support.ts";

const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined);

test("`app` with `state` rejects E1722, `app` unrequested.", async () => {
  const ctx = simCtx();
  const app = await appOn(ctx);
  const opts = { routes, ctx, app, state: [] };
  const e = await renderRoute("f.page", opts).then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(codeOf(e)).toBe("E1722");
  expect(app.requests).toEqual([]);
});

test("`app` with `shell` rejects E1722, `app` unrequested.", async () => {
  const ctx = simCtx();
  const app = await appOn(ctx);
  const shell = true;
  const opts = Object.freeze({ routes, ctx, app, shell });
  const e = await renderRoute("f.page", opts).then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(codeOf(e)).toBe("E1722");
  expect(app.requests).toEqual([]);
});
