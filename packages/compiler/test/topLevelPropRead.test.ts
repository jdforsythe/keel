// E1405 (k.component): a prop read once at a component's top level whose value reaches a binding. Seed 1337.
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const UI = "import { Box, Button, Text } from '@keel/ui'\nimport { For } from '@keel/runtime-dom'\n";
const file = (body: string): string =>
  `${UI}export default function C(props: { label: string; on: () => void }) {\n${body}\n}\n`;
const e1405 = (body: string) =>
  compile([{ path: "C.tsx", source: file(body) }]).diagnostics.filter((d) => d.code === "E1405");
const applied = (body: string): string => {
  const src = file(body);
  const d = e1405(body)[0];
  if (d?.fix === undefined) throw new Error("no fix");
  // The fix's single hunk, rebuilt: removed lines out, added lines in.
  const lines = d.fix.split("\n").slice(2);
  const header = lines[0] ?? "";
  const from = Number(/^@@ -(\d+)/.exec(header)?.[1] ?? "1") - 1;
  const hunk = lines.slice(1);
  const before = hunk.filter((l) => !l.startsWith("+")).map((l) => l.slice(1));
  const after = hunk.filter((l) => !l.startsWith("-")).map((l) => l.slice(1));
  const all = src.split("\n");
  expect(all.slice(from, from + before.length)).toEqual(before);
  all.splice(from, before.length, ...after);
  return all.join("\n");
};

