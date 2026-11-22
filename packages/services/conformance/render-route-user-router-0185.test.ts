// @vitest-environment happy-dom
// Spec: k.user, Conformance "`renderRoute` without `app`, `user: 'u1'`, on a ctx a `createApp` bound, `identify` answering `''`: a component's `service({ contract })` call naming no `user` reaches the guard as `'u1'`, `identify` uncalled; naming `user: 'u2'`, as `'u2'`. A second open harness there with `user: 'u3'`: E1724."
// Spec: k.user, Rules "E1724 `renderRoute` `user` ... without `app` beside an open harness on `ctx` with another `user`."
// Seed: 1337 (fc.assert below). Pending: RFC 0185 is not built. To un-skip: change `test.skip` to `test` in this file once `renderRoute` carries `user` on a router-mode module call.
// See render-route-user-support.ts for the fixture (TSX page, `createApp` ctx, `identify` answering `''`).
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, boot, codeOf, rec, rejection, reset, routes } from "./render-route-user-support.ts";

const users = fc.stringMatching(/^[a-z][a-z0-9]{0,11}$/);

test("a component's `service({ contract })` call naming no `user` reaches the guard as the harness's `user`, `identify` uncalled", async () => {
  await fc.assert(
    fc.asyncProperty(users, async (user) => {
      reset();
      const { ctx } = await boot();
      const h = await renderRoute("u.page", { routes, ctx, user });
      try {
        await h.fire("u.who", { type: "click" });
        expect(rec.guard.at(-1)?.[0]).toBe(user);
        expect(rec.who.at(-1)?.[0]).toBe(user);
        expect(h.find("u.out").text).toBe(user);
        expect(rec.identified).toEqual([]);
      } finally {
        h.dispose();
      }
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("a call naming `user: 'u2'` keeps it: the guard gets 'u2' under harness user 'u1', `identify` uncalled", async () => {
  reset();
  const { ctx } = await boot();
  const h = await renderRoute("u.page", { routes, ctx, user: "u1" });
  try {
    await h.fire("u.whoAs", { type: "click" });
    expect(rec.guard.at(-1)?.[0]).toBe("u2");
    expect(rec.who.at(-1)?.[0]).toBe("u2");
    expect(h.find("u.out").text).toBe("u2");
    expect(rec.identified).toEqual([]);
  } finally {
    h.dispose();
  }
});

test("a second open harness on that ctx with `user: 'u3'` rejects E1724", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(users, users).filter(([a, b]) => a !== b),
      async ([first, second]) => {
        reset();
        const { ctx } = await boot();
        const h = await renderRoute("u.page", { routes, ctx, user: first });
        try {
          const e = await rejection(renderRoute("u.page", { routes, ctx, user: second }));
          expect(codeOf(e)).toBe("E1724");
        } finally {
          h.dispose();
        }
      },
    ),
    { seed: SEED, numRuns: 8 },
  );
});
