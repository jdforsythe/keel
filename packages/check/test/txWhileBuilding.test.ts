// E1304 examples pinned by location: which `tx` calls in a component file run while it builds. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";

const MSG = "tx while the component builds; create the store with the data as initial";
const HEAD = "import { tx } from '@keel/store'\nimport { For, If } from '@keel/runtime-dom'\n";
const out = (source: string, path = "modules/app/List.tsx"): string[] =>
  check([{ path, source }], { types: false })
    .diagnostics.filter((d) => d.code === "E1304")
    .map((d) => `${d.line}:${d.col} ${d.message}`);

describe("E1304 tx while a component builds", () => {
  it("reports a body call at the call with the message", () => {
    expect(out(`${HEAD}export default function List(props) {\n  tx(props.t, 1)\n  return <Box />\n}\n`)).toEqual([
      `4:3 ${MSG}`,
    ]);
  });

  it("reports an aliased import and a const arrow component the default export names", () => {
    const src =
      "import { tx as run } from '@keel/store'\nconst List = (props) => { run(props.t, 1); return <Box /> }\nexport default List\n";
    expect(out(src)).toHaveLength(1);
  });

  it("reports a function given as the children attribute of a For", () => {
    const src = `${HEAD}export default function List(props) {\n  return <For each={props.xs} children={(x) => { tx(props.t, x); return <Box /> }} />\n}\n`;
    expect(out(src)).toHaveLength(1);
  });

  it("reports a For row inside an If branch, and not a handler inside a row", () => {
    const src = `${HEAD}export default function List(props) {\n  return <If when={props.ok}>{() => <For each={props.xs}>{(x) => { tx(props.t, x); return <Button onClick={() => tx(props.t, x)} /> }}</For>}</If>\n}\n`;
    expect(out(src)).toHaveLength(1);
  });

  it("leaves a local tx, a non-component file, a test file and an unrelated element's function child alone", () => {
    expect(
      out("function tx(a, b) {}\nexport default function List(props) {\n  tx(props.t, 1)\n  return <Box />\n}\n"),
    ).toEqual([]);
    expect(out(`${HEAD}export function seed(props) { tx(props.t, 1) }\n`, "modules/app/seed.ts")).toEqual([]);
    expect(
      out(
        `${HEAD}export default function List(props) {\n  tx(props.t, 1)\n  return <Box />\n}\n`,
        "modules/app/List.test.tsx",
      ),
    ).toEqual([]);
    expect(
      out(
        `${HEAD}export default function List(props) {\n  return <Panel>{() => { tx(props.t, 1); return <Box /> }}</Panel>\n}\n`,
      ),
    ).toEqual([]);
  });

  it("property: a call wrapped in any non-build function is none, one at build is one", () => {
    const wraps = fc.constantFrom("() => { CALL }", "function h() { CALL }", "async () => { CALL }");
    fc.assert(
      fc.property(fc.boolean(), wraps, (wrapped, w) => {
        const call = "tx(props.t, 1)";
        const stmt = wrapped ? `const h = ${w.replace("CALL", call)}` : call;
        const src = `${HEAD}export default function List(props) {\n  ${stmt}\n  return <Box />\n}\n`;
        expect(out(src)).toHaveLength(wrapped ? 0 : 1);
      }),
      { seed: 1337, numRuns: 20 },
    );
  });
});
