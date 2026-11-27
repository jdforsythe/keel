// @vitest-environment happy-dom
// Backlog 0165 / rfc:0061: elements in a JSX child expression are E1403 and bind nothing, so the repro
// `{p.on ? <b/> : <i/>}` no longer renders "[object …]"; where `If` is imported the fix rewrites `&&`/`?:` to
// `<If when fallback>`, whose `fallback` the lowering now passes to `cond`.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { tempDir } from "@keel/tooling/test-tmp";
import { describe, expect, it } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1 });

type Mountable = Parameters<typeof mount>[0];
const isMountable = (x: unknown): x is Mountable => typeof x === "function";

function build(source: string): { C: Mountable; codes: string[]; fixes: (string | undefined)[] } {
  const r = compile([{ path: "C.tsx", source }]);
  const C = evaluate(r.outputs[0]?.code ?? "");
  if (!isMountable(C)) throw new Error("no default export");
  const e1403 = r.diagnostics.filter((d) => d.code === "E1403");
  return { C, codes: r.diagnostics.map((d) => d.code), fixes: e1403.map((d) => d.fix) };
}

function html(C: Mountable, props: Record<string, unknown>): string {
  const host = document.createElement("div");
  const dispose = mount(() => Reflect.apply(C, undefined, [props, simCtx]), host, { ctx: simCtx });
  const out = host.innerHTML;
  dispose();
  return out;
}

