// Spec: k.claim, Check "In app code, a value given to a component as `children` or any other prop that holds an element made before the call is E1258 at the value, unless E1808 reports it. A component is a base element, `Part`, an intrinsic, `Form`, a std widget, or a function the check resolves through the project's files whose body returns JSX or a component call. Made before the call: a JSX element or fragment or a component call outside a thunk; an array holding one; `xs.map(f)` with `f` returning one, outside a thunk; each branch of `?:`, `&&`, `||` and `??`; a binding whose initializer is one of these (same file, or a `const` imported from a project file), also when a thunk given as the prop returns it, alone or in an array, and the binding is declared outside that thunk. A JSX attribute holding such a binding counts."
// Spec: k.claim, Rules "E1258 an element made before the component call it is passed to (fix: `() =>`; none for a binding)"
// Spec: k.claim, Conformance "`Card({ icon: Icon() })`, `Card({ children: [Input(...)] })`, `Disclosure({ children: xs.map((x) => Text(x)) })`, `Card({ children: ok ? A() : 'x' })`, `<Card icon={el} />` with `const el = <Icon />`, and `Form({ children: () => [el] })` with `el` a component call before it or a `const` imported from another project file are each one E1258; the inline ones' fix applies and re-checks clean."
// Seed 1337 (fc.assert below). Each fixture is a project tree, so imports resolve through the project's files.
import fc from "fast-check";
import { expect, test } from "vitest";
import { applyFix, e1258, lineOf, page } from "./E1258-support.ts";
import { type Files, SEED } from "./support.ts";

type Positive = {
  readonly name: string;
  readonly files: Files;
  /** Text on the line of the value. */
  readonly needle: string;
  /** Whether the diagnostic carries the `() =>` fix. */
  readonly fix: boolean;
};

const POSITIVE: readonly Positive[] = [
  {
    name: "`Card({ icon: Icon() })` with Card and Icon app components is one E1258 at the value",
    files: page("  return Card({ icon: Icon() })"),
    needle: "Icon()",
    fix: true,
  },
  {
    name: "`Card({ icon: Icon() })` in a `.ts` file is one E1258",
    files: page("  return Card({ icon: Icon() })", "ts"),
    needle: "Icon()",
    fix: true,
  },
  {
    name: "`Card({ children: [Input(...)] })` is one E1258",
    files: page("  return Card({ children: [Input({ label: 'L', onInput: () => undefined })] })"),
    needle: "[Input(",
    fix: true,
  },
  {
    name: "`Card({ children: <Icon /> })` written as a call in a .tsx file is one E1258",
    files: page("  return Card({ children: <Icon /> })"),
    needle: "<Icon />",
    fix: true,
  },
  {
    name: "`Disclosure({ children: xs.map((x) => Text(x)) })` is one E1258",
    files: page(
      "  return Disclosure({ id: 'd', summary: () => 'S', children: props.xs.map((x) => Text({ children: x })) })",
    ),
    needle: "props.xs.map",
    fix: true,
  },
  {
    name: "`Card({ children: xs.map(item) })` with `item` returning an element is one E1258",
    files: page(
      "  return Card({ children: props.xs.map(item) })",
      "tsx",
      "function item(x: string) { return Text({ children: x }) }\n",
    ),
    needle: "props.xs.map(item)",
    fix: true,
  },
  {
    name: "`Card({ children: ok ? A() : 'x' })` is one E1258",
    files: page("  return Card({ children: props.ok ? A() : 'x' })"),
    needle: "props.ok ?",
    fix: true,
  },
  {
    name: "`Card({ children: ok && A() })` is one E1258",
    files: page("  return Card({ children: props.ok && A() })"),
    needle: "props.ok &&",
    fix: true,
  },
  {
    name: "`Card({ children: a ?? A() })` is one E1258",
    files: page("  return Card({ children: props.a ?? A() })"),
    needle: "props.a ??",
    fix: true,
  },
  {
    name: "`Card({ children: a || A() })` is one E1258",
    files: page("  return Card({ children: props.a || A() })"),
    needle: "props.a ||",
    fix: true,
  },
  {
    name: "`DataTable({ empty: Text(...) })` written in app code is one E1258",
    files: page("  return DataTable({ id: 't', label: 'T', empty: Text({ children: 'none' }) })"),
    needle: "empty: Text(",
    fix: true,
  },
  {
    name: "`Card({ footer: Shell({}) })` with `Shell` a project function returning `<Box>` is one E1258",
    files: page("  return Card({ footer: Shell({}) })"),
    needle: "Shell({})",
    fix: true,
  },
  {
    name: "`<Card icon={el} />` with `const el = <Icon />` is one E1258 at the attribute value and carries no fix",
    files: page("  const el = <Icon />\n  return <Card icon={el} />"),
    needle: "icon={el}",
    fix: false,
  },
  {
    name: "`Form({ children: () => [c] })` with `const c = Card(props)` before the thunk is one E1258 and carries no fix",
    files: page("  const c = Card(props)\n  return Form({ method: 'POST', action: '/x', children: () => [c] })"),
    needle: "[c]",
    fix: false,
  },
  {
    name: "`Part({ children: () => t })` with `const t = Text(...)` declared outside the thunk is one E1258 and carries no fix",
    files: page("  const t = Text({ children: 'x' })\n  return Part({ id: 'p', role: 'generic', children: () => t })"),
    needle: "children: () => t",
    fix: false,
  },
  {
    name: "`Card({ children: () => header })` with `header` a `const` imported from another project file is one E1258 and carries no fix",
    files: page("  return Card({ children: () => header })", "tsx", "import { header } from './ui/header.ts'\n"),
    needle: "children: () => header",
    fix: false,
  },
  {
    name: "`Card({ children: header })` with `header` a `const` imported from another project file is one E1258",
    files: page("  return Card({ children: header })", "tsx", "import { header } from './ui/header.ts'\n"),
    needle: "children: header",
    fix: false,
  },
  {
    name: "`const icon = Icon(); Card({ icon })` is one E1258",
    files: page("  const icon = Icon()\n  return Card({ icon })"),
    needle: "Card({ icon })",
    fix: false,
  },
  {
    name: "`const items = xs.map(...)` then `Card({ children: () => items })` is one E1258",
    files: page("  const items = props.xs.map((x) => Text({ children: x }))\n  return Card({ children: () => items })"),
    needle: "children: () => items",
    fix: false,
  },
  {
    name: "a binding returned by the thunk in an array, declared outside it, is one E1258",
    files: page("  const c = Icon()\n  return Card({ children: () => [c, 'x'] })"),
    needle: "[c, 'x']",
    fix: false,
  },
];

