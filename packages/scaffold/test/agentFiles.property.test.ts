// agentFiles: the block is replaced in place or appended, text outside it is kept, a second sync changes nothing,
// malformed markers are E1355. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AGENTS_END, AGENTS_START, agentFiles } from "../src/agents/index.ts";
import type { DeployDrift } from "../src/types/DeployDrift.ts";

const skills = [
  { name: "keel-a", description: "A", text: "---\nname: keel-a\n---\nA\n" },
  { name: "keel-b", description: "B", text: "B\n" },
];
const apply = (files: Map<string, string>, drift: readonly DeployDrift[]): Map<string, string> => {
  const out = new Map(files);
  for (const d of drift) if (d.want !== null) out.set(d.path, d.want);
  return out;
};
const sync = (files: Map<string, string>): Map<string, string> => {
  const r = agentFiles(files, skills);
  if (!r.ok) throw new Error(r.error.message);
  return apply(files, r.value);
};
const userText = fc.array(fc.stringMatching(/^[A-Za-z0-9 #.-]{0,30}$/), { maxLength: 6 }).map((ls) => ls.join("\n"));

describe("agentFiles", () => {
  it("a fresh tree gets every file; the block lists each skill's copy path", () => {
    const r = agentFiles(new Map(), skills);
    expect(r.ok && r.value.map((d) => [d.path, d.have])).toEqual([
      [".claude/skills/keel-a/SKILL.md", null],
      [".claude/skills/keel-b/SKILL.md", null],
      ["AGENTS.md", null],
      ["CLAUDE.md", null],
    ]);
    const agents = sync(new Map()).get("AGENTS.md") ?? "";
    expect(agents.startsWith(`${AGENTS_START}\n`)).toBe(true);
    expect(agents.endsWith(`${AGENTS_END}\n`)).toBe(true);
    for (const s of skills) expect(agents).toContain(`- ${s.name}: \`.claude/skills/${s.name}/SKILL.md\``);
    expect(Math.ceil(agents.length / 4)).toBeLessThanOrEqual(600);
    expect(sync(new Map()).get("CLAUDE.md")).toBe("@AGENTS.md\n");
    const none = agentFiles(new Map(), []);
    expect(none.ok && none.value.map((d) => d.path)).toEqual(["AGENTS.md", "CLAUDE.md"]);
  });

  it("text before and after the block survives, the block is restored, and a second sync is a no-op", () => {
    fc.assert(
      fc.property(userText, userText, fc.string({ maxLength: 20 }), (before, after, junk) => {
        const first = sync(new Map()).get("AGENTS.md") ?? "";
        const block = first.slice(0, -1);
        const tampered = block.replace(AGENTS_START, `${AGENTS_START}\n${junk.replaceAll("<!--", "")}`);
        const agents = `${before}\n${tampered}\n${after}`;
        const once = sync(
          new Map([
            ["AGENTS.md", agents],
            ["CLAUDE.md", "mine\n"],
          ]),
        );
        expect(once.get("AGENTS.md")).toBe(`${before}\n${block}\n${after}`);
        expect(once.get("CLAUDE.md")).toBe("mine\n");
        const again = agentFiles(once, skills);
        expect(again.ok && again.value).toEqual([]);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  it("an AGENTS.md without a block keeps its text and gains the block after a blank line", () => {
    const out = sync(new Map([["AGENTS.md", "# mine"]])).get("AGENTS.md") ?? "";
    expect(out.startsWith(`# mine\n\n${AGENTS_START}\n`)).toBe(true);
    const nl = sync(new Map([["AGENTS.md", "# mine\n"]])).get("AGENTS.md") ?? "";
    expect(nl.startsWith(`# mine\n\n${AGENTS_START}\n`)).toBe(true);
    expect(
      sync(new Map([["AGENTS.md", ""]]))
        .get("AGENTS.md")
        ?.startsWith(AGENTS_START),
    ).toBe(true);
  });

  it("markers out of shape are E1355 at AGENTS.md line 1; CRLF marker lines count", () => {
    for (const bad of [
      `${AGENTS_START}\n`,
      `${AGENTS_END}\n`,
      `${AGENTS_END}\n${AGENTS_START}\n`,
      `${AGENTS_START}\n${AGENTS_END}\n${AGENTS_START}\n${AGENTS_END}\n`,
      `${AGENTS_START}\n${AGENTS_START}\n${AGENTS_END}\n`,
    ]) {
      const r = agentFiles(new Map([["AGENTS.md", bad]]), skills);
      expect(r.ok ? undefined : r.error.data).toMatchObject({ code: "E1355", path: "AGENTS.md", line: 1, col: 1 });
    }
    const crlf = agentFiles(new Map([["AGENTS.md", `${AGENTS_START}\r\nold\r\n${AGENTS_END}\r\n`]]), skills);
    expect(crlf.ok).toBe(true);
    const inline = agentFiles(new Map([["AGENTS.md", `text ${AGENTS_START}\n`]]), skills);
    expect(inline.ok).toBe(true);
  });

  it("a CRLF AGENTS.md keeps CRLF in the block, replaced or appended, and a second sync is a no-op", () => {
    const lfOnly = (t: string): boolean => /(^|[^\r])\n/.test(t);
    for (const have of [
      `# mine\r\n${AGENTS_START}\r\nold\r\n${AGENTS_END}\r\nafter\r\n`,
      "# mine\r\nmore\r\n",
      "# mine\r\nno newline at end",
    ]) {
      const once = sync(new Map([["AGENTS.md", have]]));
      const agents = once.get("AGENTS.md") ?? "";
      expect(lfOnly(agents)).toBe(false);
      expect(agents).toContain(`${AGENTS_START}\r\n`);
      expect(agents).toContain(`${AGENTS_END}\r\n`);
      expect(agents.startsWith("# mine\r\n")).toBe(true);
      const again = agentFiles(once, skills);
      expect(again.ok && again.value).toEqual([]);
    }
    const tail = sync(new Map([["AGENTS.md", `x\r\n${AGENTS_START}\r\nold\r\n${AGENTS_END}`]])).get("AGENTS.md");
    expect(tail?.endsWith(`\r\n${AGENTS_END}`)).toBe(true);
  });
});
