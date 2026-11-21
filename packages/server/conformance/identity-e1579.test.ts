// Spec: k.user, Rules "E1579 `identity.server.ts` without a default `identity(...)` export, or a `handle.path` not of lowercase `/` segments, or with a route of any deployable at or under it (`keel check`, `keel build`; `createApp` throws it). Fix: none."
// Seed 1337 (fc.assert below). ASSUMPTION: createApp rejects with an error whose message holds the code, as e1553-static-params.test.ts assumes.
// @vitest-environment node
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, identity, topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./identity-support.ts";

const view = () => document.createElement("p");
const boot = (path: string, route: string) => {
  const appContract = contract("app", { "app.x": { path: route } });
  return createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.x": { component: view } }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "production",
    identity: identity({ identify: async () => "", handle: { path, fn: () => new Response("") } }),
  });
};

describe("k.user: createApp throws E1579", () => {
  test("`createApp` with `handle.path` `/api` and a route `/api/x` throws E1579", async () => {
    await expect(boot("/api", "/api/x")).rejects.toThrow(/E1579/);
  });

  test("`createApp` throws E1579 for a route at or under `handle.path`, and for a path not of lowercase `/` segments", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,6}$/), fc.constantFrom("", "/x", "/x/y"), async (seg, tail) => {
        await expect(boot(`/${seg}`, `/${seg}${tail}`)).rejects.toThrow(/E1579/);
        await expect(boot(seg, `/zz${tail}`)).rejects.toThrow(/E1579/);
        await expect(boot(`/${seg.toUpperCase()}`, `/zz${tail}`)).rejects.toThrow(/E1579/);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("`createApp` with `handle.path` `/auth` beside a route `/app` does not throw", async () => {
    const app = await boot("/auth", "/app");
    expect(typeof app.fetch).toBe("function");
  });
});
