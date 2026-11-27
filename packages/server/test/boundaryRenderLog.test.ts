// @vitest-environment happy-dom
// k.serverlog Thrown values: a render throw a route boundary (its errorElement) catches is written as any thrown value
// is, by its form: one `diag` in production, with no thrown text, and the text in a second record under `mode: 'dev'`.
// Seed 1337.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { defect } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

async function run(mode: "dev" | "production", thrown: () => never) {
  const lines: string[] = [];
  const c = contract("app", { "app.e": { path: "/e" } });
  const routes = manifest(c, {
    "app.e": { component: thrown, errorElement: () => document.createElement("section") },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode,
    log: { format: "json", write: (l) => void lines.push(l) },
  });
  const res = await app.fetch(new Request("http://localhost/e", { headers: { accept: "text/html" } }));
  await res.text();
  await app.close();
  const diags = lines
    .map((l): unknown => JSON.parse(l))
    .flatMap((r) => (typeof r === "object" && r !== null && Reflect.get(r, "kind") === "diag" ? [r] : []))
    .map((r) => String(Reflect.get(r, "message")));
  return { status: res.status, diags, lines };
}

describe("a render throw a route boundary catches", () => {
  it("logs its form once in production, holding no thrown text", async () => {
    const { status, diags, lines } = await run("production", () => {
      throw new Error("user jane@x.com failed");
    });
    expect(status).toBe(500);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatch(/^render app\.e threw: Error #[0-9a-f]{8}( at \S+:\d+)?$/);
    expect(lines.join("\n")).not.toContain("jane");
  });

  it("logs a defect by its class and code", async () => {
    const { diags } = await run("production", () => defect("no row", "E2801", { data: { id: "jane" } }));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.startsWith("render app.e threw: Defect E2801 #")).toBe(true);
    expect(diags.join("\n")).not.toContain("jane");
  });

  it("adds the text in a second record under mode: 'dev'", async () => {
    const { diags } = await run("dev", () => {
      throw new Error("user jane@x.com failed");
    });
    expect(diags).toHaveLength(2);
    expect(diags[1]).toBe("render app.e threw: Error: user jane@x.com failed");
  });
});
