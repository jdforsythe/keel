// S0019 (create-quiet.mjs): the reach of create-app's bin names no process or network API.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createQuiet } from "../create-quiet.mjs";
import { tempDir } from "../test-tmp.ts";

const REPO = path.join(import.meta.dirname, "..", "..");

function fakeRoot(files: Record<string, string>): string {
  const root = tempDir("keel-create-quiet-");
  for (const [p, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
    fs.writeFileSync(path.join(root, p), text);
  }
  return root;
}

describe("S0019", () => {
  it("passes the repository's create-app", async () => {
    const r = await createQuiet(REPO);
    expect(r.files).toBeGreaterThan(10);
    expect(r.diags).toEqual([]);
  });

  it("reports a process module, a network module and fetch anywhere in the reach, and not in a comment or string", async () => {
    const root = fakeRoot({
      "packages/create-app/src/bin.ts": 'import "./a.ts";\n// fetch(x) in a comment\nconst s = "fetch(";\n',
      "packages/create-app/src/a.ts":
        'import { spawn } from "node:child_process";\nimport http from "http";\nexport const go = () => fetch("x");\nvoid spawn; void http;\n',
    });
    const r = await createQuiet(root);
    expect(r.diags.map((d: { code: string; path: string; line: number }) => `${d.code} ${d.path}:${d.line}`)).toEqual([
      "S0019 packages/create-app/src/a.ts:1",
      "S0019 packages/create-app/src/a.ts:1",
      "S0019 packages/create-app/src/a.ts:3",
    ]);
  });
});
