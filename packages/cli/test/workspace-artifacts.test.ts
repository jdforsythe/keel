// Backlog 0144 (rfc:0055): in a workspace, `keel check` compares every app's `.keel/` with that app's own sources,
// and reports the same files from the root as from inside the app. Runs the engine over a temp workspace on disk.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyWrites } from "../src/internal/applyWrites.ts";
import { readProject } from "../src/internal/readProject.ts";
import { run } from "../src/run.ts";

let root = "";
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const io = (cwd: string) => ({
  cwd,
  env: {},
  tty: false,
  load: (scope: "none" | "query" | "ledger" | "tree") => (scope === "none" ? [] : readProject(cwd, scope)),
  apply: (writes: Parameters<typeof applyWrites>[1]) => applyWrites(cwd, writes),
});
interface Rec {
  kind?: unknown;
  code?: unknown;
  path?: unknown;
  counts?: { files?: unknown };
}
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
async function check(cwd: string, args: string[]): Promise<{ files: unknown; e1005: unknown[] }> {
  const r = await run(["check", ...args, "--format=json"], io(cwd));
  const records = r.stdout
    .split("\n")
    .filter((l) => l !== "")
    .map((l): unknown => JSON.parse(l))
    .filter(isRec);
  return {
    files: records.find((x) => x.kind === "summary")?.counts?.files,
    e1005: records.filter((x) => x.code === "E1005").map((x) => x.path),
  };
}

const A = 'export default function A() {\n  return <p id="a.p">a</p>\n}\n';
const B = 'export default function B() {\n  return <p id="b.p">b</p>\n}\n';

beforeAll(async () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "keel-workspace-")));
  put("package.json", "{}\n");
  put("apps/a/package.json", "{}\n");
  put("apps/a/src/A.tsx", A);
  put("apps/b/package.json", "{}\n");
  put("apps/b/src/B.tsx", B);
  for (const app of ["apps/a", "apps/b"]) expect((await run(["build"], io(join(root, app)))).code).toBe(0);
}, 60_000);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("keel check in a workspace (0144)", () => {
  it("counts the same files for an app from the root and from inside it, artifacts included, all genuine", async () => {
    const inside = await check(join(root, "apps/a"), []);
    const fromRoot = await check(root, ["apps/a"]);
    expect(inside.files).toBe(6); // src/A.tsx and the five artifacts `keel build` writes
    expect(fromRoot).toEqual(inside);
    expect((await check(root, [])).e1005).toEqual([]);
  });

  it("reports a forged app artifact from the root, compared with that app's own sources only", async () => {
    const file = join(root, "apps/b/.keel/ids.json");
    const genuine = readFileSync(file, "utf8");
    // apps/a's ids.json is self-consistent but compiled from A.tsx: forged for apps/b.
    chmodSync(file, 0o644);
    writeFileSync(file, readFileSync(join(root, "apps/a/.keel/ids.json"), "utf8"));
    try {
      expect((await check(root, [])).e1005).toEqual(["apps/b/.keel/ids.json"]);
      expect((await check(root, ["apps/b/.keel"])).e1005).toEqual(["apps/b/.keel/ids.json"]);
      expect((await check(join(root, "apps/b"), [])).e1005).toEqual([".keel/ids.json"]);
    } finally {
      writeFileSync(file, genuine);
    }
  });
});
