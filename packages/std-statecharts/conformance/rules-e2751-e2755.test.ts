// Spec: std.statecharts, clause "`keel check` reports E2751 to E2755 on fixtures and nothing on their clean twins; E2751 carries a fix to the nearest name and E2753 one adding `final: true`."
// std.statecharts, rule E2751: `initial` or a `to` naming no state (fix: the nearest state name).
// std.statecharts, rule E2752: a state unreachable from `initial` through `on` targets.
// std.statecharts, rule E2753: a non-final state with no target to another state (fix: add `final: true`).
// std.statecharts, rule E2754: a final state with `on`, an `on` event missing from `events`, or a `guard` or `do` naming no entry.
// std.statecharts, rule E2755: a `chart` whose `initial`, `events`, `guards`, `actions`, `states`, `on` keys or targets are not literals: a variable, a spread or a computed key (the checker cannot prove it).
// Seed: 1337.
// Assumption: as for std.jobs E2501, `check()` imports nothing, so the rules register by importing `@keel/std-statecharts/tools`;
// a module is the files under `modules/<id>/` with a `module.ts` listing `deps`; the chart file is `modules/todos/editorChart.ts` (a client-safe file named for its export).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import "@keel/std-statecharts/tools";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const CODES = ["E2751", "E2752", "E2753", "E2754", "E2755"] as const;
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "todos", deps: ["@keel/std-statecharts"], capabilities: [] })
`;
const found = (files: Files, code: string) => check(files, { types: false }).diagnostics.filter((d) => d.code === code);
const all = (files: Files) => check(files, { types: false }).diagnostics.filter((d) => CODES.some((c) => c === d.code));

function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-fix-"));
  try {
    for (const f of files) {
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((f) => ({ path: f.path, source: readFileSync(join(dir, f.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

type Parts = {
  initial?: string;
  events?: string;
  guards?: string;
  actions?: string;
  states?: string;
  pre?: string;
};
const EVENTS = "{ edit: s.object({}), save: s.object({}), cancel: s.object({}) }";
const STATES = `{
    viewing: { on: { edit: 'editing' } },
    editing: { on: { save: { to: 'saving', do: 'count' }, cancel: 'viewing' } },
    saving: { on: { edit: { to: 'viewing', guard: 'canRetry' } } },
    gaveUp: { final: true },
  }`;
const chartSrc = (p: Parts = {}) => `import { chart } from "@keel/std-statecharts"
import { s } from "@keel/schema"
${p.pre ?? ""}
export const editorChart = chart('todos.editor', {
  data: s.object({ attempts: s.int({ min: 0, max: 3 }) }), start: { attempts: 0 },
  events: ${p.events ?? EVENTS},
  guards: ${p.guards ?? "{ canRetry: (d) => d.attempts < 3 }"},
  actions: ${p.actions ?? "{ count: (d) => ({ attempts: d.attempts + 1 }) }"},
  initial: ${p.initial ?? "'viewing'"},
  states: ${p.states ?? STATES},
})
`;
const project = (p: Parts = {}): Files => [
  { path: "modules/todos/module.ts", source: manifest },
  { path: "modules/todos/editorChart.ts", source: chartSrc(p) },
];
// `gaveUp` is reachable in the clean twin through `saving`'s second target.
const reachable = (extra: string) => `{
    viewing: { on: { edit: 'editing' } },
    editing: { on: { save: { to: 'saving', do: 'count' }, cancel: 'viewing' } },
    saving: { on: { edit: [{ to: 'viewing', guard: 'canRetry' }, { to: 'gaveUp' }] } },
    gaveUp: { final: true },${extra}
  }`;
const CLEAN = project({ states: reachable("") });
const word = fc.stringMatching(/^[a-z]{3,8}$/).filter((w) => w !== "end");

describe("std.statecharts: keel check rules", () => {
  test("`keel check` reports E2751 to E2755 on fixtures and nothing on their clean twins", () => {
    expect(all(CLEAN)).toEqual([]);
    const fixtures: Record<(typeof CODES)[number], Files> = {
      E2751: project({ initial: "'veiwing'", states: reachable("") }),
      E2752: project({ states: reachable("\n    orphan: { on: { edit: 'viewing' } },") }),
      E2753: project({ states: reachable("\n    stuck: {},").replace("cancel: 'viewing'", "cancel: 'stuck'") }),
      E2754: project({
        states: reachable("").replace("gaveUp: { final: true }", "gaveUp: { final: true, on: { edit: 'viewing' } }"),
      }),
      E2755: project({ initial: "pick()", pre: "const pick = () => 'viewing'", states: reachable("") }),
    };
    for (const code of CODES) {
      const hits = found(fixtures[code], code);
      expect(hits.length, code).toBe(1);
      expect(hits[0]?.see).toBe("std.statecharts");
    }
  }, 30_000);

  test("E2751 `initial` or a `to` naming no state (fix: the nearest state name)", () => {
    const badInitial = project({ initial: "'veiwing'", states: reachable("") });
    const d = found(badInitial, "E2751");
    expect(d.length).toBe(1);
    const fix = d[0]?.fix;
    expect(fix).toBeDefined();
    if (fix === undefined) return;
    const fixed = applyFix(badInitial, fix);
    expect(found(fixed, "E2751")).toEqual([]);
    expect(fixed.find((f) => f.path.endsWith("editorChart.ts"))?.source).toContain("initial: 'viewing'");

    const badTo = project({ states: reachable("").replace("cancel: 'viewing'", "cancel: 'viewng'") });
    const t = found(badTo, "E2751");
    expect(t.length).toBe(1);
    const toFix = t[0]?.fix;
    expect(toFix).toBeDefined();
    if (toFix === undefined) return;
    const fixedTo = applyFix(badTo, toFix);
    expect(found(fixedTo, "E2751")).toEqual([]);
    expect(fixedTo.find((f) => f.path.endsWith("editorChart.ts"))?.source).toContain("cancel: 'viewing'");

    // a state name one letter off is fixed to the declared name, for any generated name
    fc.assert(
      fc.property(word, (name) => {
        const src = (n: string) =>
          project({
            initial: `'${n}'`,
            states: `{ ${name}: { on: { edit: 'end' } }, end: { final: true } }`,
            events: "{ edit: s.object({}) }",
            guards: "{}",
            actions: "{}",
          });
        expect(found(src(name), "E2751")).toEqual([]);
        const hits = found(src(`${name}x`), "E2751");
        expect(hits.length).toBe(1);
        const f = hits[0]?.fix;
        if (f === undefined) throw new Error("E2751 carries a fix");
        expect(found(applyFix(src(`${name}x`), f), "E2751")).toEqual([]);
      }),
      { seed: 1337, numRuns: 15 },
    );
  }, 30_000);

  test("E2752 a state unreachable from `initial` through `on` targets", () => {
    const d = found(project({ states: reachable("\n    orphan: { on: { edit: 'viewing' } },") }), "E2752");
    expect(d.length).toBe(1);
    expect(d[0]?.message).toContain("orphan");
    // a state with a target only behind a guard, or only as a later target of a list, is reachable (every guard may be true)
    expect(found(CLEAN, "E2752")).toEqual([]);
    expect(
      found(
        project({
          states: reachable("").replace(
            "[{ to: 'viewing', guard: 'canRetry' }, { to: 'gaveUp' }]",
            "{ to: 'gaveUp', guard: 'canRetry' }",
          ),
        }),
        "E2752",
      ),
    ).toEqual([]);
    // reachability runs from `initial` only: two states pointing at each other are unreachable together
    const island = reachable("\n    a: { on: { edit: 'b' } },\n    b: { on: { edit: 'a' } },");
    expect(found(project({ states: island }), "E2752").length).toBe(2);
  }, 30_000);

  test("E2753 a non-final state with no target to another state (fix: add `final: true`)", () => {
    const withStuck = (body: string) =>
      project({ states: reachable(`\n    stuck: ${body},`).replace("cancel: 'viewing'", "cancel: 'stuck'") });
    for (const body of ["{}", "{ on: {} }", "{ on: { edit: 'stuck' } }", "{ on: { edit: { do: 'count' } } }"]) {
      expect(found(withStuck(body), "E2753").length, body).toBe(1);
    }
    const bare = withStuck("{}");
    const fix = found(bare, "E2753")[0]?.fix;
    expect(fix).toBeDefined();
    if (fix === undefined) return;
    const fixed = applyFix(bare, fix);
    expect(found(fixed, "E2753")).toEqual([]);
    expect(found(fixed, "E2754")).toEqual([]);
    expect(fixed.find((f) => f.path.endsWith("editorChart.ts"))?.source).toMatch(/stuck: \{[^}]*final: true/);
    expect(found(CLEAN, "E2753")).toEqual([]);
  }, 30_000);

  test("E2754 a final state with `on`, an `on` event missing from `events`, or a `guard` or `do` naming no entry", () => {
    const variants: Parts[] = [
      { states: reachable("").replace("gaveUp: { final: true }", "gaveUp: { final: true, on: { edit: 'viewing' } }") },
      { states: reachable("").replace("cancel: 'viewing'", "ghost: 'viewing'") },
      { states: reachable("").replace("guard: 'canRetry'", "guard: 'nope'") },
      { states: reachable("").replace("do: 'count'", "do: 'nope'") },
    ];
    for (const v of variants) expect(found(project(v), "E2754").length).toBe(1);
    expect(found(CLEAN, "E2754")).toEqual([]);
  }, 30_000);

  test("E2755 a `chart` whose `initial`, `events`, `guards`, `actions`, `states`, `on` keys or targets are not literals: a variable, a spread or a computed key (the checker cannot prove it)", () => {
    const variants: Parts[] = [
      { initial: "pick()", pre: "const pick = () => 'viewing'", states: reachable("") },
      { states: "makeStates()", pre: `const makeStates = () => (${reachable("")})` },
      { states: reachable("").replace("cancel:", "[key]:"), pre: "const key = 'cancel'" },
      { states: reachable("").replace("edit: 'editing'", "edit: target"), pre: "const target = 'editing'" },
    ];
    for (const v of variants) expect(found(project(v), "E2755").length).toBe(1);
    expect(found(CLEAN, "E2755")).toEqual([]);
  }, 30_000);
});