describe("E1405: a top-level prop read reaching a binding", () => {
  it("reports a text child, an attribute, a child's props, a spread and a For row's binding", () => {
    expect(e1405("const l = props.label; return <Text>{l}</Text>")).toHaveLength(1);
    expect(e1405("const l = props.label; return <Box id={l}>x</Box>")).toHaveLength(1);
    expect(e1405("const l = props.label; return <Box>{`${l}!`}</Box>")).toHaveLength(1);
    expect(e1405("const l = props.label; return <Box {...{ id: l }}>x</Box>")).toHaveLength(1);
    expect(e1405("const l = props.label; return <For each={[1]}>{() => <Text>{l}</Text>}</For>")).toHaveLength(1);
    expect(e1405('const l = props.label ?? "x"; return <Text>{l}</Text>')).toHaveLength(1);
    expect(e1405("const l = props.label, m = props.label; return <Text>{l}{m}</Text>")).toHaveLength(2);
  });

  it("does not report reads in a binding, a handler, an effect or a function, nor non-read initializers", () => {
    expect(e1405("return <Text>{props.label}</Text>")).toEqual([]);
    expect(e1405("const l = props.label; return <Button onClick={() => alert(l)}>x</Button>")).toEqual([]);
    expect(e1405("const l = props.label; effect(() => log(l)); return <Text>x</Text>")).toEqual([]);
    expect(e1405("const l = () => props.label; return <Text>{l()}</Text>")).toEqual([]);
    expect(e1405("const l = fmt(props.label); return <Text>{l}</Text>")).toEqual([]);
    expect(e1405("const l = props; return <Text>{l.label}</Text>")).toEqual([]);
    expect(e1405("let l = props.label; return <Text>{l}</Text>")).toEqual([]);
    expect(e1405("if (props.label) { const l = props.label; log(l) } return <Text>x</Text>")).toEqual([]);
    expect(e1405("const l = props.label; return <Text>{((l) => l)(1)}</Text>")).toEqual([]);
  });

  it("the fix reads the prop in the binding and drops a const with no other use", () => {
    const out = applied("  const l = props.label;\n  return <Text>{l}</Text>");
    expect(out).toContain("return <Text>{props.label}</Text>");
    expect(out).not.toContain("const l");
  });

  it("the fix keeps a const used elsewhere, parenthesizes an operator and expands shorthand", () => {
    const kept = applied("  const l = props.label;\n  return <Button onClick={() => alert(l)}>{l}</Button>");
    expect(kept).toContain("const l = props.label;");
    expect(kept).toContain("<Button onClick={() => alert(l)}>{props.label}</Button>");
    expect(applied('  const l = props.label || "x";\n  return <Text>{l}</Text>')).toContain('{(props.label || "x")}');
    expect(applied("  const l = props.label;\n  return <Box {...{ l }}>x</Box>")).toContain("{...{ l: props.label }}");
  });

  it("the fixed source reports no E1405", () => {
    const fixed = applied("  const l = props.label;\n  return <Box id={l}><Text>{l}</Text></Box>");
    expect(compile([{ path: "C.tsx", source: fixed }]).diagnostics.map((d) => d.code)).not.toContain("E1405");
  });

  it("property: over prop names and sinks, the top-level read reports one E1405 and the bound read none", () => {
    const names = fc.constantFrom("label", "title", "name", "value", "caption", "href");
    const sinks = fc.constantFrom("text", "attr", "child", "row");
    const sink = (s: string, v: string): string =>
      s === "text"
        ? `<Text>{${v}}</Text>`
        : s === "attr"
          ? `<Box id={${v}}>x</Box>`
          : s === "child"
            ? `<Text fg={${v}}>x</Text>`
            : `<For each={[1]}>{() => <Text>{${v}}</Text>}</For>`;
    fc.assert(
      fc.property(names, sinks, (n, s) => {
        expect(e1405(`const v = props.${n}; return ${sink(s, "v")}`)).toHaveLength(1);
        expect(e1405(`return ${sink(s, `props.${n}`)}`)).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
  it("the fix keeps meaning: an optional chain is parenthesized under a member access, and a called const has no fix", () => {
    expect(applied("  const t = props.a?.b;\n  return <Text>{t.c}</Text>")).toContain("<Text>{(props.a?.b).c}</Text>");
    expect(applied("  const l = props.a?.b;\n  return <Text>{l.length}</Text>")).toContain("{(props.a?.b).length}");
    expect(applied("  const l = props.a?.b;\n  return <Text>{l}</Text>")).toContain("<Text>{props.a?.b}</Text>");
    expect(applied("  const l = props.a.b;\n  return <Text>{l.c}</Text>")).toContain("<Text>{props.a.b.c}</Text>");
    for (const use of ["fmt(1)", "fmt?.(1)", "fmt`x`"]) {
      const ds = e1405(`const fmt = props.format; return <Text>{${use}}</Text>`);
      expect([ds.length, ds[0]?.fix], use).toEqual([1, undefined]);
    }
  });

  it("property: the fixed binding gives the value or the throw the const did, over initializers, uses and props", () => {
    const inits = fc.constantFrom("props.a?.b", "props.a.b", "props.a ?? props.b", 'props.a || "x"', "props.a?.b ?? 1");
    const uses = fc.constantFrom("v", "v.c", "v?.c", "v[0]", "`${v}`", "v.c.d");
    const leaf = fc.constantFrom(undefined, null, "s", 0, { c: 1 }, { c: { d: 2 } });
    const value = fc.oneof(leaf, fc.record({ b: leaf, c: leaf }));
    const run = (f: (p: unknown) => unknown, p: unknown): unknown => {
      try {
        return { value: f(p) };
      } catch {
        return "throws";
      }
    };
    fc.assert(
      fc.property(inits, uses, value, value, (init, use, a, b) => {
        const fixed = applied(`  const v = ${init};\n  return <Text>{${use}}</Text>`);
        const read = /<Text>\{(.*)\}<\/Text>/.exec(fixed)?.[1] ?? "";
        const before = new Function("props", `const v = ${init}; return ${use};`);
        const after = new Function("props", `return ${read};`);
        expect(
          run((p) => after(p), { a, b }),
          read,
        ).toEqual(run((p) => before(p), { a, b }));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe("E1405: a keyed For row's const read once from the item", () => {
  const row = (body: string, key = ' key="id"', fn = "(t) =>"): string =>
    `return <For each={props.items}${key}>{${fn} { ${body} }}</For>`;

  it("reports a row const read from the item or props and used in a row binding", () => {
    const ds = e1405(row("const label = t.label; return <Text>{label}</Text>;"));
    expect(ds.map((d) => d.message)).toEqual(["t.label read once in C; read it in the binding"]);
    expect(e1405(row("const label = t.a?.b ?? props.label; return <Box id={label}>x</Box>;"))).toHaveLength(1);
    expect(e1405(row("const c = props.label; return <Text>{c}</Text>;"))).toHaveLength(1);
    expect(e1405(row("const label = t.label; return <Text>{label}</Text>;", ' key="id"', "function (t)"))).toHaveLength(
      1,
    );
  });

  it("does not report an unkeyed row, a handler or nested function use, or a non-read initializer", () => {
    expect(e1405(row("const label = t.label; return <Text>{label}</Text>;", ""))).toEqual([]);
    expect(e1405(row("const l = t.label; return <Button onClick={() => alert(l)}>x</Button>;"))).toEqual([]);
    expect(e1405(row("const l = fmt(t.label); return <Text>{l}</Text>;"))).toEqual([]);
    expect(e1405(row("const l = t; return <Text>{l.label}</Text>;"))).toEqual([]);
    expect(e1405(row("let l = t.label; return <Text>{l}</Text>;"))).toEqual([]);
    expect(e1405(row("const l = other.label; return <Text>{l}</Text>;"))).toEqual([]);
    expect(e1405(row("const t2 = (t) => t.label; return <Text>{t2(t)}</Text>;"))).toEqual([]);
  });

  it("the fix reads the item in the binding and drops the const, and the fixed source reports no E1405", () => {
    const fixed = applied(`  ${row("const label = t.label;\n  return <Text>{label}</Text>;")}`);
    expect(fixed).toContain("return <Text>{t.label}</Text>;");
    expect(fixed).not.toContain("const label");
    expect(compile([{ path: "C.tsx", source: fixed }]).diagnostics.map((d) => d.code)).not.toContain("E1405");
  });
});
