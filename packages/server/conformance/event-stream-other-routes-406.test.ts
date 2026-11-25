// @vitest-environment happy-dom
// k.server Request flow, "GET with `accept: text/event-stream` to a live loader's route ... Other routes: 406."
// Seed 1337: no generated input.
import { describe, expect, test } from "vitest";
import { topology } from "@keel/server";
import { createAppLoose, pageManifest, simCtx } from "./topology-fixtures.ts";

describe("k.server: event-stream GET", () => {
  test("A GET with `accept: text/event-stream` to a route whose loader is not live is 406.", async () => {
    const routes: unknown = pageManifest("app", "/plain", "P");
    const app = await createAppLoose({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes,
      ctx: simCtx(),
      mode: "dev",
    });
    const res = await app.fetch(new Request("http://localhost/plain", { headers: { accept: "text/event-stream" } }));
    expect(res.status).toBe(406);
  });
});
