// @vitest-environment happy-dom
// Spec: k.user, Conformance "With `app` and no `user`, `identify` runs for each page request, given that page's caller; `user` on a `ctx` no `createApp` of `app` bound: E1724, `app` unrequested."
// Spec: k.user, Rules "E1724 `renderRoute` `user` with `app` on a `ctx` no `createApp` of `app` bound".
// Seed: 1337 (fc.assert below). Pending: RFC 0185 is not built. To un-skip: change `test.skip` to `test` in this file once `renderRoute` with `app` rejects E1724 and gives each harness its own jar.
// "`app` unrequested" is observed server-side: no `identify`, guard, loader or action ran. See render-route-user-support.ts.
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, boot, codeOf, rec, rejection, reset, routes, simCtx } from "./render-route-user-support.ts";

const click = { type: "click" } as const;
const untouched = (): void => {
  expect(rec.identified).toEqual([]);
  expect(rec.guard).toEqual([]);
  expect(rec.loader).toEqual([]);
  expect(rec.who).toEqual([]);
  expect(rec.action).toEqual([]);
};

test("with `app` and no `user`, `identify` runs for each page request, given that page's caller", async () => {
  reset();
  const { app, ctx } = await boot();
  const h1 = await renderRoute("u.page", { routes, app, ctx });
  const h2 = await renderRoute("u.page", { routes, app, ctx });
  try {
    // each page's load is a cookieless GET: identified with caller `''`; its write is where `app` mints its caller (k.server)
    expect(rec.identified.map((i) => i.caller)).toEqual(["", ""]);
    for (const h of [h1, h2]) {
      await h.fire("u.note", { type: "input", value: "a" });
      await h.fire("u.save", click);
    }
    const callers = rec.action.map(([, c]) => c);
    expect(callers).toHaveLength(2);
    expect(callers[0]).not.toBe("");
    expect(callers[1]).not.toBe("");
    expect(callers[0]).not.toBe(callers[1]);
    const mark = rec.identified.length;
    await h1.fire("u.who", click);
    await h2.fire("u.who", click);
    // each later request is identified with the caller its page's write minted
    const later = rec.identified.slice(mark).map((i) => i.caller);
    expect(later).toContain(callers[0]);
    expect(later).toContain(callers[1]);
    expect(rec.who.map(([, c]) => c)).toEqual(callers);
    expect(rec.guard.map(([u]) => u)).toEqual(["", ""]);
  } finally {
    h1.dispose();
    h2.dispose();
  }
});

test("`user` with `app` on a `ctx` no `createApp` bound rejects E1724, `app` unrequested", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z][a-z0-9]{0,11}$/), async (user) => {
      reset();
      const { app } = await boot();
      const e = await rejection(renderRoute("u.page", { routes, app, ctx: simCtx(2), user }));
      expect(codeOf(e)).toBe("E1724");
      untouched();
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("`user` with `app` on a `ctx` another app's `createApp` bound rejects E1724, `app` unrequested", async () => {
  reset();
  const { app } = await boot();
  const other = await boot(createCtx({ mode: "sim", seed: 3 }));
  rec.identified.length = 0;
  const e = await rejection(renderRoute("u.page", { routes, app, ctx: other.ctx, user: "u1" }));
  expect(codeOf(e)).toBe("E1724");
  untouched();
});
