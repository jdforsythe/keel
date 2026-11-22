// @vitest-environment happy-dom
// k.guards Client: the router's `user` read. Seed 1337.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { contract } from "../src/contract/index.ts";
import { guard } from "../src/guard.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { findRouter } from "../src/internal/findRouter.ts";
import { readUser } from "../src/internal/readUser.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const SEED = 1337;
const cc = contract("ru", { "ru.home": { path: "/" }, "ru.in": { path: "/in" }, "ru.b": { path: "/b" } });
const seen: string[] = [];
const gate = guard({ redirect: "ru.in" }, async ({ user }) => {
  seen.push(user);
  return ok(null);
});
const view = (): Node => document.createElement("p");
const routes = manifest(cc, {
  "ru.home": { component: view, guard: gate },
  "ru.in": { component: view },
  "ru.b": { component: view, guard: gate },
});
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};
function world(answer: () => Response | Promise<Response>) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: SEED });
  const paths: string[] = [];
  ctx.net.route("*", (req) => {
    paths.push(new URL(req.url).pathname);
    return answer();
  });
  return { ctx, paths };
}
const json = (body: unknown, status = 200) => (): Response => new Response(JSON.stringify(body), { status });

test("with no mount, a router sends no request at all, on start or on navigation", async () => {
  seen.length = 0;
  const { ctx, paths } = world(json({ user: "u1" }));
  const r = createRouter(routes, { ctx, history: memoryHistory("/") });
  await settle();
  await r.navigate(cc.href("ru.b"));
  await settle();
  expect(paths).toEqual([]);
  expect(seen).toEqual(["", ""]);
  r.dispose();
});

test("with mount and a given `user`, no read is sent and the guard gets that user", async () => {
  seen.length = 0;
  const { ctx, paths } = world(json({ user: "u1" }));
  const r = createRouterWith(routes, { ctx, history: memoryHistory("/"), mount: "/auth", user: "u9" });
  await settle();
  expect(paths).toEqual([]);
  expect(seen).toEqual(["u9"]);
  r.dispose();
});

test("an answer that is not `{ user }` of a string of at most 256 characters reads as ''", async () => {
  const bodies = fc.oneof(
    fc.constant("not json"),
    fc.constant(JSON.stringify(null)),
    fc.constant(JSON.stringify({ user: 7 })),
    fc.constant(JSON.stringify({})),
    fc.constant(JSON.stringify({ user: "x".repeat(257) })),
  );
  await fc.assert(
    fc.asyncProperty(bodies, async (body) => {
      const { ctx } = world(() => new Response(body, { status: 200 }));
      expect(await readUser(ctx)).toBe("");
    }),
    { seed: SEED, numRuns: 10 },
  );
  const { ctx } = world(json({ user: "x".repeat(256) }));
  expect(await readUser(ctx)).toBe("x".repeat(256));
});

test("`reread` replaces the user before the next guard, and only the latest read's answer is kept", async () => {
  seen.length = 0;
  const answers: (() => Promise<Response>)[] = [];
  const { ctx, paths } = world(() => answers.shift()?.() ?? json({ user: "" })());
  const slow = Promise.withResolvers<void>();
  answers.push(async () => json({ user: "u1" })());
  answers.push(async () => {
    await slow.promise;
    return json({ user: "stale" })();
  });
  answers.push(async () => json({ user: "u3" })());
  const r = createRouterWith(routes, { ctx, history: memoryHistory("/"), mount: "/auth" });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(r.App, host, { ctx });
  try {
    await settle();
    expect(seen).toEqual(["u1"]);
    const core = findRouter();
    const first = core?.reread();
    const second = core?.reread();
    await second;
    slow.resolve();
    await first;
    await r.navigate(cc.href("ru.b"));
    await settle();
    expect(seen).toEqual(["u1", "u3"]);
    expect(paths).toEqual(["/__keel/user", "/__keel/user", "/__keel/user"]);
  } finally {
    unmount();
    r.dispose();
    host.remove();
  }
});
