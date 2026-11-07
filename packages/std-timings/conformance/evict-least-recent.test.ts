// Spec: std.timings, clause "After 256 other names, `time(ctx, 'db', fn)` keeps `db` in `timingsOf(ctx)`, and `timings.recent` reports `dropped: 1`."
// @vitest-environment happy-dom
// Example test, no randomness; sim ctx seed 1337.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { createApp, topology } from "@keel/server";
import { time, timingsOf } from "@keel/std-timings";
import { expect, test } from "vitest";

const routes = manifest({
  "app.home": {
    path: "/",
    component: () => {
      const e = document.createElement("main");
      e.append("home");
      return e;
    },
  },
});

test("After 256 other names, `time(ctx, 'db', fn)` keeps `db` in `timingsOf(ctx)`, and `timings.recent` reports `dropped: 1`", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  for (let i = 0; i < 256; i++) {
    await time(ctx, `GET /u/${i}`, () => Promise.resolve(0));
  }
  await time(ctx, "db", () => Promise.resolve(0));
  const t = timingsOf(ctx);
  expect(t.db?.count).toBe(1);
  expect(Object.keys(t)).toHaveLength(256);
  expect(t["GET /u/0"]).toBeUndefined();
  expect(t["GET /u/1"]).toBeDefined();

  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
  });
  const res = await app.fetch(new Request("http://localhost/__keel/inspect"));
  const body: unknown = await res.json();
  const sections = Reflect.get(Object(body), "sections");
  const section = Reflect.get(Object(sections), "timings.recent");
  const value = Reflect.get(Object(section), "value");
  expect(Reflect.get(Object(value), "dropped")).toBe(1);
});
