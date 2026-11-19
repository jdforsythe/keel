// @vitest-environment happy-dom
// k.api Requests: a GET or HEAD to an API route without a loader is 405 with `allow` naming its action methods. It is
// method dispatch, decided before the route's guards run, so a denying guard is never asked and the 405 carries no body:
// 405 is no k.server error status, so it has no `Result` JSON.
import { createCtx } from "@keel/ctx";
import { action, guard, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Denied = s.error("keel.denied", s.object({}));

describe("an API route without a loader", () => {
  it("answers GET and HEAD 405 with its action methods before any guard runs, with no body", async () => {
    let asked = 0;
    const deny = guard({}, async () => {
      asked++;
      return err(Denied.make({}));
    });
    const write = action({ input: s.object({}), output: s.object({}) }, async () => ok({}));
    const routes = manifest({
      "api.w": { api: true, path: "/api/w", guard: deny },
      "ops.home": { path: "/", component: () => document.createElement("main") },
    });
    routes.actions({ "api.w": { POST: write, DELETE: write } });
    const app = await createApp({
      topology: topology({ web: { modules: ["api", "ops"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
      mode: "production",
    });
    for (const method of ["GET", "HEAD"]) {
      const res = await app.fetch(
        new Request("http://localhost/api/w", { method, headers: { accept: "application/json" } }),
      );
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, DELETE");
      expect(await res.text()).toBe("");
    }
    expect(asked).toBe(0);
    const posted = await app.fetch(
      new Request("http://localhost/api/w", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1" },
        body: "{}",
      }),
    );
    expect(posted.status).toBe(403);
    expect(asked).toBe(1);
  });
});
