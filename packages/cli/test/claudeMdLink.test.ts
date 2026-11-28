// `CLAUDE.md` with `keel docs --sync` (k.scaffold Agent files): an existing one is kept and never written, linked or
// not; a dangling symlink is refused with E1357 and the whole set with it. Real temp directories.
import { existsSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, describe, expect, it } from "vitest";
import { agentSync } from "../src/docs/agentSync.ts";
import { readDocs } from "../src/docs/readDocs.ts";
import { WriteRefused } from "../src/internal/WriteRefused.ts";
import { applyWrites } from "../src/internal/applyWrites.ts";
import { hostDocs } from "../src/internal/hostDocs.ts";

const made: string[] = [];
const tmp = (): string => {
  const d = tempDir("keel-claudemd-");
  made.push(d);
  return d;
};
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** The `--sync` edit set for a project directory, as the binary computes it. */
const syncWrites = (cwd: string) => {
  return agentSync(readDocs(hostDocs(cwd, "docs"))).writes;
};

describe("CLAUDE.md under keel docs --sync", () => {
  it("an existing CLAUDE.md that links to an outside file is kept: no write names it, the target is unchanged", () => {
    const d = tmp();
    const out = tmp();
    writeFileSync(join(d, "package.json"), "{}\n");
    writeFileSync(join(out, "t.md"), "outside\n");
    symlinkSync(join(out, "t.md"), join(d, "CLAUDE.md"));
    const writes = syncWrites(d);
    expect(writes.some((w) => w.path === "CLAUDE.md")).toBe(false);
    applyWrites(d, writes);
    expect(readFileSync(join(out, "t.md"), "utf8")).toBe("outside\n");
  });

  it("a dangling CLAUDE.md symlink is refused with E1357 and nothing is written", () => {
    const d = tmp();
    const out = tmp();
    writeFileSync(join(d, "package.json"), "{}\n");
    symlinkSync(join(out, "missing.md"), join(d, "CLAUDE.md"));
    const writes = syncWrites(d);
    expect(writes.some((w) => w.path === "CLAUDE.md")).toBe(true);
    expect(() => applyWrites(d, writes)).toThrow(WriteRefused);
    expect(existsSync(join(out, "missing.md"))).toBe(false);
    expect(readdirSync(d).sort()).toEqual(["CLAUDE.md", "package.json"]);
  });
});
