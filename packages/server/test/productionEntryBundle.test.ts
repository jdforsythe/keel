// The generated production entry `dist/<name>/server.mjs` of a `keel build` fixture carries no parser or build tool,
// so the built server starts wherever Node runs, with no native binding to resolve.
import fs from "node:fs";
import path from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildNodeFixture } from "../conformance/topology-build-fixture.ts";

let fixture = "";
beforeAll(() => {
  fixture = buildNodeFixture();
}, fixedTime(90_000));
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));

describe("production entry of a node deployable", () => {
  it("bundles no parser or build tool", () => {
    const text = fs.readFileSync(path.join(fixture, "dist", "web", "server.mjs"), "utf8");
    for (const pkg of ["oxc-parser", "oxc-transform", "rolldown", "vite"]) {
      expect(text, pkg).not.toMatch(new RegExp(`node_modules/${pkg}/|from ["']${pkg}["']`));
    }
    expect(text).not.toContain("oxc-parser");
    expect(text).not.toContain("oxc-transform");
  });

  it("writes server.mjs.map beside it: positions only, sources relative to the project", () => {
    const text = fs.readFileSync(path.join(fixture, "dist", "web", "server.mjs"), "utf8");
    expect(text.trimEnd().endsWith("//# sourceMappingURL=server.mjs.map")).toBe(true);
    const map: unknown = JSON.parse(fs.readFileSync(path.join(fixture, "dist", "web", "server.mjs.map"), "utf8"));
    expect(Reflect.has(Object(map), "sourcesContent")).toBe(false);
    const sources: unknown = Reflect.get(Object(map), "sources");
    const list: readonly unknown[] = Array.isArray(sources) ? sources : [];
    expect(list).toContain("topology.ts");
    for (const s of list) expect(String(s)).not.toMatch(/^\/|^[A-Za-z]:|\\/);
  });
});
