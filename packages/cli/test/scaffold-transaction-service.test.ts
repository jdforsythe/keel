import { describe, expect, it } from "vitest";
import { openapiInput } from "../src/internal/openapiInput.ts";
import { runEngine } from "../src/internal/runEngine.ts";
import { scaffoldInput } from "../src/internal/scaffoldInput.ts";

const CWD = "/work/shop";
const doc = {
  openapi: "3.0.3",
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/pets": {
      get: { operationId: "listPets", responses: { "200": { description: "ok" } } },
    },
  },
};
const files = [{ path: "openapi.json", source: JSON.stringify(doc) }];

describe("scaffold transaction / service input", () => {
  it("transaction maps the first argument to id", () => {
    expect(scaffoldInput("transaction", { args: ["orders.cart.addItem"] })).toEqual({ id: "orders.cart.addItem" });
    expect(scaffoldInput("transaction", {})).toEqual({});
  });

  it("route passes --api through", () => {
    expect(scaffoldInput("route", { args: ["orders.feed"], path: "/api/feed", api: true })).toEqual({
      id: "orders.feed",
      path: "/api/feed",
      api: true,
    });
  });

  it("service passes id with the generated schema and service texts", () => {
    const r = openapiInput("orders", "openapi.json", CWD, new Map(files.map((f) => [f.path, f.source])));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.schema).toContain("listPets");
    expect(r.value.service).toContain("OrdersApi");
    const input = scaffoldInput("service", { args: ["orders"] }, r.value);
    expect(input).toEqual({ id: "orders", schema: r.value.schema, service: r.value.service });
  });

  it("service resolves --openapi against cwd (absolute path)", () => {
    const r = openapiInput("orders", `${CWD}/openapi.json`, CWD, new Map([["openapi.json", JSON.stringify(doc)]]));
    expect(r.ok).toBe(true);
  });

  it("neither --openapi nor --base is E1052 naming both flags", async () => {
    const r = await runEngine(["scaffold", "service", "orders"], { cwd: CWD, files });
    expect(r.result.code).toBe(2);
    expect(r.result.stdout).toContain("E1052");
    expect(r.result.stdout).toContain("--openapi");
    expect(r.result.stdout).toContain("--base");
    expect(r.writes).toEqual([]);
  });

  it("an absent file, bad JSON and a non-OpenAPI document are E1052", async () => {
    const bad = [
      { path: "bad.json", source: "{nope" },
      { path: "empty.json", source: "{}" },
    ];
    for (const f of ["missing.json", "bad.json", "empty.json"]) {
      const r = await runEngine(["scaffold", "service", "orders", "--openapi", f], { cwd: CWD, files: bad });
      expect(r.result.code).toBe(2);
      expect(r.result.stdout).toContain("E1052");
      expect(r.result.stdout).toContain("--openapi");
    }
  });
});