function apply(source: string, fix: string): string {
  const dir = tempDir(".tmp-0165-", import.meta.dirname);
  try {
    fs.writeFileSync(path.join(dir, "C.tsx"), source);
    fs.writeFileSync(path.join(dir, "fix.patch"), `${fix}\n`);
    const env = { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(dir) };
    execFileSync("git", ["apply", "fix.patch"], { cwd: dir, env, stdio: "pipe" });
    return fs.readFileSync(path.join(dir, "C.tsx"), "utf8");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const wrap = (child: string, pre = ""): string =>
  `${pre}export default function C(p) { return <div><span>a</span>${child}<span>z</span></div> }`;

/** Each child holds elements; each is one E1403 and renders nothing between the spans. */
const COVERED: [string, string, string][] = [
  ["backlog 0165 repro: ?: with element branches", "{p.on ? <b/> : <i/>}", ""],
  ["?: with one element branch", "{p.on ? <b/> : 'no'}", ""],
  ["&& with an element", "{p.on && <b/>}", ""],
  ["|| with an element", "{p.name || <i>none</i>}", ""],
  ["?? with an element", "{p.name ?? <i>none</i>}", ""],
  ["nested conditional", "{p.on ? (p.x ? <b/> : null) : null}", ""],
  ["array literal of elements", "{[<b/>, <i/>]}", ""],
  ["map() returning elements", "{p.xs.map((x) => <li>{x}</li>)}", ""],
  ["map() with a named function", "{p.xs.map(row)}", "const row = (x) => <li>{x}</li>\n"],
  ["a function child", "{() => <b/>}", ""],
  ["an immediately called function", "{(() => <b/>)()}", ""],
  ["a call of a same-file function", "{part(p.on)}", "function part(on) { if (on) return <b/>; return null }\n"],
  ["a same-file binding holding elements", "{icon}", "const icon = <b/>\n"],
];

describe("E1403: elements in a JSX child expression (rfc:0061)", () => {
  for (const [name, child, pre] of COVERED)
    it(`${name}: one E1403, binds nothing, never "[object"`, () => {
      const { C, codes } = build(wrap(child, pre));
      expect(codes).toEqual(["E1403"]);
      const out = html(C, { on: true, name: "", xs: ["1", "2"], x: true });
      expect(out).not.toContain("[object");
      expect(out).not.toContain("=&gt;");
      expect(out).toMatch(/<span id="C\.\d+">a<\/span><span id="C\.\d+">z<\/span>/);
    });

  const CLEAN: [string, string, string][] = [
    ["text conditional", "{p.on ? 'yes' : 'no'}", ""],
    ["&& with text", "{p.on && p.name}", ""],
    ["an element on the left of && (always the right)", "{<b/> && p.name}", ""],
    ["map() returning text", "{p.xs.map((x) => x + ',')}", ""],
    ["a call of a function returning text", "{label(p.name)}", "const label = (s) => s.toUpperCase()\n"],
    ["slot call", "{p.children?.()}", ""],
    ["literal element", "{<b/>}", ""],
  ];
  for (const [name, child, pre] of CLEAN)
    it(`${name}: no E1403`, () => {
      expect(build(wrap(child, pre)).codes).toEqual([]);
    });

  it("a lone function child of If, For and Boundary is its render callback, not E1403", () => {
    const src = `import { If, For, Boundary } from '@keel/runtime-dom'
export default function C(p) { return <div><If when={p.on}>{() => <b/>}</If><For each={p.xs} key="id">{(x) => <i/>}</For><Boundary fallback={() => <u/>}>{() => <s/>}</Boundary></div> }`;
    expect(build(src).codes).toEqual([]);
  });

  it("If fallback renders when the condition is false (lowered to cond's otherwise)", () => {
    const src = `import { If } from '@keel/runtime-dom'
export default function C(p) { return <div><If when={p.on} fallback={() => <i>no</i>}><b>yes</b></If></div> }`;
    const { C, codes } = build(src);
    expect(codes).toEqual([]);
    expect(html(C, { on: true })).toMatch(/<b[^>]*>yes<\/b>/);
    expect(html(C, { on: false })).toMatch(/<i[^>]*>no<\/i>/);
    expect(html(C, { on: false })).not.toContain("yes");
  });

  const FIXED: [string, string, Record<string, unknown>, string][] = [
    ["?: both elements", "{p.on ? <b>yes</b> : <i>no</i>}", { on: false }, "<i"],
    ["?: else null", "{p.on ? <b>yes</b> : null}", { on: true }, "<b"],
    ["?: then undefined", "{p.on ? undefined : <i>no</i>}", { on: false }, "<i"],
    ["&&", "{p.on && <b>yes</b>}", { on: true }, "<b"],
  ];
  for (const [name, child, props, tag] of FIXED)
    it(`fix for ${name} applies with git apply, compiles clean and renders the branch`, () => {
      const src = wrap(child, "import { If } from '@keel/runtime-dom'\n");
      const fix = build(src).fixes[0];
      expect(typeof fix).toBe("string");
      const patched = apply(src, fix ?? "");
      expect(patched).toContain("<If when=");
      const { C, codes } = build(patched);
      expect(codes).toEqual([]);
      expect(html(C, props)).toContain(tag);
    });

  it("the fix reuses a local name already imported for If", () => {
    const src = wrap("{p.on && <b/>}", "import { If as When } from '@keel/runtime-dom'\n");
    const fix = build(src).fixes[0] ?? "";
    expect(fix).toContain("<When when={p.on}><b/></When>");
  });

  it("no fix when the file does not import If (the import would be a second hunk)", () => {
    expect(build(wrap("{p.on && <b/>}")).fixes).toEqual([undefined]);
  });

  it("no fix where the rewrite is not mechanical (a list, a text branch, ||)", () => {
    for (const child of ["{[<b/>]}", "{p.on ? <b/> : 'no'}", "{p.name || <i/>}"])
      expect(build(wrap(child, "import { If } from '@keel/runtime-dom'\n")).fixes).toEqual([undefined]);
  });
});

describe("E1403 resolves names by lexical scope, not by text (backlog 0176)", () => {
  it("a module-level text helper beside another component's local element helper of the same name: E1403 only in Other, C renders the text", () => {
    const src = `function Other() { const row = (x) => <li/>; return <ul>{row(1)}</ul> }
const row = (x) => 'txt'
export default function C(p) { return <div>{row(p)}</div> }`;
    const r = compile([{ path: "C.tsx", source: src }]);
    expect(r.diagnostics.filter((x) => x.code === "E1403").map((x) => x.line)).toEqual([1]);
    expect(html(build(src).C, {})).toContain("txt");
  });

  it("swapped: the module-level helper returns an element and the local one text: E1403 at the module-level call", () => {
    const src = `function Other() { const row = (x) => 'txt'; return <ul>{row(1)}</ul> }
const row = (x) => <li/>
export default function C(p) { return <div>{row(p)}</div> }`;
    const r = compile([{ path: "C.tsx", source: src }]);
    const d = r.diagnostics.filter((x) => x.code === "E1403");
    expect(d.map((x) => x.line)).toEqual([3]);
  });

  it("a function declaration shadowed by a parameter is not followed", () => {
    const src = `function row() { return <b/> }
export default function C(p) { const f = (row) => <i>{row()}</i>; return <div>{p.xs.map((row) => row)}{f(() => 'x')}</div> }`;
    expect(build(src).codes).toEqual(["E1403"]);
  });

  it("a map parameter shadowing a module const element is not the element: clean, the list text renders", () => {
    const src = `const row = <b/>
export default function C(p) { return <div>{p.xs.map((row) => row)}</div> }`;
    const { C, codes } = build(src);
    expect(codes).toEqual([]);
    expect(html(C, { xs: ["x", "y"] })).toContain("x,y");
  });

  it("an alias of a function declaration is followed: const k = f; {k()} is E1403", () => {
    expect(build(wrap("{k()}", "function f() { return <b/> }\nconst k = f\n")).codes).toEqual(["E1403"]);
  });
});

describe("forms the compiler cannot see render nothing at runtime (backlog 0175, rfc:0061 runtime half)", () => {
  const UNSEEN: [string, string][] = [
    ["{[<b/>][0]}", ""],
    ["{[<b/>].at(0)}", ""],
    ["{o.el}", "const o = { el: <b/> }\n"],
    ["{h.r()}", "const h = { r: () => <b/> }\n"],
    ["{`${<b/>}`.length > 0 ? p.icon : ''}", ""],
    ["{p.icon}", ""],
    ["{p.list}", ""],
  ];
  for (const [child, pre] of UNSEEN)
    it(`${child} renders no "[object" and no element markup as text`, () => {
      const { C } = build(wrap(child, pre));
      const out = html(C, { icon: document.createElement("b"), list: ["a", document.createElement("i")] });
      expect(out).not.toContain("[object");
      expect(out).not.toContain("&lt;");
      expect(out).toMatch(/<span id="C\.\d+">a<\/span><span id="C\.\d+">z<\/span>/);
    });
});
