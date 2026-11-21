// Spec: k.deploy, clause "Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`." (RFC 0052)
// Spec: k.deploy Rules E1555
// Seed: 1337 (fc.assert seed below). In-process createApp, no listening server; NODE_ENV is stubbed per test.
import { createCtx } from "@keel/ctx";
import { manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

const appFor = (modules: readonly string[], mode?: "dev" | "production") => {
  const tables = modules.map((m) =>
    manifest(contract(m, { [`${m}.page`]: { path: `/${m}` } }), {
      [`${m}.page`]: { component: () => document.createElement("p") },
    }),
  );
  return createApp({
    topology: topology({ web: { modules: [...modules], adapter: "node" } }),
    routes: routeTable(...tables),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    ...(mode === undefined ? {} : { mode }),
  });
};

describe("k.deploy: production createApp without assets", () => {
  it("Production `createApp` without `assets` rejects at startup with E1555 unless `NODE_ENV` is `development` or `test`.", async () => {
    for (const env of [undefined, "production", "prod", "Production", "staging"]) {
      vi.stubEnv("NODE_ENV", env);
      await expect(appFor(["app"], "production")).rejects.toThrow(/^E1555\b/);
      await expect(appFor(["app"])).rejects.toThrow(/^E1555\b/);
    }
  });

  it("clean counterpart: a production createApp under NODE_ENV development or test starts without assets", async () => {
    for (const env of ["development", "test", "Development", "TEST"]) {
      vi.stubEnv("NODE_ENV", env);
      const app = await appFor(["app"], "production");
      expect((await app.fetch(new Request("http://localhost/app"))).status).toBe(200);
    }
  });

  it("clean counterpart: dev mode starts without assets whatever NODE_ENV is", async () => {
    for (const env of [undefined, "production"]) {
      vi.stubEnv("NODE_ENV", env);
      const app = await appFor(["app"], "dev");
      expect((await app.fetch(new Request("http://localhost/app"))).status).toBe(200);
    }
  });

  it("property: for any node deployable's modules and any NODE_ENV but development or test, no assets is E1555 at startup", async () => {
    const names = fc.uniqueArray(fc.constantFrom("alpha", "beta", "gamma", "delta", "omega"), {
      minLength: 1,
      maxLength: 4,
    });
    const env = fc.option(fc.string({ maxLength: 12 }), { nil: undefined }).filter((v) => {
      const k = v?.trim().toLowerCase();
      return k !== "development" && k !== "test";
    });
    // seed 1337
    await fc.assert(
      fc.asyncProperty(names, env, async (modules, e) => {
        vi.stubEnv("NODE_ENV", e);
        await expect(appFor(modules)).rejects.toThrow(/^E1555\b/);
      }),
      { seed: 1337, numRuns: 25 },
    );
  });
});
