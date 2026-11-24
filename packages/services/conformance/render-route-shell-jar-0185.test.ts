// @vitest-environment happy-dom
// Spec: k.return, Conformance "Under `renderRoute(id, { shell: true, ctx })`, `ctx.net` routing the origin to a `createApp` whose `handle` answers a mount `Form` POST 303 to a page with `set-cookie: s=1`: the router navigates there and the page's next `service({ contract })` call carries `cookie` `s=1`."
// Spec: k.return, Testing "mount requests and the page's other requests to its origin go to the sim `net` through the harness's cookie jar (k.mount Testing)".
// Seed: 1337 (fc.assert below; the cookie value is generated, `1` is its default). Pending: RFC 0185 is not built. To un-skip: change `test.skip` to `test` in this file once a shell harness owns a cookie jar.
// ASSUMPTION: the route `*` on the shell ctx's net takes every request to the page's origin (as return-support.ts does); the request's `cookie` is read as it reaches that route. See render-route-user-support.ts.
import { createCtx } from "@keel/ctx";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, boot, control, mount, pairs, reset, routes } from "./render-route-user-support.ts";

test("under `renderRoute(id, { shell: true, ctx })`, a mount `Form` POST answered 303 to a page with `set-cookie: s=1`: the router navigates there and the page's next `service({ contract })` call carries `cookie` `s=1`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z0-9]{1,8}$/), async (value) => {
      reset();
      control.value = value;
      const { app } = await boot();
      const seen: { method: string; path: string; cookie: string | null }[] = [];
      const ctx = createCtx({ mode: "sim", seed: 2 });
      ctx.net.route("*", (req) => {
        seen.push({ method: req.method, path: new URL(req.url).pathname, cookie: req.headers.get("cookie") });
        return app.fetch(req);
      });
      const h = await renderRoute("u.signin", { routes, shell: true, ctx, mount });
      try {
        await h.fire("u.signin.go", { type: "click" });
        expect(seen.find((r) => r.method === "POST")?.path).toBe("/api/auth/in");
        expect(h.route().id).toBe("u.page");
        await h.fire("u.who", { type: "click" });
        const call = seen.filter((r) => r.path === "/api/who").at(-1);
        expect(pairs(call?.cookie)).toContain(`s=${value}`);
      } finally {
        h.dispose();
      }
    }),
    { seed: SEED, numRuns: 6 },
  );
});
