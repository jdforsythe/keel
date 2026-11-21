// Spec: k.scaffold Rules "E1357 write through a symlink out of the project."
// Spec: k.scaffold "`keel scaffold project <name>`, with or without `--workspace`, writes only under `<name>/`."
// Spec: k.explain, Agent files "`keel docs --sync` writes them all or none". RFC 0151 Conformance diff, the two E1357 bullets.
// Spec: k.explain, Agent files "`CLAUDE.md` holding `@AGENTS.md` when nothing exists there (an existing one is never written, a dangling symlink is E1357)"
// Spec: k.scaffold "`--sync` ... keeps a `CLAUDE.md`, linked or not."
// Seed: none (examples; real temp directories, real symlinks, the real `keel` binary). Also drives `keel mcp` for the MCP path.
// ASSUMED: the `path` of the E1357 diagnostic starts with the linked path (`.claude`, `.claude/skills`, `AGENTS.md`, `CLAUDE.md`);
// the spec names the field `path` and says it is the linked write. Rest of the set written: `AGENTS.md` exists afterwards. The MCP `docs` tool takes `{ sync: true, format: "json" }`.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PKG, diffPaths, put } from "./agent-files-support.ts";
import { cleanup, keel, materialize, readTree, root } from "./keel-cli.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) cleanup(d);
});
const outside = (): string => {
  const d = mkdtempSync(join(tmpdir(), "keel-outside-"));
  made.push(d);
  return d;
};
const project = (files: Record<string, string> = { "package.json": PKG }): string => {
  const d = materialize(new Map(Object.entries(files)));
  made.push(d);
  return d;
};
const top = (d: string): string[] => readdirSync(d).sort();
const listing = (d: string): string[] => readdirSync(d, { recursive: true }).map(String).sort();

type Case = { name: string; link: string; kind: "dir" | "file"; prefix: string; setup?: (dir: string) => void };
const cases: Case[] = [
  { name: ".claude a symlink to an outside folder", link: ".claude", kind: "dir", prefix: ".claude" },
  {
    name: ".claude/skills a symlink to an outside folder",
    link: ".claude/skills",
    kind: "dir",
    prefix: ".claude/skills",
    setup: (d) => mkdirSync(join(d, ".claude"), { recursive: true }),
  },
  { name: "AGENTS.md a symlink to an outside file", link: "AGENTS.md", kind: "file", prefix: "AGENTS.md" },
];

const diagsOf = (records: { kind: string; [k: string]: unknown }[], code: string) =>
  records.filter((r) => r.kind === "diag" && r.code === code);

describe("k.scaffold E1357", () => {
  for (const c of cases) {
    it(`with ${c.name}, \`keel docs --sync\` emits E1357 with path the linked write, exit 1, and writes nothing`, () => {
      const d = project();
      const out = outside();
      c.setup?.(d);
      if (c.kind === "dir") {
        put(join(out, "keep.txt"), "outside bytes\n");
      } else {
        writeFileSync(join(out, "target.md"), "outside file bytes\n");
      }
      symlinkSync(c.kind === "dir" ? out : join(out, "target.md"), join(d, c.link));
      const before = readTree(d);
      const outBefore = listing(out);
      const outBytes =
        c.kind === "dir" ? readFileSync(join(out, "keep.txt"), "utf8") : readFileSync(join(out, "target.md"), "utf8");

      const r = keel(d, ["docs", "--sync"]);

      expect(r.status).toBe(1);
      const found = diagsOf(r.records, "E1357");
      expect(found.length).toBeGreaterThan(0);
      expect(found.some((x) => typeof x.path === "string" && x.path.startsWith(c.prefix))).toBe(true);
      expect(listing(out)).toEqual(outBefore);
      expect(
        c.kind === "dir" ? readFileSync(join(out, "keep.txt"), "utf8") : readFileSync(join(out, "target.md"), "utf8"),
      ).toBe(outBytes);
      expect(diffPaths(before, readTree(d))).toEqual([]);
    });
  }

  it("a `CLAUDE.md` linked to an existing outside file is kept: exit 0, the outside file byte for byte unchanged, the rest of the set written", () => {
    const d = project();
    const out = outside();
    const target = join(out, "target.md");
    writeFileSync(target, "outside file bytes\n");
    symlinkSync(target, join(d, "CLAUDE.md"));
    const outBefore = listing(out);

    const r = keel(d, ["docs", "--sync"]);

    expect(r.status).toBe(0);
    expect(diagsOf(r.records, "E1357")).toEqual([]);
    expect(readFileSync(target, "utf8")).toBe("outside file bytes\n");
    expect(listing(out)).toEqual(outBefore);
    expect(readTree(d).has("AGENTS.md")).toBe(true);
  });

  it("a `CLAUDE.md` that is a dangling symlink is refused with E1357, exit 1, nothing of the set written and nothing created at the link's target", () => {
    const d = project();
    const out = outside();
    const target = join(out, "missing.md");
    symlinkSync(target, join(d, "CLAUDE.md"));
    const before = top(d);

    const r = keel(d, ["docs", "--sync"]);

    expect(r.status).toBe(1);
    expect(diagsOf(r.records, "E1357").some((x) => typeof x.path === "string" && x.path.startsWith("CLAUDE.md"))).toBe(
      true,
    );
    expect(existsSync(target)).toBe(false);
    expect(listing(out)).toEqual([]);
    expect(top(d)).toEqual(before);
    expect(readFileSync(join(d, "package.json"), "utf8")).toBe(PKG);
  });

  it("`keel scaffold project shop` where shop is a symlink to an empty outside folder is E1357, exit 1, and the outside folder stays empty", () => {
    const d = project({});
    const out = outside();
    symlinkSync(out, join(d, "shop"));
    const r = keel(d, ["scaffold", "project", "shop"]);
    expect(r.status).toBe(1);
    expect(diagsOf(r.records, "E1357").length).toBeGreaterThan(0);
    expect(readdirSync(out)).toEqual([]);
  });

  it("a write whose nearest existing ancestor resolves outside the project is refused with E1357 through the MCP path, nothing written", () => {
    const d = project();
    const out = outside();
    symlinkSync(out, join(d, ".claude"));
    const before = readTree(d);
    const env: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
      env[k] = v;
    }
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "docs", arguments: { sync: true, format: "json" } },
    };
    const r = spawnSync(process.execPath, [join(root, "packages/cli/src/bin.ts"), "mcp"], {
      cwd: d,
      encoding: "utf8",
      env,
      input: `${JSON.stringify(request)}\n`,
    });
    expect(r.stdout).toContain("E1357");
    expect(readdirSync(out)).toEqual([]);
    expect(diffPaths(before, readTree(d))).toEqual([]);
  });
});
