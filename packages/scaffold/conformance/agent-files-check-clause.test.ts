// Spec: k.scaffold "`keel check`: fresh, no W1356; an edited or removed copy or edited block, one W1356 there; no block, none. Unclosed block: `--sync` E1355, exit 1, writes nothing."
// Seed: none (examples; each spawns the real `keel` binary).
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  START,
  cleanup,
  diffPaths,
  drop,
  keel,
  put,
  readTree,
  scaffolded,
  skillIds,
  skillPath,
  tryRead,
} from "./agent-files-support.ts";

let dir = "";
let proj = "";
let skill = "keel-client";
const w1356 = (): { path: unknown }[] =>
  keel(proj, ["check"])
    .records.filter((r) => r.kind === "diag" && r.code === "W1356")
    .map((r) => ({ path: r.path }));

beforeAll(() => {
  ({ dir, proj } = scaffolded());
  skill = skillIds(proj)[0] ?? skill;
});
afterAll(() => cleanup(dir));

describe("k.scaffold keel check and agent files", () => {
  it("`keel check` on a fresh project reports no W1356", () => {
    expect(w1356()).toEqual([]);
  });

  it("an edited copy, a removed copy and an edited block each report one W1356 at that file", () => {
    const copy = join(proj, skillPath(skill));
    const copyText = tryRead(copy);
    put(copy, `${copyText}\nextra\n`);
    expect(w1356()).toEqual([{ path: skillPath(skill) }]);
    drop(copy);
    expect(w1356()).toEqual([{ path: skillPath(skill) }]);
    put(copy, copyText);
    const agents = join(proj, "AGENTS.md");
    const agentsText = tryRead(agents);
    put(agents, agentsText.replace(START, `${START}\nTAMPERED`));
    expect(w1356()).toEqual([{ path: "AGENTS.md" }]);
    put(agents, agentsText);
  });

  it("an AGENTS.md with no block reports no W1356", () => {
    put(join(proj, "AGENTS.md"), "# mine\n");
    drop(join(proj, skillPath(skill)));
    expect(w1356()).toEqual([]);
  });

  it("an unclosed block: `keel docs --sync` is E1355, exit 1, and writes nothing", () => {
    put(join(proj, "AGENTS.md"), `# mine\n${START}\nold\n`);
    const before = readTree(proj);
    const r = keel(proj, ["docs", "--sync"]);
    expect(r.status).toBe(1);
    expect(r.records.some((x) => x.kind === "diag" && x.code === "E1355")).toBe(true);
    expect(diffPaths(before, readTree(proj))).toEqual([]);
  });
});
