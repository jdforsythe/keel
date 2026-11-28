// Looks (k.ui Style props): a literal `look` on a base element or in a part style lowers to the set's classes for every
// prop and state the element does not set; the usage names the look so the CSS holds its rules. Control part styles
// (`styles` on Input, TextArea, Select, Checkbox) are collected.
import { compile } from "@keel/compiler";
import * as fc from "fast-check";
import { describe, expect, test } from "vitest";

const LOOKS = {
  primary: { bg: "accent", fg: "bg", px: "2", states: { hover: { bg: "fg" } } },
  field: { p: "1", border: "rule" },
};
const run = (source: string, withLooks = true) => {
  const r = compile([{ path: "C.tsx", source }], withLooks ? { looks: LOOKS } : {});
  expect(r.diagnostics).toEqual([]);
  return { usages: r.artifacts["styles.json"].usages, code: r.outputs[0]?.code ?? "" };
};
const HEAD = "import { Button, Input } from '@keel/ui'\n";

describe("look", () => {
  test("a Button's look lowers to the set's classes, its own `px` replacing the look's", () => {
    const { usages, code } = run(
      `${HEAD}export default function C() { return <Button look="primary" px="1">a</Button> }\n`,
    );
    expect(code).toContain('"k-bg-accent k-fg-bg k-hover-bg-fg k-px-1"');
    expect(code).not.toContain("k-px-2");
    expect(code).not.toContain("look");
    expect(usages).toContainEqual({ props: {}, look: "primary" });
  });

  test("an own state prop replaces the look's in that state only", () => {
    const { code } = run(
      `${HEAD}export default function C() { return <Button look="primary" states={{ hover: { bg: 'bg' } }}>a</Button> }\n`,
    );
    expect(code).toContain("k-hover-bg-bg");
    expect(code).not.toContain("k-hover-bg-fg");
    expect(code).toContain("k-bg-accent");
  });

  test("without the tokens' looks the usage is still named and no class is added", () => {
    const { usages, code } = run(
      `${HEAD}export default function C() { return <Button look="primary">a</Button> }\n`,
      false,
    );
    expect(usages).toEqual([{ props: {}, look: "primary" }]);
    expect(code).not.toContain("k-bg-accent");
  });

  test("a look in a control's part style becomes its classes", () => {
    const { usages, code } = run(
      `${HEAD}export default function C() { return <Input label="A" styles={{ field: { look: 'field', p: '3' }, label: { fg: 'accent' } }} /> }\n`,
    );
    expect(code).toContain('class: "k-border-rule"');
    expect(usages).toContainEqual({ props: { fg: "accent" } });
    expect(usages).toContainEqual({ props: { p: "3" } });
    expect(usages).toContainEqual({ props: {}, look: "field" });
  });

  test("own props drop exactly the look's props they name (property)", () => {
    const props = ["bg", "fg", "px"] as const;
    fc.assert(
      fc.property(fc.subarray([...props]), (mine) => {
        const attrs = mine.map((p) => `${p}="0"`).join(" ");
        const { code } = run(
          `${HEAD}export default function C() { return <Button look="primary" ${attrs}>a</Button> }\n`,
        );
        const want = { bg: "k-bg-accent", fg: "k-fg-bg", px: "k-px-2" };
        for (const p of props) expect(code.includes(want[p])).toBe(!mine.includes(p));
      }),
      { seed: 1337, numRuns: 16 },
    );
  });
});
