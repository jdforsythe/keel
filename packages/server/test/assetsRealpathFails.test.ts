// When the real path of `assets/` cannot be read while its listing can (k.server Build), loadAssets admits no file:
// an unknown prefix fails closed, so the entry is missing (E1555) and no symlink target is ever read.
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, expect, it, vi } from "vitest";
import { loadAssets } from "../src/internal/loadAssets.ts";

vi.mock("node:fs/promises", async (original) => {
  const real = await original<typeof import("node:fs/promises")>();
  return {
    ...real,
    realpath: (p: string) => (p.endsWith(`${path.sep}assets`) ? Promise.reject(new Error("EACCES")) : real.realpath(p)),
  };
});

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

it("an unreadable real path of assets/ admits nothing, not even a symlink to a secret", async () => {
  const d = tempDir("keel-realpath-");
  made.push(d);
  fs.mkdirSync(path.join(d, ".vite"));
  fs.mkdirSync(path.join(d, "assets"));
  fs.writeFileSync(
    path.join(d, ".vite", "manifest.json"),
    JSON.stringify({ e: { file: "assets/leak.js", isEntry: true } }),
  );
  fs.writeFileSync(path.join(d, "secret.js"), "secret");
  fs.symlinkSync(path.join(d, "secret.js"), path.join(d, "assets", "leak.js"));
  await expect(loadAssets(d)).rejects.toThrow("E1555 assets: .vite/manifest.json entry assets/leak.js is missing");
});
