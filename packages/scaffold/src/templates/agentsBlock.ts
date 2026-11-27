import { AGENTS_END } from "../agents/AGENTS_END.ts";
import { AGENTS_START } from "../agents/AGENTS_START.ts";
import type { AgentSkill } from "../types/AgentSkill.ts";

/**
 * The Keel block of `AGENTS.md`, markers included, no trailing newline (k.scaffold Agent files, at most 600
 * tokens): the reading path, the commands, the rules every Keel file follows, and each skill's copy path. In a
 * `library` (k.explain Agent files) it says it is a Keel library, names `keel pack`, and lists `keel-library` first.
 * Every command is in the project's form `run` (`pnpm keel`, from `packageManager`), and one line says the skills'
 * bare `keel <command>` means that form: the skills are the kit's text, copied byte for byte so W1356 can tell them.
 */
export function agentsBlock(skills: readonly AgentSkill[], library = false, run = "pnpm keel"): string {
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
    library ? "This is a Keel library." : "This is a Keel app.",
    `Run Keel through the project, \`${run} <command>\`: a \`keel\` on PATH may be another program. Where a skill writes \`keel <command>\`, run \`${run} <command>\`.`,
    "",
    "Read Keel's docs from the installed packages, not from memory:",
    `- \`${run} docs\` lists the areas and skills; \`${run} docs <area>\` an area's sections; \`${run} docs <id>\` prints one (\`${run} docs k.router\`).`,
    `- \`${run} docs --for <code, name or term>\` finds the sections; \`${run} explain <code>\` prints a code's meaning and fix.`,
    "",
    library
      ? `Commands: \`${run} check\`, \`${run} test\`, \`${run} pack\` (before a release), \`${run} codemod <op>\`. Output is compact; fix each diagnostic by its code.`
      : `Commands: \`${run} check\`, \`${run} test\`, \`${run} build\`, \`${run} dev\`, \`${run} scaffold <op>\`, \`${run} codemod <op>\`. Output is compact; fix each diagnostic by its code.`,
    "",
    "Rules every Keel file follows:",
    "- One export per file, named as the file.",
    "- Schemas live in `*.schema.ts`, server work in `*.server.ts`.",
    "- No `throw` or `try`: return a `Result`. No `Date.now`, `Math.random`, `fetch` or DOM globals: use `ctx`.",
    "- No `any`, casts, `!` or `@ts-ignore`. Never import a `@keel/*` internal path.",
    library
      ? "- Write each component in `src/`, export it from `src/index.ts` and name it in `module.ts` `public.exports`: a library has no modules, routes or stores to scaffold. Generated files are read-only."
      : `- Add modules, routes, components and stores with \`${run} scaffold\`; rename and move with \`${run} codemod\`. Generated files are read-only.`,
    `- Stop only when \`${run} check\` and \`${run} test\` are clean.`,
    ...list,
    "",
    `\`${run} docs --sync\` rewrites this block and the skill copies from the installed \`@keel/cli\`.`,
    AGENTS_END,
  ].join("\n");
}