for (const p of POSITIVE) {
  test(p.name, () => {
    const ds = e1258(p.files);
    expect(ds).toHaveLength(1);
    const [d] = ds;
    expect(d?.path).toBe(p.files.find((x) => x.path.startsWith("modules/app/Page."))?.path);
    expect(d?.line).toBe(lineOf(p.files, p.needle, d?.path));
    if (p.fix) expect(typeof d?.fix).toBe("string");
    else expect(d?.fix).toBeUndefined();
  });
}

for (const p of POSITIVE.filter((x) => x.fix)) {
  test(`the fix of E1258 applies with git apply and re-checking reports no E1258: ${p.name}`, () => {
    const [d] = e1258(p.files);
    const fix = d?.fix;
    expect(typeof fix).toBe("string");
    if (fix === undefined) return;
    expect(fix.startsWith("--- a/")).toBe(true);
    expect(fix).toContain("() =>");
    const patched = applyFix(p.files, fix);
    expect(patched).not.toEqual(p.files);
    expect(e1258(patched)).toEqual([]);
  });
}

test("an element made before the call is E1258 for any component, prop name and eager shape (property)", () => {
  const components = ["Card", "Disclosure", "Part", "Form"] as const;
  const props = ["children", "icon", "footer", "header"] as const;
  const shapes = [
    (c: string) => c,
    (c: string) => `[${c}]`,
    (c: string) => `props.ok ? ${c} : 'x'`,
    (c: string) => `props.ok && ${c}`,
    (c: string) => `props.a ?? ${c}`,
    (c: string) => `props.a || ${c}`,
    (_c: string) => "props.xs.map((x) => Text({ children: x }))",
  ] as const;
  const wrap = (component: (typeof components)[number], prop: string, value: string): string => {
    const extra =
      component === "Form"
        ? "method: 'POST', action: '/x', "
        : component === "Part"
          ? "id: 'p', role: 'generic', "
          : "";
    return `  return ${component}({ ${extra}${prop}: ${value} })`;
  };
  fc.assert(
    fc.property(
      fc.constantFrom(...components),
      fc.constantFrom(...props),
      fc.constantFrom(...shapes),
      fc.constantFrom("Icon()", "A()", "<Icon />", "Text({ children: 'x' })"),
      (component, prop, shape, element) => {
        const files = page(wrap(component, prop, shape(element)));
        expect(e1258(files)).toHaveLength(1);
        const thunked = page(wrap(component, prop, `() => ${shape(element)}`));
        expect(e1258(thunked)).toEqual([]);
      },
    ),
    { seed: SEED, numRuns: 60 },
  );
});
