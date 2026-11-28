// Spec: k.realm, clause "`server.mjs` of a fixture, imported after a copy of `@keel/schema` from another folder was evaluated in its process, prints one `diag` with code E1765 naming both URLs and exits 1, with no E1577 record."
// Seed 1337 (no generated input: one process scenario). Spawns node on a wrapper beside the built `server.mjs` of the leave-process fixture; the child is killed in `afterEach`.
// Reading: the copy is evaluated in the child's process by a wrapper that imports it first and then `server.mjs`; the entry reads the refusal its own evaluation raises and prints it as a coded `diag`.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { buildLeaveFixture, freePort } from "./leave-process-fixture.ts";
import { REPO, deployEnv } from "./topology-build-fixture.ts";

let fixture = "";
let copy = "";
const children: ReturnType<typeof spawn>[] = [];
beforeAll(() => {
  fixture = buildLeaveFixture();
  copy = path.join(fixture, "vendor", "schema");
  fs.cpSync(path.join(REPO, "packages", "schema"), copy, {
    recursive: true,
    filter: (p) =>
      !/(^|\/)(node_modules|dist|reports|conformance|test|docs|\.stryker-tmp)(\/|$)/.test(
        p.slice(path.join(REPO, "packages", "schema").length),
      ),
  });
  fs.symlinkSync(path.join(REPO, "packages", "schema", "node_modules"), path.join(copy, "node_modules"));
  fs.writeFileSync(
    path.join(fixture, "dist", "web", "two-copies.mjs"),
    `import ${JSON.stringify(pathToFileURL(path.join(copy, "src", "index.ts")).href)};\nawait import("./server.mjs");\n`,
  );
}, fixedTime(120_000));
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));
afterEach(() => {
  for (const c of children.splice(0)) c.kill("SIGKILL");
});

test(
  "`server.mjs` of a fixture, imported after a copy of `@keel/schema` from another folder was evaluated in its process, prints one `diag` with code E1765 naming both URLs and exits 1, with no E1577 record",
  async () => {
    const port = await freePort();
    const child = spawn(process.execPath, [path.join(fixture, "dist", "web", "two-copies.mjs")], {
      cwd: fixture,
      env: deployEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32), KEEL_FORMAT: "json" }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    let text = "";
    child.stdout?.on("data", (d: Buffer) => void (text += d.toString()));
    child.stderr?.on("data", (d: Buffer) => void (text += d.toString()));
    const code = await new Promise<number | null>((resolve) => child.on("close", (c) => resolve(c)));
    const diags = text
      .split("\n")
      .filter((l) => l.startsWith("{"))
      .map((l): unknown => JSON.parse(l))
      .filter((r) => typeof r === "object" && r !== null && Reflect.get(r, "kind") === "diag");
    const e1765 = diags.filter((r) => typeof r === "object" && r !== null && Reflect.get(r, "code") === "E1765");
    expect(e1765, text).toHaveLength(1);
    const message = String(typeof e1765[0] === "object" && e1765[0] !== null ? Reflect.get(e1765[0], "message") : "");
    expect(message).toContain("two copies of @keel/schema in one realm: ");
    expect(message).toContain(pathToFileURL(copy).href);
    expect(message).toContain(pathToFileURL(path.join(REPO, "packages", "schema")).href);
    expect(code).toBe(1);
    expect(text).not.toContain("E1577");
  },
  testTime(30_000),
);
