// Spec: k.claim, Check "Clean: a thunk or render function making its elements inside it; a parameter or `props.children`; a string, number, signal or computed; a call no file resolves to a component; `Case` in `Match`; test files. Not followed: `let` reassignment, members, destructuring, other functions' returns, IIFEs, packages outside the project, and a component reading an element-valued prop before making its own element."
// Spec: k.claim, Conformance "None: thunks or render functions making their elements, `props.children`, strings, signals, `String(n)`, a callee no file resolves, `Match` with `Case`s, an element returned or placed in order, and a base element E1808 reports (one diagnostic)."
// Seed 1337 (fc.assert below). Each fixture is a project tree and reports no E1258; none reports E1808 except where the name says so.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { check } from "@keel/check";
import { repoRoot } from "@keel/tooling/repo-root";
import fc from "fast-check";
import { expect, test } from "vitest";
import { COMPONENTS, NO_TYPES, e1258, page } from "./E1258-support.ts";
import { type Files, SEED } from "./support.ts";

type Clean = { readonly name: string; readonly files: Files };

const CLEAN: readonly Clean[] = [
  {
    name: "a thunk making its element inside it: `Card({ children: () => Text({ children: 'x' }) })`",
    files: page("  return Card({ children: () => Text({ children: 'x' }) })"),
  },
  {
    name: "a thunk returning an array of elements made inside it: `Card({ children: () => [A(), B()] })`",
    files: page("  return Card({ children: () => [A(), B()] })"),
  },
  {
    name: "a thunk mapping a list inside it: `Card({ children: () => xs.map((x) => Text({ children: x })) })`",
    files: page("  return Card({ children: () => props.xs.map((x) => Text({ children: x })) })"),
  },
  {
    name: "a render function of `DataTable` cells: `cells: { price: (row) => Text(...) }`",
    files: page(
      "  return DataTable({ id: 't', label: 'T', cells: { price: (row: { price: string }) => Text({ children: row.price }) } })",
    ),
  },
  {
    name: "a render function of `Form` `error`: `Form({ error: (e) => Text({ children: e.code }) })`",
    files: page(
      "  return Form({ method: 'POST', action: '/x', error: (e: { code: string }) => Text({ children: e.code }) })",
    ),
  },
  {
    name: "a render function of `For`: `For({ each, children: (x) => Text(...) })`",
    files: page("  return For({ each: props.xs, key: 'id', children: (x: string) => Text({ children: x }) })"),
  },
  {
    name: "a binding made inside the thunk: `Card({ children: () => { const t = Text(...); return [t, Button(...)] } })`",
    files: page(
      "  return Card({ children: () => { const t = Text({ children: 'x' }); return [t, Button({ onClick: () => undefined, children: 'b' })] } })",
    ),
  },
  {
    name: "`Card({ children: props.children })`",
    files: page("  return Card({ children: props.children })"),
  },
  {
    name: "a parameter `children` passed down",
    files: page(
      "  return Wrapper(props.children)",
      "tsx",
      "function Wrapper(children: unknown) { return Card({ children }) }\n",
    ),
  },
  { name: "`Card({ icon: props.icon })`", files: page("  return Card({ icon: props.icon })") },
  { name: "a string: `Card({ children: 'x' })`", files: page("  return Card({ children: 'x' })") },
  { name: "a number: `Card({ children: 5 })`", files: page("  return Card({ children: 5 })") },
  { name: "a template literal", files: page("  return Card({ children: `n ${props.n}` })") },
  { name: "a signal: `Card({ children: signal(0) })`", files: page("  return Card({ children: signal(0) })") },
  {
    name: "a computed: `Card({ children: computed(() => props.n) })`",
    files: page("  return Card({ children: computed(() => props.n) })"),
  },
  { name: "`Card({ children: String(n) })`", files: page("  return Card({ children: String(props.n) })") },
  {
    name: "`Card({ children: t('key') })`",
    files: page("  return Card({ children: t('key') })", "tsx", "declare function t(key: string): string\n"),
  },
  {
    name: "`Card({ children: formatNumber(n) })`",
    files: page(
      "  return Card({ children: formatNumber(props.n) })",
      "tsx",
      "declare function formatNumber(n: number): string\n",
    ),
  },
  {
    name: "a call no file resolves: `Card({ children: lib.make() })` from an installed package",
    files: page("  return Card({ children: lib.make() })", "tsx", "import * as lib from 'some-installed-package'\n"),
  },
  {
    name: "a call of a project function whose body returns a string: `Card({ children: label(n) })`",
    files: page("  return Card({ children: label(props.n) })"),
  },
  {
    name: "`Match({ on, children: [Case({ value: 'a', children: () => A() })] })`",
    files: page("  return Match({ on: props.n, children: [Case({ value: 'a', children: () => A() })] })"),
  },
  {
    name: "elements made in order and returned: `return [Heading(...), Box(...)]`",
    files: page("  return [Heading({ level: 2, children: 'h' }), Box({ children: () => 'x' })]"),
  },
  {
    name: "elements made in order and placed: `const a = Text(); const b = Box({ children: () => 'x' }); return [a, b]`",
    files: page("  const a = Text({ children: 'a' })\n  const b = Box({ children: () => 'x' })\n  return [a, b]"),
  },
  {
    name: "an element passed to a non-component call: `arr.push(Box(...))`",
    files: page("  const arr: unknown[] = []\n  arr.push(Box({ children: () => 'x' }))\n  return arr"),
  },
  {
    name: "an element passed to a non-component call: `console.log(Text(...))`",
    files: page("  console.log(Text({ children: 'x' }))\n  return null"),
  },
  {
    name: "a call that is not a component call: `navigate(href)`",
    files: page("  navigate('/x')\n  return null", "tsx", "declare function navigate(href: string): void\n"),
  },
  {
    name: "an event prop: `Button({ onClick: () => open(Dialog(...)) })` is not a value holding an element",
    files: page(
      "  return Button({ onClick: () => open(Dialog({ id: 'd' })), children: 'b' })",
      "tsx",
      "declare function open(node: unknown): void\ndeclare function Dialog(props: { id: string }): Node\n",
    ),
  },
  {
    name: "a JSX attribute whose value is JSX: `<Card icon={<Icon />} />`",
    files: page("  return <Card icon={<Icon />} />"),
  },
  { name: "JSX children: `<Card><Icon /></Card>`", files: page("  return <Card><Icon /></Card>") },
  {
    name: "`let` reassignment is not followed",
    files: page("  let el: unknown = null\n  el = Icon()\n  return Card({ icon: el })"),
  },
  {
    name: "a member is not followed: `Card({ icon: o.el })`",
    files: page("  const o = { el: Icon() }\n  return Card({ icon: o.el })"),
  },
  {
    name: "a destructured binding is not followed",
    files: page("  const { el } = { el: Icon() }\n  return Card({ icon: el })"),
  },
  {
    name: "an IIFE is not followed",
    files: page("  return Card({ icon: (() => Icon())() })"),
  },
  {
    name: "a component reading an element-valued prop before making its own element is not reported where it is declared",
    files: page(
      "  return Reader({ icon: props.icon })",
      "tsx",
      "function Reader(p: { icon: unknown }) { const i = p.icon; return Box({ children: () => i }) }\n",
    ),
  },
  {
    name: "a local function named `Form` not imported from a Keel package, whose body returns a string",
    files: [
      COMPONENTS,
      {
        path: "modules/app/Page.tsx",
        source: `import { Text } from '@keel/ui'\nfunction Form(_p: { children?: unknown }) { return 'x' }\nexport default function Page() { return Form({ children: Text({ children: 'x' }) }) }\n`,
      },
    ],
  },
  {
    name: "a local function named `Disclosure` not imported from a Keel package, whose body returns a string",
    files: [
      COMPONENTS,
      {
        path: "modules/app/Page.tsx",
        source: `import { Text } from '@keel/ui'\nfunction Disclosure(_p: { children?: unknown }) { return 'x' }\nexport default function Page() { return Disclosure({ children: Text({ children: 'x' }) }) }\n`,
      },
    ],
  },
  {
    name: "idiom of the golden apps: option lists mapped to plain objects inside a thunk",
    files: page(
      "  return Listbox({ id: 'l', label: 'L', mode: 'single', options: () => props.xs.map((r) => ({ key: r, text: r })), selected: () => [], onChange: () => undefined })",
      "tsx",
      "import { Listbox } from '@keel/std-headless'\n",
    ),
  },
  {
    name: "idiom of the golden apps: `Disclosure` children as a thunk holding a parenthesised element",
    files: page("  return Disclosure({ id: 'd', summary: () => 'S', children: () => (<Box><Text>body</Text></Box>) })"),
  },
  {
    name: "idiom of the golden apps: `<DataTable empty={() => <Text>none</Text>} />`",
    files: page("  return <DataTable id='t' label='T' empty={() => <Text>none</Text>} />"),
  },
  {
    name: "idiom of the golden apps: `<Form>` with JSX children",
    files: page(
      "  return <Form method='POST' action='/x'><Input label='Name' onInput={() => undefined} /><Button onClick={() => undefined}>Save</Button></Form>",
    ),
  },
];

