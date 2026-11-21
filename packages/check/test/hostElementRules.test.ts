// E1802 on `Host` calls, E1824 and E1825 beyond the conformance cases: calls, aliases, namespaces, paths (k.host-element, k.host-code).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/index.ts";
import type { SourceFile } from "../src/index.ts";

const f = (path: string, source: string): SourceFile => ({ path, source });
const HEAD =
  "import { s } from '@keel/schema'\nimport { Host } from '@keel/ui'\nconst In = s.object({ n: s.number() })\n";
const CODE = "() => import('./chart.ts').then((m) => m.chart)";
const hits = (code: string, files: SourceFile[]): string[] =>
  check(files, { types: false })
    .diagnostics.filter((d) => d.code === code)
    .map((d) => `${d.path} ${d.line}:${d.col} ${d.message}${d.fix === undefined ? "" : " +fix"}`);
const call = (props: string): SourceFile =>
  f(
    "modules/a/c.ts",
    `${HEAD}export const c = () => Host({ id: 'c.h', role: 'img', input: In, value: { n: 1 }, code: ${CODE}${props} })\n`,
  );

describe("E1802 on Host", () => {
  it("a JSX Host with neither name is one finding at the element, no fix", () => {
    const src = `${HEAD}export default function C() { return <Host id="c.h" role="img" input={In} value={{ n: 1 }} code={${CODE}} /> }\n`;
    expect(hits("E1802", [f("modules/a/C.tsx", src)])).toEqual([
      "modules/a/C.tsx 4:39 <Host> needs exactly one of label and labelledBy",
    ]);
  });

  it("a Host call with neither or both is reported, one with one, a spread or a blank label once", () => {
    expect(hits("E1802", [call("")])).toHaveLength(1);
    expect(hits("E1802", [call(", label: 'L', labelledBy: 'c.t'")])).toHaveLength(1);
    expect(hits("E1802", [call(", label: 'L'")])).toEqual([]);
    expect(hits("E1802", [call(", ...rest")])).toEqual([]);
    expect(hits("E1802", [call(", label: ' '")])).toEqual([
      "modules/a/c.ts 4:138 <Host> label is blank; it must name the element",
    ]);
  });

  it("a namespace import and an alias are followed; a Host from elsewhere is not read", () => {
    const ns = `import * as ui from '@keel/ui'\nexport const C = () => <ui.Host id="c" role="img" />\n`;
    const alias = `import { Host as H } from '@keel/ui'\nexport const C = () => <H id="c" role="img" />\n`;
    const other = `import { Host } from './Host.tsx'\nexport const C = () => <Host id="c" role="img" />\n`;
    expect(hits("E1802", [f("modules/a/C.tsx", ns)])).toHaveLength(1);
    expect(hits("E1802", [f("modules/a/C.tsx", alias)])).toHaveLength(1);
    expect(hits("E1802", [f("modules/a/C.tsx", other)])).toEqual([]);
  });
});

describe("E1824", () => {
  it("names the code prop's form at the prop, and a missing input at the element, no fix", () => {
    const src = `${HEAD}export default function C() { return <Host id="c.h" role="img" label="L" code={load} /> }\n`;
    expect(hits("E1824", [f("modules/a/C.tsx", src)])).toEqual([
      "modules/a/C.tsx 4:39 <Host> has no input; give it the schema of its value",
      'modules/a/C.tsx 4:74 <Host> code must be () => import("./x.ts").then((m) => m.x)',
    ]);
  });

  it("reads a Host call's object literal; a spread may give input, a parenthesized literal form passes", () => {
    expect(hits("E1824", [call(", label: 'L'")])).toEqual([]);
    const bad = `${HEAD}export const c = () => Host({ id: 'c', role: 'img', label: 'L', code: () => import('./x.ts') })\n`;
    expect(hits("E1824", [f("modules/a/c.ts", bad)])).toHaveLength(2);
    const spread = `${HEAD}export const c = (p: object) => Host({ ...p, code: (() => (import('../x.ts')).then((m) => (m.x))) })\n`;
    expect(hits("E1824", [f("modules/a/c.ts", spread)])).toEqual([]);
  });

  it("an async arrow, a block body, an import with options or an optional member are reported", () => {
    for (const code of [
      "async () => import('./x.ts').then((m) => m.x)",
      "() => { return import('./x.ts').then((m) => m.x) }",
      "() => import('./x.ts', { with: {} }).then((m) => m.x)",
      "() => import('./x.ts').then((m) => m?.x)",
      "() => import('./x.ts').then((m) => n.x)",
      "() => import('./x.ts').then(({ x }) => x)",
      "() => import('./x.ts')?.then((m) => m.x)",
    ]) {
      const src = `${HEAD}export const c = () => Host({ id: 'c', role: 'img', label: 'L', input: In, code: ${code} })\n`;
      expect(hits("E1824", [f("modules/a/c.ts", src)])).toHaveLength(1);
    }
  });
});

describe("E1825", () => {
  const page = (dir: string, spec: string): SourceFile =>
    f(
      `${dir}/C.tsx`,
      `${HEAD}export default function C() { return <Host id="c.h" role="img" label="L" input={In} value={{ n: 1 }} code={() => import('${spec}').then((m) => m.chart)} /> }\n`,
    );

  it("one finding per stylesheet specifier, a dynamic import and a query included, no fix", () => {
    const src = "import './a.css'\nimport 'x/b.css?inline'\nexport const d = () => import('./c.css')\n";
    expect(hits("E1825", [f("modules/a/d.ts", src)])).toEqual([
      "modules/a/d.ts 1:1 stylesheet imported outside a host element code file; import it from the Host's code",
      "modules/a/d.ts 2:1 stylesheet imported outside a host element code file; import it from the Host's code",
      "modules/a/d.ts 3:24 stylesheet imported outside a host element code file; import it from the Host's code",
    ]);
  });

  it("a code file reached by `../`, or by a specifier without an extension, may import a stylesheet", () => {
    const code = f("modules/lib/chart.ts", "import 'x/a.css'\nexport const chart = 1\n");
    expect(hits("E1825", [page("modules/a", "../lib/chart.ts"), code])).toEqual([]);
    expect(hits("E1825", [page("modules/lib", "./chart"), code])).toEqual([]);
    expect(hits("E1825", [page("modules/a", "./chart.ts"), code])).toHaveLength(1);
  });

  it("a code prop outside the literal form makes no host element code file", () => {
    const pageOf = `${HEAD}const load = () => import('./chart.ts').then((m) => m.chart)\nexport default function C() { return <Host id="c" role="img" label="L" input={In} code={load} /> }\n`;
    const code = f("modules/a/chart.ts", "import 'x/a.css'\nexport const chart = 1\n");
    expect(hits("E1825", [f("modules/a/C.tsx", pageOf), code])).toHaveLength(1);
  });

  it("property: a `.css` import is reported in any app file no code prop names, never in a test or under unsafe/", () => {
    const seg = fc.stringMatching(/^[a-z]{2,8}$/);
    fc.assert(
      fc.property(seg, seg, (dir, file) => {
        const src = `import './${file}.css'\nexport const ${file} = 1\n`;
        expect(hits("E1825", [f(`modules/${dir}/${file}.ts`, src)])).toHaveLength(1);
        expect(hits("E1825", [f(`modules/${dir}/${file}.test.ts`, src)])).toEqual([]);
        expect(hits("E1825", [f(`modules/${dir}/unsafe/${file}.ts`, src)])).toEqual([]);
      }),
      { seed: 1337, numRuns: 50 },
    );
  });
});
