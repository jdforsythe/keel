// @vitest-environment happy-dom
// k.guards, k.server: a client router runs its guards and loaders as the caller and user it was made with, the empty
// string for each one it was not given.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { guard } from "../src/guard.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const SEED = 1337;
const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};

describe("a router's caller and user", () => {
  it("reach the guard and the loader, the empty string when the router was given none", async () => {
    const name = fc.option(fc.constantFrom("", "c1", "ada"), { nil: undefined });
    await fc.assert(
      fc.asyncProperty(name, name, async (caller, user) => {
        const seen: unknown[] = [];
        const c = contract("rw", { "rw.page": { path: "/rw" }, "rw.login": { path: "/login" } });
        const gate = guard({ redirect: "rw.login" }, async (req) => {
          seen.push(["guard", req.caller, req.user]);
          return ok(null);
        });
        const load = loader(c, "rw.page", { output: s.object({}) }, async (at) => {
          seen.push(["loader", at.caller, at.user]);
          return ok({});
        });
        const routes = manifest(c, {
          "rw.page": { component: () => document.createElement("main"), guard: gate, loader: load },
          "rw.login": { component: () => document.createElement("main") },
        });
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const router = createRouterWith(routes, {
          ctx,
          history: memoryHistory("/rw"),
          leave: () => undefined,
          ...(caller === undefined ? {} : { caller }),
          ...(user === undefined ? {} : { user }),
        });
        const host = document.createElement("div");
        document.body.append(host);
        const unmount = mount(router.App, host, { ctx });
        await settle();
        expect(seen).toEqual([
          ["guard", caller ?? "", user ?? ""],
          ["loader", caller ?? "", user ?? ""],
        ]);
        unmount();
        router.dispose();
        host.remove();
      }),
      { seed: SEED, numRuns: 16 },
    );
  });
});