for (const c of CLEAN) {
  test(`${c.name} reports no E1258`, () => {
    const ds = check(c.files, NO_TYPES).diagnostics.filter((d) => d.code === "E1258");
    expect(ds).toEqual([]);
  });
}

test("`Box({ children: Input(...) })` is one E1808 and no E1258", () => {
  const files = page("  return Box({ children: Input({ label: 'L', onInput: () => undefined }) })");
  const ds = check(files, NO_TYPES).diagnostics;
  expect(ds.filter((d) => d.code === "E1808")).toHaveLength(1);
  expect(ds.filter((d) => d.code === "E1258")).toEqual([]);
});

test("an eager child of a base element in an array or held by a const is E1808 and not E1258", () => {
  for (const body of [
    "  return Box({ children: [Text({ children: 'a' })] })",
    "  const t = Text({ children: 'a' })\n  return Box({ children: t })",
  ]) {
    const ds = check(page(body), NO_TYPES).diagnostics;
    expect(ds.filter((d) => d.code === "E1808")).toHaveLength(1);
    expect(ds.filter((d) => d.code === "E1258")).toEqual([]);
  }
});

test("the same reporting cases in a `*.test.ts` or `*.test.tsx` file report no E1258", () => {
  const cases: readonly [string, "ts" | "tsx"][] = [
    ["  return Card({ icon: Icon() })", "tsx"],
    ["  const el = <Icon />\n  return <Card icon={el} />", "tsx"],
    ["  return Card({ children: [Input({ label: 'L', onInput: () => undefined })] })", "tsx"],
  ];
  for (const [body, ext] of cases) {
    const files = page(body, ext).map((x) =>
      x.path.startsWith("modules/app/Page.") ? { path: `modules/app/Page.test.${ext}`, source: x.source } : x,
    );
    expect(e1258(files)).toEqual([]);
    const live = e1258(page(body, ext));
    expect(live.length).toBeGreaterThan(0);
  }
});

