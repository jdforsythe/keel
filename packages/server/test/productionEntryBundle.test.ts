// The generated production entry `dist/<name>/server.mjs` of a `keel build` fixture carries no parser or build tool,
// so the built server starts wherever Node runs, with no native binding to resolve.
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildNodeFixture } from "../conformance/topology-build-fixture.ts";

let fixture = "";
beforeAll(() => {
  fixture = buildNodeFixture();
}, 90_000);
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
});
