// @vitest-environment happy-dom
// Rule E1558 (k.topology): a live loader a non-`node` deployable serves.
// ASSUMPTION (as e1553-static-params.test.ts): building the deployable with createApp reports the code (rejection mentioning it).
// Seed 1337: no generated input.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { createAppLoose, liveLoader, simCtx } from "./topology-fixtures.ts";

const run = async (adapter: "static" | "node") => {
  const appContract = contract("app", {
    "app.live": { method: "GET", path: "/api/live", events: true, output: s.object({ n: s.int() }) },
  });
  const live = liveLoader(appContract, "app.live", async function* () {
    yield ok({ n: 1 });
  });
  const routes = manifest(appContract, { "app.live": { loader: live } });
  return createAppLoose({ topology: topology({ web: { modules: ["app"], adapter } }), routes, ctx: simCtx() }).then(
    () => "built",
    (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e)),
  );
};

describe("k.server: E1558", () => {
  test("E1558 a live loader a non-`node` deployable serves", async () => {
    expect(await run("static")).toContain("E1558");
  });
  test("E1558 clean counterpart: the same live loader on a node deployable builds", async () => {
    expect(await run("node")).toBe("built");
  });
});
