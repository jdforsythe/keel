// Spec: k.scaffold "`keel check`: fresh, no W1356; an edited or removed copy or edited block, one W1356 there; no block, none."
// k.scaffold Rules W1356 "agent file stale or block malformed (`keel docs --sync`)"; k.docs D5 "at the file's path, line 1".
// Seed: none. Red: no agent files are scaffolded and `keel check` never reports W1356.
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drop, put, tryRead, START, cleanup, keel, scaffolded, skillIds, skillPath } from "./agent-files-support.ts";

let dir = "";
let proj = "";
let skill = "keel-client";
const w1356 = (): { path: unknown; line: unknown }[] =>
  keel(proj, ["check"])
    .records.filter((r) => r.kind === "diag" && r.code === "W1356")
    .map((r) => ({ path: r.path, line: r.line }));

beforeAll(() => {
  ({ dir, proj } = scaffolded());
  skill = skillIds(proj)[0] ?? skill;
});
afterAll(() => cleanup(dir));

describe("k.scaffold W1356", () => {
  it("keel check on a fresh scaffolded project reports no W1356 (and AGENTS.md holds the block)", () => {
    expect(tryRead(join(proj, "AGENTS.md"))).toContain(START);
    expect(w1356()).toEqual([]);
  });

  it("with one copy edited, keel check reports one W1356 at that copy's path, line 1", () => {
    const p = join(proj, skillPath(skill));
    const original = tryRead(p);
    put(p, `${original}\nextra\n`);
    expect(w1356()).toEqual([{ path: skillPath(skill), line: 1 }]);
    put(p, original);
  });

  it("with one copy removed, keel check reports one W1356 at that copy's path", () => {
    const p = join(proj, skillPath(skill));
    const original = tryRead(p);
    drop(p);
    expect(w1356()).toEqual([{ path: skillPath(skill), line: 1 }]);
    put(p, original);
  });

  it("with the block edited, keel check reports one W1356 at AGENTS.md", () => {
    const p = join(proj, "AGENTS.md");
    const original = tryRead(p);
    put(p, original.replace(START, `${START}\nTAMPERED`));
    expect(w1356()).toEqual([{ path: "AGENTS.md", line: 1 }]);
    put(p, original);
  });

  it("a project whose AGENTS.md has no block reports no W1356, even with a copy removed", () => {
    put(join(proj, "AGENTS.md"), "# mine\n");
    drop(join(proj, skillPath(skill)));
    expect(w1356()).toEqual([]);
  });
});
