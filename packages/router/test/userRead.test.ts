// @vitest-environment happy-dom
// k.guards Client: the `/__keel/user` read comes with `identityMount`, so a bundle with no identity mount holds none.
// No generated input (seed 1337 for the sim ctx).
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { ok } from "@keel/schema";
import { expect, test } from "vitest";
import { contract } from "../src/contract/index.ts";
import { createRouter } from "../src/createRouter.ts";
import { guard } from "../src/guard.ts";
import { identityMount } from "../src/identityMount.ts";
import { userRead } from "../src/internal/userRead.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const cc = contract("ur", { "ur.home": { path: "/" }, "ur.in": { path: "/in" } });
const seen: string[] = [];
const gate = guard({ redirect: "ur.in" }, async ({ user }) => {
  seen.push(user);
  return ok(null);
});
const view = (): Node => document.createElement("p");
const routes = manifest(cc, { "ur.home": { component: view, guard: gate }, "ur.in": { component: view } });
const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
};
async function run(): Promise<string[]> {
  seen.length = 0;
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const paths: string[] = [];
  ctx.net.route("*", (req) => {
    paths.push(new URL(req.url).pathname);
    return new Response(JSON.stringify({ user: "u1" }), { status: 200 });
  });
  const r = createRouter(routes, { ctx, history: memoryHistory("/"), mount: "/auth" });
  await settle();
  r.dispose();
  return paths;
}

test("before any identity mount is made there is no read: a router given `mount` sends nothing", async () => {
  expect(userRead.fn).toBeUndefined();
  expect(await run()).toEqual([]);
  expect(seen).toEqual([""]);
});

test("once `identityMount` runs, a router given `mount` reads `/__keel/user` as it starts", async () => {
  identityMount("/auth");
  expect(userRead.fn).toBeTypeOf("function");
  expect(await run()).toEqual(["/__keel/user"]);
  expect(seen).toEqual(["u1"]);
});
