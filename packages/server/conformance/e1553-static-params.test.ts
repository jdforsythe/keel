// @vitest-environment happy-dom
// Rule E1553. ASSUMPTION: building a `static` deployable (createApp) reports the diagnostic (throw or rejection mentioning the code).
import { createCtx } from "@keel/ctx";
import { describe, expect, it } from "vitest";
import { topology } from "@keel/server";
import { build, createApp, SEED } from "./fixtures.ts";

const run = async (adapter: "static" | "node") => {
  const { routes } = await build({});
  return createApp({
    topology: topology({ web: { modules: ["orders"], adapter } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
  }).then(
    () => "built",
    (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e)),
  );
};

describe("k.server", () => {
  it("E1553 static deployable contains a route with params or actions", async () => {
    expect(await run("static")).toContain("E1553");
  });

  it("E1553 clean counterpart: the same routes on a node deployable build", async () => {
    expect(await run("node")).toBe("built");
  });
});
