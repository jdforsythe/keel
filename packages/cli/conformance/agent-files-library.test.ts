// Spec: k.explain, clause "`keel scaffold library @acme/charts` writes in `charts/` `.gitignore`, `AGENTS.md`, `CLAUDE.md` holding `@AGENTS.md` and one `.claude/skills/<name>/SKILL.md` per skill `keel docs` lists, each equal to `keel docs <name>`."
// Spec: k.explain, clause "In that library the block's first sentence holds `Keel library` and the first skill path it lists is `keel-library`'s; the block of `keel scaffold project` holds no `Keel library`; each block is at most 600 tokens."
// Spec: k.explain, clause "In that library `keel check` reports no W1356; an edited skill copy or block is one W1356, `keel docs --sync` restores it and keeps the text outside the block, and a second `--sync` writes nothing."
// k.explain, Agent files "In a folder whose `package.json` has `\"keel\": \"library\"` the block says it is a Keel library and lists `keel-library` first; `keel scaffold library` writes the same files in `<base>/` (k.create)."
// k.explain, Agent files "Where `AGENTS.md` has the block, `keel check` reports W1356 for it or any copy `--sync` would change."
// Seed: none (examples; each case spawns the real `keel`). `keel scaffold library @acme/charts` writes `charts/` (k.library-pack Scaffold: folder `<base>/`).
// Not a Conformance bullet: both clauses are sentences of k.explain "Agent files"; the RFC's Conformance diff names this file for them.
// ASSUMED (spec silent): "the block says it is a Keel library" is asserted as the block's text, before any skill name, containing the words `Keel library`;
// "the same files" is the project's agent set: `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md\n`) and one `.claude/skills/<name>/SKILL.md` per skill `keel docs` lists, plus `.gitignore` (k.create).
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../..", import.meta.url));
const BIN = join(REPO, "packages/cli/src/bin.ts");
const START = "<!-- keel:start -->";
const END = "<!-- keel:end -->";

type Rec = { kind: string; [k: string]: unknown };
const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && typeof Reflect.get(v, "kind") === "string";

function keel(cwd: string, args: string[]): { status: number | null; records: Rec[] } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("VITEST") && k !== "NODE_OPTIONS") env[k] = v;
  }
  const r = spawnSync(process.execPath, [BIN, ...args, "--format=json"], { cwd, encoding: "utf8", env });
  const records: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    try {
      const v: unknown = JSON.parse(line);
      if (isRec(v)) records.push(v);
    } catch {
      // a non-JSON line is ignored
    }
  }
  return { status: r.status, records };
}

function tree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rel: string): void => {
    for (const n of readdirSync(join(dir, rel)).sort()) {
      const p = rel === "" ? n : `${rel}/${n}`;
      if (p === "node_modules") continue;
      if (statSync(join(dir, p)).isDirectory()) walk(p);
      else out.set(p, readFileSync(join(dir, p), "utf8"));
    }
  };
  walk("");
  return out;
}

