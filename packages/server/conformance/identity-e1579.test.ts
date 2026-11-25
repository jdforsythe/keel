// Spec: k.user, Rules "E1579 `identity.server.ts` without a default `identity(...)` export, or a `handle.path` (a literal, or `identity.ts`'s through `.path`) not of lowercase `/` segments, or at or under `/assets`, where a built client's files are served (k.deploy), or with a route of any deployable at or under it (`keel check`, `keel build`; `createApp` throws it). The `/assets` one is at `identity.server.ts`'s first line: `handle.path <p> is at or under /assets (built files)`, `<p>` the first 40 units of the path's JSON text, quotes included, no ellipsis (89 at the bound); `createApp` throws each `handle.path` case as `E1579 identity handle.path: lowercase / segments, not /assets, no route under it` (the text after the code: 74)"
// Spec: k.user, Conformance "For every `handle.path` `p` of lowercase `/` segments and no route at or under it, `keel check`, `keel build` and `createApp` each report E1579 exactly when `p` is `/assets` or begins `/assets/`: `/assets` and `/assets/auth` give one each, `/assetsx` and `/api/assets` none; the same holds for `p` given as `identity.ts`'s `.path`."
// Seed 1337 (fc.assert below). ASSUMPTION: createApp rejects with an error whose message holds the code, as e1553-static-params.test.ts assumes.
// `keel check` and `keel build` are packages/check/conformance/identity-e1579-assets.test.ts and packages/cli/conformance/identity-e1579-assets-build.test.ts.
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

const E1579_TEXT = "E1579 identity handle.path: lowercase / segments, not /assets, no route under it";
const thrown = async (path: string, route: string): Promise<string> => {
  try {
    await boot(path, route);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "";
};

describe("k.user: createApp throws E1579", () => {
  test("`createApp` throws each `handle.path` case as `E1579 identity handle.path: lowercase / segments, not /assets, no route under it` (the text after the code: 74)", async () => {
    expect(E1579_TEXT.slice("E1579 ".length)).toHaveLength(74);
    for (const [path, route] of [
      ["/api", "/api/x"],
      ["/assets", "/zz"],
      ["/assets/auth", "/zz"],
      ["api", "/zz"],
      ["/Api", "/zz"],
    ] as const) {
      expect(await thrown(path, route)).toBe(E1579_TEXT);
    }
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,6}$/), fc.constantFrom("", "/x", "/x/y"), async (seg, tail) => {
        expect(await thrown(`/${seg}`, `/${seg}${tail}`)).toBe(E1579_TEXT);
        expect(await thrown(`/assets/${seg}`, `/zz${tail}`)).toBe(E1579_TEXT);
        expect(await thrown(seg, `/zz${tail}`)).toBe(E1579_TEXT);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

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

  test("with no route at or under it, `createApp` throws E1579 for a `handle.path` exactly when it is `/assets` or begins `/assets/`: `/assets` and `/assets/auth` throw, `/assetsx` and `/api/assets` do not", async () => {
    await expect(boot("/assets", "/zz")).rejects.toThrow(/E1579/);
    await expect(boot("/assets/auth", "/zz")).rejects.toThrow(/E1579/);
    expect(typeof (await boot("/assetsx", "/zz")).fetch).toBe("function");
    expect(typeof (await boot("/api/assets", "/zz")).fetch).toBe("function");
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("assets", "assetsx", "api", "my-assets"),
        fc.array(fc.stringMatching(/^[a-z]{1,5}$/), { maxLength: 3 }),
        async (head, rest) => {
          const p = `/${[head, ...rest].join("/")}`;
          const refused = p === "/assets" || p.startsWith("/assets/");
          if (refused) await expect(boot(p, "/zz")).rejects.toThrow(/E1579/);
          else expect(typeof (await boot(p, "/zz")).fetch).toBe("function");
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });
});
