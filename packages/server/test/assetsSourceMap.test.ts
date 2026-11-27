// A client build whose Vite config turns on `build.sourcemap` writes `*.map` files beside its chunks under `assets/`,
// each holding the client sources (`sourcesContent`). They are not to be read or served; see the RFC on client maps.
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, describe, expect, it } from "vitest";
import { loadAssets } from "../src/internal/loadAssets.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const dir = (files: Record<string, string>): string => {
  const d = tempDir("keel-maps-");
  made.push(d);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
    fs.writeFileSync(path.join(d, rel), text);
  }
  return d;
};

describe("client source maps under assets/", () => {
  it("are not loaded, so no request reaches them", async () => {
    const d = dir({
      ".vite/manifest.json": JSON.stringify({ e: { file: "assets/entry-Ab12Cd34.js", isEntry: true } }),
      "assets/entry-Ab12Cd34.js": "resume()\n//# sourceMappingURL=entry-Ab12Cd34.js.map",
      "assets/entry-Ab12Cd34.js.map": JSON.stringify({ version: 3, sources: ["a.ts"], sourcesContent: ["secret"] }),
      "assets/nested/chunk-Zz99Yy88.css.map": "{}",
    });
    const built = await loadAssets(d);
    expect([...built.files.keys()].sort()).toEqual(["/assets/entry-Ab12Cd34.js"]);
  });
});
