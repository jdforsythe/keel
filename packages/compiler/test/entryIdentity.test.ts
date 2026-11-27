// k.user Identity source: the generated entries of each `node` deployable pass the project's `identity.server.ts`.
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";
import { devEntryCode } from "../src/internal/devEntryCode.ts";
import { serverEntryCode } from "../src/internal/serverEntryCode.ts";
import type { Topology } from "../src/types/Topology.ts";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});
const project = (withIdentity: boolean): string => {
  const root = tempDir("keel-entry-who-");
  roots.push(root);
  if (withIdentity) writeFileSync(join(root, "identity.server.ts"), "export default {}\n");
  return root;
};
const topology: Topology = { x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } };

describe("identity in the generated entries", () => {
  it("imports identity.server.ts and passes it to start and to every dev createApp when it exists", () => {
    const root = project(true);
    const file = JSON.stringify(join(root, "identity.server.ts"));
    const prod = serverEntryCode(root, "x", []);
    expect(prod).toContain(`const { default: identity } = await import(${file});`);
    expect(prod).toMatch(/runners: \{ {2}\}, identity, dir:/);
    const dev = devEntryCode(root, topology);
    expect(dev).toContain(`const { default: identity } = await import(${file});`);
    expect(dev.match(/, identity, log \}\);/g)).toHaveLength(2);
  });

  it("passes none without the file", () => {
    const root = project(false);
    expect(serverEntryCode(root, "x", [])).not.toContain("identity");
    expect(devEntryCode(root, topology)).not.toContain("identity");
  });
});
