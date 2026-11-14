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

  test("`styles` on a component of a look-alike `@keel/std-` package is not collected", () => {
    const { usages: u } = usages(
      `import { Tabs } from '@keel/std-evil'\nexport default function C() { return <Tabs styles={{ tab: { p: '2' } }} /> }\n`,
    );
    expect(u).toEqual([]);
  });

  test("`styles` on a component not from a `@keel/std-*` package is not collected", () => {
    const { usages: u } = usages(
      `import { Tabs } from './Tabs.tsx'\nexport default function C() { return <Tabs styles={{ tab: { p: '2' } }} /> }\n`,
    );
    expect(u).toEqual([]);
  });
});
