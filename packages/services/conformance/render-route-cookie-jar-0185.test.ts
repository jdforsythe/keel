// @vitest-environment happy-dom
// Spec: k.mount, Conformance "With `app` and no `user`, a mount `Form` POST answered 303 with `set-cookie: s=1; HttpOnly`: the followed GET and each later request of that page carry `s=1`, a second harness's none; after an answer with `s=; Max-Age=0`, none does."
// Spec: k.mount, Testing "Its cookie jar holds that origin's cookies: each such request enters `ctx.net` with `cookie` set to the jar's pairs, and each `set-cookie` line of its answer (a followed redirect's or a `redirect: 'manual'` 3xx's too) is applied".
// Seed: 1337 (fc.assert below; the cookie value `s` is generated, `1` is its default). Pending: RFC 0185 is not built. To un-skip: change `test.skip` to `test` in this file once the harness owns a cookie jar.
// A request's `cookie` is read where the app sees it, in `identify` (page loads and API calls, which the page's requests are). See render-route-user-support.ts.
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, boot, control, pairs, rec, reset, routes } from "./render-route-user-support.ts";

const click = { type: "click" } as const;
const values = fc.stringMatching(/^[a-z0-9]{1,8}$/);
const carries = (cookie: string | null | undefined, value: string): boolean => pairs(cookie).includes(`s=${value}`);
const hasS = (cookie: string | null | undefined): boolean => pairs(cookie).some((p) => p.startsWith("s="));

test("with `app` and no `user`, a mount `Form` POST answered 303 with `set-cookie: s=1; HttpOnly`: the followed GET and each later request of that page carry `s=1`", async () => {
  await fc.assert(
    fc.asyncProperty(values, async (value) => {
      reset();
      control.value = value;
      const { app, ctx } = await boot();
      const h = await renderRoute("u.signin", { routes, app, ctx });
      try {
        expect(hasS(rec.identified.at(-1)?.cookie)).toBe(false);
        await h.fire("u.signin.go", click);
        expect(rec.handled).toHaveLength(1);
        expect(carries(rec.identified.at(-1)?.cookie, value)).toBe(true);
        expect(h.route().id).toBe("u.page");
        const before = rec.identified.length;
        await h.fire("u.who", click);
        expect(rec.identified.length).toBeGreaterThan(before);
        for (const i of rec.identified.slice(before)) expect(carries(i.cookie, value)).toBe(true);
        expect(rec.who).toHaveLength(1);
      } finally {
        h.dispose();
      }
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("a second harness's requests do not carry `s=1`", async () => {
  reset();
  const { app, ctx } = await boot();
  const h1 = await renderRoute("u.signin", { routes, app, ctx });
  const h2 = await renderRoute("u.page", { routes, app, ctx });
  try {
    await h1.fire("u.signin.go", click);
    expect(carries(rec.identified.at(-1)?.cookie, "1")).toBe(true);
    const mark = rec.identified.length;
    await h2.fire("u.who", click);
    const others = rec.identified.slice(mark);
    expect(others.length).toBeGreaterThan(0);
    for (const i of others) expect(hasS(i.cookie)).toBe(false);
  } finally {
    h1.dispose();
    h2.dispose();
  }
});

test("after an answer with `s=; Max-Age=0`, no request of that page carries `s=1`", async () => {
  reset();
  const { app, ctx } = await boot();
  const h = await renderRoute("u.signin", { routes, app, ctx });
  try {
    await h.fire("u.signin.go", click);
    expect(carries(rec.identified.at(-1)?.cookie, "1")).toBe(true);
    await h.fire("u.signout", click);
    expect(rec.handled.map((r) => r.path)).toEqual(["/api/auth/in", "/api/auth/out"]);
    expect(hasS(rec.identified.at(-1)?.cookie)).toBe(false);
    const before = rec.identified.length;
    await h.fire("u.who", click);
    expect(rec.identified.length).toBeGreaterThan(before);
    for (const i of rec.identified.slice(before)) expect(hasS(i.cookie)).toBe(false);
  } finally {
    h.dispose();
  }
});
