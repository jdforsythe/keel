// @vitest-environment happy-dom
// k.api Requests: a GET or HEAD to an API path none of whose entries answers GET is 405 with `allow` naming the methods
// its entries answer, in the order GET, HEAD, POST, PUT, PATCH, DELETE. It is method dispatch, decided before the
// entries' guards run, so a denying guard is never asked and the 405 carries no body: 405 is no k.server error status,
// so it has no `Result` JSON.
import { createCtx } from "@keel/ctx";
import { action, guard, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const Denied = s.error("keel.denied", s.object({}));

describe("an API path without a GET entry", () => {
  it("answers GET and HEAD 405 with its entries' methods before any guard runs, with no body", async () => {
    let asked = 0;
    const deny = guard({}, async () => {
      asked++;
      return err(Denied.make({}));
    });
    const api = contract("api", {
      "api.post": { method: "POST", path: "/api/w", output: s.object({}) },
      "api.del": { method: "DELETE", path: "/api/w", output: s.object({}) },
    });
    const ops = contract("ops", { "ops.home": { path: "/" } });
    const post = action(api, "api.post", {}, async () => ok({}));
    const del = action(api, "api.del", {}, async () => ok({}));
    const routes = routeTable(
      manifest(api, { "api.post": { action: post, guard: deny }, "api.del": { action: del, guard: deny } }),
      manifest(ops, { "ops.home": { component: () => document.createElement("main") } }),
    );
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
