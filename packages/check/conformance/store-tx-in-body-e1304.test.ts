// Spec: k.store, Conformance "E1304 fires on `tx` at the top of a component body and in a `For` row function; not on one in an `onClick` arrow, an `effect` callback, or a top-level helper the body calls."
// Spec: k.store, Rules "E1304 a `tx` call in a component file that runs while the component builds: in the component function's body outside any nested function, or in a function that is a `For`, `If`, `Match`, `Case` or `Boundary` child (k.component Build); fix: create the store with the data as `initial` (View stores), or call `tx` in an event handler. Partial (static): ... E1304 does not follow a call."
// Seed 1337 (fc.assert below). Pending: E1304 is not reported yet. In-memory `check`, a component file `C.tsx`.
// ASSUMPTION: the fix is a hint, so it is read as text through `JSON.stringify` of the diagnostic (it names `initial`); `If`, `Match`, `Case` and `Boundary` come from `@keel/runtime-dom` with a function child.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./support.ts";

const HEAD = `import { effect } from '@keel/reactive'
import { s } from '@keel/schema'
import { store, transaction, tx } from '@keel/store'
import { Box, Button } from '@keel/ui'
import { For, If, Match, Case, Boundary } from '@keel/runtime-dom'
const T = s.object({ n: s.number() })
const P = s.object({ x: s.number() })
`;
const COMPONENT = (body: string, jsx = "<Box>x</Box>", before = "") =>
  `${HEAD}${before}export default function C(props) {
  const st = store(T, { n: 0 }, { id: 'c.st' })
  const bump = transaction(st, 'c.bump', P, (state, p) => ({ n: state.n + p.x }))
${body}
  return ${jsx}
}
`;
const e1304 = (source: string) =>
  check([{ path: "C.tsx", source }], { types: false }).diagnostics.filter((d) => d.code === "E1304");

const BAD: Record<string, string> = {
  body: COMPONENT("  tx(bump, { x: 1 })"),
  forRow: COMPONENT(
    "",
    "<Box><For each={props.items} key='id'>{(i) => { tx(bump, { x: 1 }); return <Box>{i.id}</Box> }}</For></Box>",
  ),
  ifChild: COMPONENT("", "<Box><If when={props.ok}>{() => { tx(bump, { x: 1 }); return <Box>y</Box> }}</If></Box>"),
  matchCase: COMPONENT(
    "",
    "<Box><Match>{[<Case when={props.ok}>{() => { tx(bump, { x: 1 }); return <Box>y</Box> }}</Case>]}</Match></Box>",
  ),
  boundary: COMPONENT("", "<Box><Boundary>{() => { tx(bump, { x: 1 }); return <Box>y</Box> }}</Boundary></Box>"),
};
const CLEAN: Record<string, string> = {
  onClick: COMPONENT("", "<Button onClick={() => tx(bump, { x: 1 })}>go</Button>"),
  effect: COMPONENT("  effect(() => { tx(bump, { x: 1 }) })"),
  helper: COMPONENT("  seed(bump)", "<Box>x</Box>", "function seed(b) {\n  tx(b, { x: 1 })\n}\n"),
};

test("E1304 fires on `tx` at the top of a component body and in a `For` row function; not on one in an `onClick` arrow, an `effect` callback, or a top-level helper the body calls.", () => {
  expect(e1304(BAD.body ?? "")).toHaveLength(1);
  expect(e1304(BAD.forRow ?? "")).toHaveLength(1);
  for (const [name, source] of Object.entries(CLEAN)) expect(e1304(source), name).toEqual([]);
});

test("E1304 also fires on `tx` in a function that is an `If`, `Match`, `Case` or `Boundary` child, one per call", () => {
  fc.assert(
    fc.property(fc.constantFrom("ifChild", "matchCase", "boundary"), (k) => {
      expect(e1304(BAD[k] ?? ""), k).toHaveLength(1);
    }),
    { seed: SEED, numRuns: 6 },
  );
});

test("E1304 reports one per `tx` call, and its fix names the store's `initial` or an event handler", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 4 }), (n) => {
      const calls = Array.from({ length: n }, () => "  tx(bump, { x: 1 })").join("\n");
      const ds = e1304(COMPONENT(calls));
      expect(ds).toHaveLength(n);
      const text = JSON.stringify(ds[0]);
      expect(text.includes("initial") || text.includes("event handler")).toBe(true);
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("E1304 does not follow a call: a `tx` in a helper the body calls is none (it throws E1201 at render instead).", () => {
  expect(e1304(CLEAN.helper ?? "")).toEqual([]);
});

test("E1304 is a check rule of component files only: the same `tx` at the top level of a non-component module is none.", () => {
  const src = `${HEAD}export const st = store(T, { n: 0 }, { id: 'm.st' })\nexport const bump = transaction(st, 'm.bump', P, (s0, p) => ({ n: s0.n + p.x }))\ntx(bump, { x: 1 })\n`;
  expect(
    check([{ path: "util.ts", source: src }], { types: false }).diagnostics.filter((d) => d.code === "E1304"),
  ).toEqual([]);
});
