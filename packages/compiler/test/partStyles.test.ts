// Part styles collection: `Part` from `@keel/ui/aria` is collected as a base element; `styles` on a `@keel/std-*`
// component is collected per part and never rewritten; other components' `styles` are not collected.
import { compile } from "@keel/compiler";
import { describe, expect, test } from "vitest";

const usages = (source: string) => {
  const r = compile([{ path: "C.tsx", source }]);
  expect(r.diagnostics).toEqual([]);
  return { usages: r.artifacts["styles.json"].usages, code: r.outputs[0]?.code ?? "" };
};

describe("part styles", () => {
  test("`Part` style props and widget states are collected and its static ones lowered to a class", () => {
    const { usages: u, code } = usages(
      `import { Part } from '@keel/ui/aria'\nexport default function C() { return <Part id="o" role="option" selected={false} p="2" states={{ selected: { bg: 'accent' } }}>x</Part> }\n`,
    );
    expect(u).toEqual([{ props: { bg: "accent" }, state: "selected" }, { props: { p: "2" } }]);
    expect(code).toContain("k-p-2 k-selected-bg-accent");
  });

  test("every part of a stdlib component's `styles` is collected, conditional leaves included", () => {
    const { usages: u } = usages(
      `import { Tabs } from '@keel/std-headless'\nexport default function C(p: { on: boolean }) { return <Tabs id="t" styles={{ tab: { p: p.on ? '2' : '3' }, panel: { states: { expanded: { m: '1' } } } }} /> }\n`,
    );
    expect(u).toEqual([{ props: { m: "1" }, state: "expanded" }, { props: { p: "2" } }, { props: { p: "3" } }]);
  });

  test("`styles` on a component of any package is collected", () => {
    const { usages: u } = usages(
      `import { Tabs } from '@keel/std-evil'\nexport default function C() { return <Tabs styles={{ tab: { p: '2' } }} /> }\n`,
    );
    expect(u).toEqual([{ props: { p: "2" } }]);
  });

  test("`styles` on an app's own component is collected", () => {
    const { usages: u } = usages(
      `import { Tabs } from './Tabs.tsx'\nexport default function C() { return <Tabs styles={{ tab: { p: '2' } }} /> }\n`,
    );
    expect(u).toEqual([{ props: { p: "2" } }]);
  });

  test("E1823 marks each unreadable value, part and spread; a forwarded `props.styles` member is none", () => {
    const r = compile([
      {
        path: "C.tsx",
        source: `import { Tabs } from './Tabs.tsx'\nconst t = { p: '2' }\nexport default function C(props: { styles?: { tab?: object } }) { return <><Tabs styles={t} /><Tabs styles={{ tab: t, ...t, panel: { ...t } }} /><Tabs styles={{ ...props.styles, tab: props.styles?.tab }} /></> }\n`,
      },
    ]);
    expect(r.diagnostics.map((d) => `${d.code} ${d.col}`)).toEqual(["E1823 90", "E1823 116", "E1823 119", "E1823 134"]);
  });
});

describe("E1823 forwarding is resolved by binding", () => {
  const e1823 = (body: string, head = ""): number =>
    compile([
      {
        path: "C.tsx",
        source: `import { Tabs } from './Tabs.tsx'\nimport * as ns from './ns.tsx'\n${head}${body}\n`,
      },
    ]).diagnostics.filter((d) => d.code === "E1823").length;

  test("the component's own props.styles, its members, and `?? {}` / `|| {}` over them forward", () => {
    for (const v of ["props.styles", "props.styles?.tab", "props.styles ?? {}", "props.styles || {}"])
      expect(e1823(`export default function C(props: { styles?: object }) { return <Tabs styles={${v}} /> }`)).toBe(0);
    expect(
      e1823(
        `export default function C(props: { styles?: { tab?: object } }) { return <Tabs styles={{ tab: props.styles?.tab ?? {} }} /> }`,
      ),
    ).toBe(0);
  });

  test("a styles destructured from the first parameter or by a top-level const forwards", () => {
    expect(
      e1823("export default function C({ styles }: { styles?: object }) { return <Tabs styles={styles} /> }"),
    ).toBe(0);
    expect(
      e1823(
        "export default function C({ styles }: { styles?: { t?: object } }) { return <Tabs styles={styles?.t} /> }",
      ),
    ).toBe(0);
    expect(
      e1823(
        "export default function C(props: { styles?: object }) { const { styles } = props; return <Tabs styles={styles} /> }",
      ),
    ).toBe(0);
  });

  test("a shadowing inner parameter and a lowercase helper do not forward", () => {
    expect(
      e1823(
        "export default function C(props: { items: { styles: object }[] }) { return <>{props.items.map((props) => <Tabs styles={props.styles} />)}</> }",
      ),
    ).toBe(1);
    expect(
      e1823(
        "function render(props: { styles?: object }) { return <Tabs styles={props.styles} /> }\nexport default render",
      ),
    ).toBe(1);
  });

  test("a member component's styles are collected and checked; a spread of props onto it is not inspected", () => {
    const r = compile([
      {
        path: "C.tsx",
        source: `import * as ns from './ns.tsx'\nconst s = {}\nexport default function C(props: object) { return <><ns.Tabs styles={{ tab: { p: '2' } }} /><ns.Tabs styles={s} /><ns.Tabs {...props} /></> }\n`,
      },
    ]);
    expect(r.artifacts["styles.json"].usages).toEqual([{ props: { p: "2" } }]);
    expect(r.diagnostics.filter((d) => d.code === "E1823")).toHaveLength(1);
  });
});