let work = "";
let lib = "";
let files = new Map<string, string>();
let skills: string[] = [];
const skillPath = (n: string): string => `.claude/skills/${n}/SKILL.md`;

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "keel-agentlib-"));
  mkdirSync(join(work, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages")))
    symlinkSync(join(REPO, "packages", pkg), join(work, "node_modules/@keel", pkg));
  for (const n of ["vitest", "vite", "typescript", "happy-dom", "fast-check"])
    symlinkSync(join(REPO, "node_modules", n), join(work, "node_modules", n));
  const made = keel(work, ["scaffold", "library", "@acme/charts"]);
  if (made.status !== 0) throw new Error(`scaffold library failed: ${JSON.stringify(made.records.slice(0, 5))}`);
  lib = join(work, "charts");
  files = tree(lib);
  skills = readdirSync(join(REPO, "packages/cli/skills"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}, testTime(60_000));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const block = (): string => {
  const a = files.get("AGENTS.md") ?? "";
  const s = a.indexOf(START);
  const e = a.indexOf(END);
  return s < 0 || e < 0 ? "" : a.slice(s, e + END.length);
};
const w1356 = (dir: string): Rec[] =>
  keel(dir, ["check"]).records.filter((r) => r.kind === "diag" && r.code === "W1356");

describe("k.explain Agent files: a library", () => {
  it("`keel scaffold library` writes the same files in `<base>/`: `AGENTS.md`, `CLAUDE.md` holding `@AGENTS.md`, one skill copy per listed skill, and `.gitignore`", () => {
    expect(skills.length).toBeGreaterThan(0);
    expect(files.get("CLAUDE.md")).toBe("@AGENTS.md\n");
    expect(files.has("AGENTS.md")).toBe(true);
    expect(files.has(".gitignore")).toBe(true);
    const copies = [...files.keys()].filter((p) => p.startsWith(".claude/"));
    expect(copies.sort()).toEqual(skills.map(skillPath).sort());
    for (const s of skills) {
      const doc = keel(lib, ["docs", s]).records.find((r) => r.kind === "docs.skill");
      expect(files.get(skillPath(s)), s).toBe(doc?.text);
    }
  });

  it('in a folder whose `package.json` has `"keel": "library"` the block says it is a Keel library', () => {
    expect(JSON.parse(files.get("package.json") ?? "{}").keel).toBe("library");
    const b = block();
    expect(b.length).toBeGreaterThan(0);
    const firstSentence =
      b
        .slice(START.length)
        .trim()
        .split(/(?<=\.)\s/)[0] ?? "";
    expect(firstSentence).toContain("Keel library");
  });

  it("the block lists `keel-library` first among the skills", () => {
    const b = block();
    expect(skills).toContain("keel-library");
    for (const sk of skills) expect(b, sk).toContain(sk);
    const firstListed = [...b.matchAll(/\.claude\/skills\/([\w-]+)\/SKILL\.md/g)][0]?.[1];
    expect(firstListed).toBe("keel-library");
  });

  it("the block is at most 600 tokens and a project's block does not say it is a library", () => {
    expect(block().length).toBeGreaterThan(0);
    expect(Math.ceil(block().length / 4)).toBeLessThanOrEqual(600);
    const proj = mkdtempSync(join(tmpdir(), "keel-agentproj-"));
    try {
      mkdirSync(join(proj, "node_modules"), { recursive: true });
      symlinkSync(join(work, "node_modules/@keel"), join(proj, "node_modules/@keel"));
      const made = keel(proj, ["scaffold", "project", "shop"]);
      expect(made.status).toBe(0);
      const a = readFileSync(join(proj, "shop/AGENTS.md"), "utf8");
      expect(a).not.toContain("Keel library");
    } finally {
      rmSync(proj, { recursive: true, force: true });
    }
  });

  it(
    "where `AGENTS.md` has the block, `keel check` reports no W1356 in a fresh library, one for an edited copy, and `keel docs --sync` restores it",
    () => {
      expect(w1356(lib)).toEqual([]);
      const target = join(lib, skillPath("keel-library"));
      const original = readFileSync(target, "utf8");
      try {
        writeFileSync(target, `${original}\nedited\n`);
        expect(w1356(lib).length).toBe(1);
        const sync = keel(lib, ["docs", "--sync"]);
        expect(sync.status).toBe(0);
        expect(readFileSync(target, "utf8")).toBe(original);
        expect(w1356(lib)).toEqual([]);
        const again = keel(lib, ["docs", "--sync"]);
        expect(again.status).toBe(0);
        expect(tree(lib)).toEqual(files);
      } finally {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, original);
      }
    },
    testTime(120_000),
  );

  it(
    "`keel docs --sync` in a library rewrites an edited block and keeps the text outside it, the library sentence included",
    () => {
      const agents = join(lib, "AGENTS.md");
      const original = readFileSync(agents, "utf8");
      try {
        const edited = original.replace(START, `${START}\nstray line`);
        writeFileSync(agents, `before\n${edited}\nafter\n`);
        expect(w1356(lib).length).toBe(1);
        expect(keel(lib, ["docs", "--sync"]).status).toBe(0);
        const back = readFileSync(agents, "utf8");
        expect(back).toContain("before\n");
        expect(back).toContain("\nafter\n");
        expect(back).not.toContain("stray line");
        expect(back).toContain("Keel library");
      } finally {
        writeFileSync(agents, original);
      }
    },
    testTime(120_000),
  );
});
