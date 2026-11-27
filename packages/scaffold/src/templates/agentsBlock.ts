import { AGENTS_END } from "../agents/AGENTS_END.ts";
import { AGENTS_START } from "../agents/AGENTS_START.ts";
import type { AgentSkill } from "../types/AgentSkill.ts";

/**
 * The Keel block of `AGENTS.md`, markers included, no trailing newline (k.scaffold Agent files, at most 600
 * tokens): the reading path, the commands, the rules every Keel file follows, and each skill's copy path. In a
 * `library` (k.explain Agent files) it says it is a Keel library, names `keel pack`, and lists `keel-library` first.
 */
export function agentsBlock(skills: readonly AgentSkill[], library = false): string {
  const order = library
    ? [...skills.filter((s) => s.name === "keel-library"), ...skills.filter((s) => s.name !== "keel-library")]
    : skills;
  const list =
    order.length === 0
      ? []
      : [
          "",
          "Skills (load the one that fits the work):",
          ...order.map((s) => `- ${s.name}: \`.claude/skills/${s.name}/SKILL.md\``),
        ];
  return [
    AGENTS_START,
    "## Keel",
    "",
    library
      ? "This is a Keel library. Read Keel's docs from the installed packages, not from memory:"
      : "This is a Keel app. Read Keel's docs from the installed packages, not from memory:",
    "- `keel docs` lists the areas and skills; `keel docs <area>` an area's sections; `keel docs <id>` prints one (`keel docs k.router`).",
    "- `keel docs --for <code, name or term>` finds the sections; `keel explain <code>` prints a code's meaning and fix.",
    "",
    library
      ? "Commands: `keel check`, `keel test`, `keel pack` (before a release), `keel codemod <op>`. Output is compact; fix each diagnostic by its code."
      : "Commands: `keel check`, `keel test`, `keel build`, `keel dev`, `keel scaffold <op>`, `keel codemod <op>`. Output is compact; fix each diagnostic by its code.",
    "",
    "Rules every Keel file follows:",
    "- One export per file, named as the file.",
    "- Schemas live in `*.schema.ts`, server work in `*.server.ts`.",
    "- No `throw` or `try`: return a `Result`. No `Date.now`, `Math.random`, `fetch` or DOM globals: use `ctx`.",
    "- No `any`, casts, `!` or `@ts-ignore`. Never import a `@keel/*` internal path.",
    "- Add modules, routes, components and stores with `keel scaffold`; rename and move with `keel codemod`. Generated files are read-only.",
    "- Stop only when `keel check` and `keel test` are clean.",
    ...list,
    "",
    "`keel docs --sync` rewrites this block and the skill copies from the installed `@keel/cli`.",
    AGENTS_END,
  ].join("\n");
}
