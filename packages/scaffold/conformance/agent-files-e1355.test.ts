// Spec: k.scaffold "Unclosed block: `--sync` E1355, exit 1, writes nothing."
// Spec: k.scaffold Rules E1355 "Keel block not one start and one end line". Also covers a block with the end line only and a start line twice.
// Seed: none. Red: `keel docs` is absent (E1051, exit 2).
import { describe, expect, it } from "vitest";
import { END, PKG, START, cleanup, diffPaths, keel, projectWith, readTree } from "./agent-files-support.ts";

const cases: [string, string][] = [
  ["a start line and no end line", `# mine\n${START}\nold\n`],
  ["an end line and no start line", `# mine\nold\n${END}\n`],
  ["a start line twice", `${START}\na\n${END}\n${START}\nb\n${END}\n`],
];

describe("k.scaffold E1355", () => {
  for (const [name, agents] of cases) {
    it(`an AGENTS.md with ${name}: \`keel docs --sync\` is E1355, exit 1, and no file changes`, () => {
      const d = projectWith({ "package.json": PKG, "AGENTS.md": agents });
      try {
        const before = readTree(d);
        const r = keel(d, ["docs", "--sync"]);
        expect(r.status).toBe(1);
        expect(r.records.some((x) => x.kind === "diag" && x.code === "E1355")).toBe(true);
        expect(diffPaths(before, readTree(d))).toEqual([]);
      } finally {
        cleanup(d);
      }
    });
  }
});
