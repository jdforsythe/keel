// In a workspace, `keel check --frozen` compares every app's `.keel/` views with that app's own sources, and `keel
// check` reports the same files from the root as from inside the app (k.derived). Runs the engine over a temp
// workspace on disk.
import { chmodSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
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
  load: (scope: "none" | "docs" | "query" | "ledger" | "tree") =>
    scope === "none" || scope === "docs" ? [] : readProject(cwd, scope),
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

const UI_TYPES = 'declare module "@keel/ui" { export function Box(p: { id: string; children?: string }): null }\n';
const A = 'import { Box } from "@keel/ui"\nexport default function A() {\n  return <Box id="a.p">a</Box>\n}\n';
const B = 'import { Box } from "@keel/ui"\nexport default function B() {\n  return <Box id="b.p">b</Box>\n}\n';

beforeAll(async () => {
  root = realpathSync(tempDir("keel-workspace-"));
  put("package.json", "{}\n");
  put("apps/a/package.json", "{}\n");
  // The temporary workspace has no `@keel/ui` to resolve, so each app types the import itself.
  put("apps/a/src/uiTypes.ts", UI_TYPES);
  put("apps/a/src/A.tsx", A);
  put("apps/b/package.json", "{}\n");
  put("apps/b/src/uiTypes.ts", UI_TYPES);
  put("apps/b/src/B.tsx", B);
  for (const app of ["apps/a", "apps/b"]) expect((await run(["build"], io(join(root, app)))).code).toBe(0);
}, fixedTime(60_000));

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("keel check in a workspace (0144)", () => {
  it("counts the same files for an app from the root and from inside it, all genuine", async () => {
    const inside = await check(join(root, "apps/a"), []);
    const fromRoot = await check(root, ["apps/a"]);
    expect(inside.files).toBe(10); // src/A.tsx, src/uiTypes.ts and the eight views `keel build` keeps
    expect(fromRoot).toEqual(inside);
    const frozen = await check(join(root, "apps/a"), ["--frozen"]);
    expect(frozen.files).toBe(10); // and, frozen, the eight views `keel build` keeps
    expect(frozen.e1005).toEqual([]);
    expect(await check(root, ["apps/a", "--frozen"])).toEqual(frozen);
    expect((await check(root, ["--frozen"])).e1005).toEqual([]);
  });

  it("reports a forged app artifact from the root, compared with that app's own sources only", async () => {
    const file = join(root, "apps/b/.keel/ids.json");
    const genuine = readFileSync(file, "utf8");
    // apps/a's ids.json is self-consistent but compiled from A.tsx: forged for apps/b.
    chmodSync(file, 0o644);
    writeFileSync(file, readFileSync(join(root, "apps/a/.keel/ids.json"), "utf8"));
    try {
      expect((await check(root, ["--frozen"])).e1005).toEqual(["apps/b/.keel/ids.json"]);
      expect((await check(root, ["apps/b/.keel", "--frozen"])).e1005).toEqual(["apps/b/.keel/ids.json"]);
      expect((await check(join(root, "apps/b"), ["--frozen"])).e1005).toEqual([".keel/ids.json"]);
      expect((await check(root, [])).e1005).toEqual([]);
      expect(readFileSync(file, "utf8")).toBe(genuine);
    } finally {
      chmodSync(file, 0o644);
      writeFileSync(file, genuine);
    }
  });
});
