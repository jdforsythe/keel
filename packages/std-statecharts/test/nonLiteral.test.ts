// keel check reports E2755 for a declaration part it cannot read (a variable, a spread, a computed key) and follows a
// `const` bound directly to `chart`.
import { check } from "@keel/check";
import "@keel/std-statecharts/tools";
import { describe, expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
const manifest = `import { module } from "@keel/compiler"
export default module({ id: "todos", deps: ["@keel/std-statecharts"], capabilities: [] })
`;
const src = (p: {
  pre?: string;
  events?: string;
  guards?: string;
  actions?: string;
  call?: string;
  head?: string;
}) => `${p.head ?? 'import { chart } from "@keel/std-statecharts"'}
import { s } from "@keel/schema"
${p.pre ?? ""}
export const editorChart = ${p.call ?? "chart"}('todos.editor', {
  data: s.object({ n: s.int({ min: 0, max: 3 }) }), start: { n: 0 },
  events: ${p.events ?? "{ go: s.object({}), stop: s.object({}) }"},
  guards: ${p.guards ?? "{ ok: (d) => d.n < 3 }"},
  actions: ${p.actions ?? "{ inc: (d) => ({ n: d.n + 1 }) }"},
  initial: 'a',
  states: { a: { on: { go: { to: 'b', guard: 'ok', do: 'inc' }, stop: 'b' } }, b: { final: true } },
})
`;
const codes = (p: Parameters<typeof src>[0]): string[] => {
  const files: Files = [
    { path: "modules/todos/module.ts", source: manifest },
    { path: "modules/todos/editorChart.ts", source: src(p) },
  ];
  return check(files, { types: false })
    .diagnostics.map((d) => d.code)
    .filter((c) => c.startsWith("E275"));
};

describe("statecharts rules: parts the checker cannot read", () => {
  test("the clean declaration reports nothing", () => {
    expect(codes({})).toEqual([]);
  });

  test("events, guards or actions through a variable, a spread or a computed key are E2755", () => {
    const EV = "const EV = { go: s.object({}) }";
    const G = "const G = { ok: (d: { n: number }) => d.n < 3 }";
    const k = "const k = 'ok'";
    for (const p of [
      { pre: EV, events: "EV" },
      { pre: EV, events: "{ ...EV }" },
      { pre: G, guards: "{ ...G }" },
      { pre: k, guards: "{ [k]: () => true }" },
      { pre: G, guards: "G" },
      { pre: "const A = {}", actions: "{ ...A }" },
    ])
      expect(codes(p), JSON.stringify(p)).toEqual(["E2755"]);
  });

  test("a const bound directly to chart is followed", () => {
    expect(codes({ pre: "const c = chart", call: "c" })).toEqual([]);
    expect(codes({ pre: "const c = chart", call: "c", events: "{ go: s.object({}) }" })).toEqual(["E2754"]);
    expect(
      codes({
        head: 'import * as sc from "@keel/std-statecharts"',
        pre: "const c = sc.chart\nconst d = c",
        call: "d",
        events: "{ go: s.object({}) }",
      }),
    ).toEqual(["E2754"]);
  });
});
