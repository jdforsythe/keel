// Spec: k.scaffold, clause "`--sync` restores an edited block and copy, keeps text outside the block, reruns as no-op; creates absent files; keeps a `CLAUDE.md`, linked or not."
// k.explain, Agent files "`keel docs --sync` writes them all or none, replacing or appending the block."
// Seed: none. Red: `keel docs` is absent (E1051), so --sync writes nothing and the scaffold writes no agent files.
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  drop,
  put,
  tryRead,
  END,
  PKG,
  START,
  blockOf,
  cleanup,
  countLines,
  diffPaths,
  keel,
  projectWith,
  readTree,
  scaffolded,
  skillIds,
  skillPath,
} from "./agent-files-support.ts";

let dir = "";
let proj = "";
let fresh = new Map<string, string>();
let synced = new Map<string, string>();
let again = new Map<string, string>();
let againStatus: number | null = null;
const OUTSIDE = "My own note outside the block.\n";
let skill = "";

beforeAll(() => {
  ({ dir, proj } = scaffolded());
  fresh = readTree(proj);
  skill = skillIds(proj)[0] ?? "keel-client";
  const agents = fresh.get("AGENTS.md") ?? "";
  const edited = `${agents.replace(START, `${START}\nTAMPERED`)}${OUTSIDE}`;
  put(join(proj, "AGENTS.md"), edited);
  put(join(proj, skillPath(skill)), "edited copy\n");
  keel(proj, ["docs", "--sync"]);
  synced = readTree(proj);
  const second = keel(proj, ["docs", "--sync"]);
  againStatus = second.status;
  again = readTree(proj);
}, 120000);
afterAll(() => cleanup(dir));

describe("k.scaffold keel docs --sync", () => {
  it("--sync restores an edited block", () => {
    expect(blockOf(synced.get("AGENTS.md") ?? "")).toBe(blockOf(fresh.get("AGENTS.md") ?? ""));
    expect(blockOf(fresh.get("AGENTS.md") ?? "").length).toBeGreaterThan(0);
  });

  it("--sync restores an edited copy", () => {
    expect(synced.get(skillPath(skill))).toBe(fresh.get(skillPath(skill)));
    expect(fresh.has(skillPath(skill))).toBe(true);
  });

  it("--sync keeps text outside the block", () => {
    expect(synced.get("AGENTS.md")).toContain(OUTSIDE);
  });

  it("a second --sync changes no file", () => {
    expect(againStatus).toBe(0);
    expect(diffPaths(synced, again)).toEqual([]);
    expect(countLines(again.get("AGENTS.md") ?? "", START)).toBe(1);
  });

  it("in a project without AGENTS.md or CLAUDE.md, --sync creates both", () => {
    const d = projectWith({ "package.json": PKG });
    try {
      const r = keel(d, ["docs", "--sync"]);
      const t = readTree(d);
      expect(r.status).toBe(0);
      expect(blockOf(t.get("AGENTS.md") ?? "").length).toBeGreaterThan(0);
      expect(t.get("CLAUDE.md")).toBe("@AGENTS.md\n");
    } finally {
      cleanup(d);
    }
  });

  it("an existing CLAUDE.md stays byte for byte", () => {
    const mine = "my own claude notes\n";
    const d = projectWith({ "package.json": PKG, "CLAUDE.md": mine });
    try {
      keel(d, ["docs", "--sync"]);
      expect(tryRead(join(d, "CLAUDE.md"))).toBe(mine);
      expect(readTree(d).has("AGENTS.md")).toBe(true);
    } finally {
      cleanup(d);
    }
  });

  it("an AGENTS.md without a block keeps its text and gains the block after it", () => {
    const mine = "# My project\n\nRules of mine.\n";
    const d = projectWith({ "package.json": PKG, "AGENTS.md": mine });
    try {
      const r = keel(d, ["docs", "--sync"]);
      const a = tryRead(join(d, "AGENTS.md"));
      expect(r.status).toBe(0);
      expect(a.startsWith(mine)).toBe(true);
      expect(a.indexOf(START)).toBeGreaterThanOrEqual(mine.length);
      expect(countLines(a, END)).toBe(1);
    } finally {
      cleanup(d);
    }
  });
});