test("no `Card({ children: <shape> })` of a string, a number, a signal or a parameter reports E1258 for any prop name (property)", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("children", "icon", "footer", "header"),
      fc.constantFrom(
        "'x'",
        "7",
        "`t${props.n}`",
        "signal(1)",
        "computed(() => 1)",
        "String(props.n)",
        "props.children",
        "props.icon",
        "label(props.n)",
      ),
      (prop, value) => {
        expect(e1258(page(`  return Card({ ${prop}: ${value} })`))).toEqual([]);
        expect(e1258(page(`  return Card({ ${prop}: () => ${value} })`))).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 40 },
  );
});

/** Every `.ts` and `.tsx` file under `dir`, with paths relative to `base`. */
function sourcesUnder(dir: string, base: string): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "node_modules") out.push(...sourcesUnder(full, base));
    } else if (/\.tsx?$/.test(name)) {
      out.push({ path: full.slice(base.length + 1), source: readFileSync(full, "utf8") });
    }
  }
  return out;
}

for (const app of ["golden-1", "golden-2"]) {
  test(`the source of apps/${app} reports no E1258`, () => {
    const root = join(repoRoot(import.meta.dirname), "apps", app);
    const files = sourcesUnder(join(root, "modules"), root);
    expect(files.length).toBeGreaterThan(0);
    const ds = check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1258");
    expect(ds).toEqual([]);
  });
}
