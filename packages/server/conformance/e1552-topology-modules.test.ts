// Rule E1552. ASSUMPTION: building the deployable (createApp) with the topology reports the diagnostic (throw or rejection mentioning the code).
// The known-module set is taken from the routes' module ids: 'app', 'orders'.
import { createCtx } from "@keel/ctx";
import { describe, expect, it } from "vitest";
import { topology } from "@keel/server";
import { build, createApp, SEED } from "./fixtures.ts";

const run = (t: unknown) =>
  build({}).then(async ({ routes }) => {
    const outcome = await createApp({ topology: t, routes, ctx: createCtx({ mode: "sim", seed: SEED }) }).then(
      () => "built",
      (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e)),
    );
    return outcome;
  });

describe("k.server", () => {
  it("E1552 topology names an unknown module", async () => {
    const out = await run(topology({ web: { modules: ["app", "orders", "ghost"], adapter: "node" } }));
    expect(out).toContain("E1552");
  });

  it("E1552 topology names one module in two deployables", async () => {
    const out = await run(
      topology({ web: { modules: ["app", "orders"], adapter: "node" }, api: { modules: ["orders"], adapter: "node" } }),
    );
    expect(out).toContain("E1552");
  });

  it("E1552 clean counterpart: known modules, each in one deployable, builds", async () => {
    expect(await run(topology({ web: { modules: ["app", "orders"], adapter: "node" } }))).toBe("built");
  });
});
