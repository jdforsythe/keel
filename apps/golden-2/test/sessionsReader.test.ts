// @vitest-environment node
// std.monitor Read and std.sessions Ingest: `sessions.tally` and `sessions.list` load behind guard `sessions.reader`, a
// `user` or `caller` in `readers`, else 403 `keel.denied`. A user signed in through the real identity mount, who is not
// in `readers`, is refused both, as is a request with no session.
import { resolve } from "node:path";
import { createApp } from "@keel/server";
import { describe, expect, it } from "vitest";
import source from "../identity.server.ts";
import mount from "../identity.ts";
import topology from "../topology.ts";
import { EMAIL, NAME, PASSWORD, browser } from "./accountsApp.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { apiCtx } from "./simApi.ts";

describe("the sessions routes behind the reader guard", () => {
  it("refuse a signed-out request and a signed-in user who is not a reader", async () => {
    const app = await createApp({
      topology,
      routes: apiRoutes,
      ctx: apiCtx(61),
      deployable: "api",
      identity: source,
      std: resolve(".keel/std.json"),
    });
    const b = browser(app);
    for (const path of ["/sessions/tally", "/sessions/list"]) {
      expect({ path, status: (await b.json("GET", path)).status }).toEqual({ path, status: 403 });
    }
    await b.post(mount.href("/sign-up/email", { locale: "en-US" }), { name: NAME, email: EMAIL, password: PASSWORD });
    await b.post(mount.href("/sign-in/email", { locale: "en-US" }), { email: EMAIL, password: PASSWORD });
    expect((await b.json("GET", "/api/me")).status).toBe(200);
    for (const path of ["/sessions/tally", "/sessions/list"]) {
      const res = await b.json("GET", path);
      expect({ path, status: res.status, denied: res.text.includes("keel.denied") }).toEqual({
        path,
        status: 403,
        denied: true,
      });
    }
    await app.close();
  });
});
