// Spec: k.compiler, clause "A file with a syntax error yields only E1000, also in `routes.ts` at build time."
// Spec: k.compiler, clause "A `routes.ts` throwing a plain Error is E1006; throwing `{ code: 'E1502' }` keeps E1502."
// k.compiler Build-time evaluation, Rules E1000/E1006/E1049, Conformance and
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { afterEach, beforeEach, expect, test } from "vitest";

const packages = path.dirname(fs.realpathSync(path.join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
let root = "";
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-bev-"));
  fs.mkdirSync(path.join(root, "node_modules", "@keel"), { recursive: true });
  for (const p of fs.readdirSync(packages))
    if (fs.existsSync(path.join(packages, p, "package.json")))
      fs.symlinkSync(path.join(packages, p), path.join(root, "node_modules", "@keel", p));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

async function warningsFor(routesTs: string): Promise<string[]> {
  const file = path.join(root, "modules", "m", "routes.ts");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, routesTs);
  const warnings: string[] = [];
  const p = keel();
  p.configResolved({ root, command: "build" });
  await p.buildStart.call({ warn: (m: string) => void warnings.push(m) });
  return warnings;
}

test("a routes.ts throwing a plain Error is E1006 with the message", { timeout: 30000 }, async () => {
  const w = await warningsFor(`throw new Error("boom");\nexport const routes = {};\n`);
  const hit = w.filter((m) => m.startsWith("keel: E1006"));
  expect(hit).toHaveLength(1);
  expect(hit[0]).toContain("boom");
});

test("a routes.ts throwing { code: 'E1502' } keeps E1502", { timeout: 30000 }, async () => {
  const w = await warningsFor(`throw Object.assign(new Error("dup"), { code: "E1502" });\nexport const routes = {};\n`);
  expect(w.some((m) => m.startsWith("keel: E1502 dup"))).toBe(true);
  expect(w.some((m) => m.startsWith("keel: E1006"))).toBe(false);
});

test("a routes.ts with a syntax error is E1000 at build time", { timeout: 30000 }, async () => {
  const w = await warningsFor("export const routes = {;\n");
  expect(w.some((m) => m.startsWith("keel: E1000"))).toBe(true);
});

test(
  "every warning of a routes.ts syntax-error build is E1000 and names routes.ts with line and column",
  { timeout: 30000 },
  async () => {
    const w = await warningsFor("export const routes = {;\n");
    const keelWarnings = w.filter((m) => m.startsWith("keel: "));
    expect(keelWarnings.length).toBeGreaterThan(0);
    for (const m of keelWarnings) expect(m).toMatch(/^keel: E1000\b/);
    expect(keelWarnings.some((m) => /routes\.ts:\d+:\d+/.test(m))).toBe(true);
  },
);
