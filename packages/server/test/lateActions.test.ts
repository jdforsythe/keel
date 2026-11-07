// @vitest-environment happy-dom
// Backlog 0183 (RFC 0063): actions attached after createApp would skip E1553; the table is sealed instead (E1505).
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const page = (): Node => document.createElement("p");
const save = action({ input: s.object({}) }, async () => ok(null));
const codeOf = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
  return null;
};

describe("actions attached after createApp", () => {
  it("throw E1505 on a static deployable, and a POST there stays 405 with nothing run", async () => {
    const routes = manifest({ "app.home": { path: "/", component: page } });
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "static" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
    });
    expect(codeOf(() => routes.actions({ "app.home": { POST: save } }))).toBe("E1505");
    const res = await app.fetch(
      new Request("http://localhost/", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }),
    );
    expect(res.status).toBe(405);
  });

  it("throw E1505 on a node deployable too; attached before createApp, the static check is E1553", async () => {
    const late = manifest({ "app.home": { path: "/", component: page } });
    await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "node" } }),
      routes: late,
      ctx: createCtx({ mode: "sim", seed: 1337 }),
    });
    expect(codeOf(() => late.actions({ "app.home": { POST: save } }))).toBe("E1505");
    const early = manifest({ "app.home": { path: "/", component: page } });
    early.actions({ "app.home": { POST: save } });
    await expect(
      createApp({
        topology: topology({ web: { modules: ["app"], adapter: "static" } }),
        routes: early,
        ctx: createCtx({ mode: "sim", seed: 1337 }),
      }),
    ).rejects.toThrow(/^E1553/);
  });
});
