import { describe, expect, it } from "vitest";
import { orphansIn } from "../orphans.mjs";

const ROOT = "/work/keel";
const ps = [
  "    1     0 05-09:04:34 /sbin/launchd",
  "  500     1    11:26 node /work/keel/packages/cli/src/bin.ts dev --port 58616 --format=json",
  "  501   500    11:25 /work/keel/node_modules/.pnpm/esbuild/bin/esbuild --service=0.28.2",
  "  502     1    02:10 node /work/keel/node_modules/.bin/vitest run",
  "  503     1    00:40 node /work/keel/node_modules/@stryker-mutator/core/bin/stryker.js run",
  "  504     1    00:41 node /work/keel/tooling/mutate.mjs",
  "  505     1    09:00 node /work/keel-other/packages/cli/src/bin.ts dev",
  "  506     1    00:01 node /work/keel/tooling/orphans.mjs",
  "",
].join("\n");

describe("orphansIn", () => {
  it("lists a process of the worktree whose parent is gone", () => {
    expect(orphansIn(ps, ROOT, 506)).toEqual([
      { pid: 500, age: "11:26", command: "node /work/keel/packages/cli/src/bin.ts dev --port 58616 --format=json" },
      { pid: 502, age: "02:10", command: "node /work/keel/node_modules/.bin/vitest run" },
    ]);
  });
  it("leaves a child of a live parent, another worktree, a mutation run and itself", () => {
    const pids = orphansIn(ps, ROOT, 506).map((o) => o.pid);
    for (const pid of [501, 503, 504, 505, 506]) expect(pids).not.toContain(pid);
  });
  it("is empty for text with no process line", () => {
    expect(orphansIn("\n\n", ROOT, 1)).toEqual([]);
  });
});
