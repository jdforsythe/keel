// @vitest-environment happy-dom
// Spec: k.leave, clause "`createApp` leaves `process.listenerCount('uncaughtException')` and `('unhandledRejection')` as they were."
// Seed: 1337 (no generated inputs). The process is this test's own: it adds and removes nothing.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { describe, expect, test } from "vitest";

describe("k.leave Process: createApp adds no process listener", () => {
  test("`createApp` leaves `process.listenerCount('uncaughtException')` and `('unhandledRejection')` as they were", async () => {
    const before = [process.listenerCount("uncaughtException"), process.listenerCount("unhandledRejection")];
    const Data = s.object({ title: s.string() });
    const lpContract = contract("lp", { "lp.home": { path: "/" } });
    const app = await createApp({
      topology: topology({ web: { modules: ["lp"], adapter: "node" } }),
      routes: manifest(lpContract, {
        "lp.home": {
          component: () => document.createElement("main"),
          loader: loader(lpContract, "lp.home", { output: Data }, () => Promise.resolve(ok({ title: "t" }))),
        },
      }),
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      mode: "production",
    });
    await app.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }));
    expect([process.listenerCount("uncaughtException"), process.listenerCount("unhandledRejection")]).toEqual(before);
    await app.close();
    expect([process.listenerCount("uncaughtException"), process.listenerCount("unhandledRejection")]).toEqual(before);
  });
});
