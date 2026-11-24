// @vitest-environment happy-dom
// Spec: k.testing, Conformance "`renderRoute(id, { routes, app, mount })` rejects E1722, `app` unrequested."
// Spec: k.testing, Rules "E1722 `renderRoute` given `app` with `state`, `shell` or `mount`, or `routes` as an import without `app`"
// Seed: 1337 (fc.assert below). `mount` is `identityMount('/api/auth')`, the value a test imports from `identity.ts`.
// ASSUMPTION: E1722 is the rejection's `code`, as render-route-document-e1722-0180.test.ts reads it; "`app` unrequested" is `app.requests` still `[]`.
// `mount` is passed in options held by a variable, so the file compiles before `renderRoute`'s type names `mount`.
import { identityMount } from "@keel/router";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, appOn, routes, simCtx } from "./render-route-document-support.ts";

const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined);
const mount = identityMount("/api/auth");

test("`renderRoute(id, { routes, app, mount })` rejects E1722, `app` unrequested.", async () => {
  const ctx = simCtx();
  const app = await appOn(ctx);
  const opts = { routes, ctx, app, mount };
  const e = await renderRoute("f.page", opts).then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(codeOf(e)).toBe("E1722");
  expect(app.requests).toEqual([]);
});

test("`app` with `mount` rejects E1722 whatever other of `user` and `caller` the options carry, `app` unrequested.", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({ user: fc.option(fc.stringMatching(/^[a-z0-9]{1,6}$/), { nil: undefined }), caller: fc.option(fc.stringMatching(/^[a-z0-9]{1,6}$/), { nil: undefined }) }),
      async (extra) => {
        const ctx = simCtx();
        const app = await appOn(ctx);
        const opts = { routes, ctx, app, mount, ...extra };
        const e = await renderRoute("f.page", opts).then(
          () => undefined,
          (x: unknown) => x,
        );
        expect(codeOf(e)).toBe("E1722");
        expect(app.requests).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 8 },
  );
});

test("control: `mount` without `app` does not reject E1722", async () => {
  const ctx = simCtx();
  const opts = { routes, ctx, mount };
  const e = await renderRoute("f.page", opts).then(
    (h) => {
      h.dispose();
      return undefined;
    },
    (x: unknown) => x,
  );
  expect(codeOf(e)).not.toBe("E1722");
});
