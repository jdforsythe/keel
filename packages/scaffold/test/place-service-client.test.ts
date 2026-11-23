// k.scaffold Guarantee: `place` of a module holding a `service({ base })` onto a `client` deployable that does not
// declare the origin would leave E1571, so it is E1353 and writes nothing; with the origin declared it applies.
import { expect, it } from "vitest";
import { scaffold } from "../src/index.ts";
import { type Files, apply } from "./helpers.ts";

function project(): Files {
  let files = apply("project", { name: "shop", adapter: "node" }, new Map());
  files = apply("module", { id: "orders" }, files);
  return apply("service", { id: "orders", base: "https://api.example.com/v1" }, files);
}

it("place onto a new client deployable is E1353 naming E1571, nothing written", () => {
  const files = project();
  const r = scaffold("place", { module: "orders", to: "site", adapter: "client" }, files);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error.data.code).toBe("E1353");
  expect(r.error.data.cause?.code).toBe("E1571");
  expect(r.error.data.message).toContain("https://api.example.com");
});

it("place onto a client deployable that declares the origin applies", () => {
  const files = project();
  const topology = (files.get("topology.ts") ?? "").replace(
    "});",
    `  site: { modules: ["app"], adapter: "client", origins: { connect: { "https://api.example.com": "order list" } } },\n});`,
  );
  const moved = new Map(files).set(
    "topology.ts",
    topology.replace(`modules: ["app", "orders"]`, `modules: ["orders"]`),
  );
  const r = scaffold("place", { module: "orders", to: "site" }, moved);
  expect(r.ok).toBe(true);
});

it("place onto a node deployable applies whatever the base", () => {
  const r = scaffold("place", { module: "orders", to: "jobs", adapter: "node" }, project());
  expect(r.ok).toBe(true);
});
