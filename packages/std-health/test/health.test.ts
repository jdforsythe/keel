// @vitest-environment happy-dom
// Seed 1337
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { Health } from "../src/Health.ts";
import { routes } from "../src/routes.ts";
import { expect, test } from "vitest";

test("Health accepts the ok report and nothing else", () => {
  expect(Health.parse({ status: "ok", at: 5 }).ok).toBe(true);
  expect(Health.parse({ status: "down", at: 5 }).ok).toBe(false);
  expect(Health.parse({ status: "", at: 5 }).ok).toBe(false);
  expect(Health.parse({ status: "ok", at: "5" }).ok).toBe(false);
  expect(Health.parse({ status: "ok" }).ok).toBe(false);
  expect(Health.parse({ status: "ok", at: 5, extra: true }).ok).toBe(false);
  expect(Health.parse(undefined).ok).toBe(false);
  expect(Health.parse({}).ok).toBe(false);
});

async function serve() {
  return createApp({
    topology: topology({ web: { modules: ["health"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
}

test("the page of health.status is a main with id health.status holding the status text", async () => {
  const app = await serve();
  const res = await app.fetch(new Request("http://localhost/health", { headers: { accept: "text/html" } }));
  expect(res.status).toBe(200);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const main = doc.getElementById("health.status");
  expect(main?.tagName).toBe("MAIN");
  expect(main?.textContent).toBe("ok");
});

test("the route table holds health.status at /health, answering with the loader result", async () => {
  expect(Object.keys(routes.routes)).toEqual(["health.status"]);
  const app = await serve();
  const res = await app.fetch(new Request("http://localhost/health", { headers: { accept: "application/json" } }));
  const body: unknown = await res.json();
  const result: unknown = Reflect.get(Object(Reflect.get(Object(body), "results")), "health.status");
  expect(Reflect.get(Object(result), "ok")).toBe(true);
  expect(Reflect.get(Object(Reflect.get(Object(result), "value")), "status")).toBe("ok");
});
