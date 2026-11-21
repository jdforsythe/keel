import { s } from "@keel/schema";
import { Health } from "@keel/std-health/Health";
import { health } from "@keel/std-health/contract";
import { describe, expect, it } from "vitest";
import { NOW, apiApp, apiCtx, asJson } from "./simApi.ts";

/** The runtime body of `GET /health` asked for as JSON (k.server): the `health.status` loader `Result`. */
const HealthBody = s.object({
  id: s.literal("health.status"),
  results: s.object({ "health.status": s.object({ ok: s.literal(true), value: Health }) }),
});

describe("the api deployable's health route", () => {
  it("is the health module's contract entry at /health", () => {
    expect(health.module).toBe("health");
    expect(health.entries["health.status"].path).toBe("/health");
    expect(health.href("health.status")).toBe("/health");
  });
  it("answers GET /health with ok and the server clock's time", async () => {
    const server = apiCtx();
    const app = await apiApp(server);
    const res = await app.fetch(asJson("GET", health.href("health.status")));
    expect(res.status).toBe(200);
    const body = HealthBody.parse(await res.json());
    expect(body.ok && body.value.results["health.status"].value).toEqual({ status: "ok", at: NOW });
    server.clock.advance(5_000);
    const later = HealthBody.parse(await (await app.fetch(asJson("GET", "/health"))).json());
    expect(later.ok && later.value.results["health.status"].value.at).toBe(NOW + 5_000);
  });
  it("answers a probe that asks for no media type with a document that says ok", async () => {
    const app = await apiApp(apiCtx());
    const res = await app.fetch(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain(">ok</main>");
  });
  it("refuses a POST: the route has no action", async () => {
    const app = await apiApp(apiCtx());
    const res = await app.fetch(asJson("POST", "/health", {}));
    expect(res.status).toBe(405);
  });
});
