// The Vite plugin before `configResolved`: it compiles a module but writes no `.keel/` artifact under the working
// directory it started in.
import fs from "node:fs";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let root = "";
beforeEach(() => {
  root = fs.mkdtempSync(path.join(import.meta.dirname, ".tmp-vite-unresolved-"));
  vi.spyOn(process, "cwd").mockReturnValue(root);
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

it("writes no .keel/ under the working directory when configResolved never ran", () => {
  const p = keel();
  const a = path.join(root, "src/A.tsx");
  expect(p.transform("export default function A() { return <p>a</p> }", a)?.code).toContain("template(");
  p.watchChange(a, { event: "delete" });
  expect(fs.existsSync(path.join(root, ".keel"))).toBe(false);
});

it("writes .keel/ under the resolved root once configResolved ran", () => {
  const p = keel();
  p.configResolved({ root });
  p.transform("export default function A() { return <p>a</p> }", path.join(root, "src/A.tsx"));
  expect(fs.readdirSync(path.join(root, ".keel")).sort()).toContain("ids.json");
});
