// Spec: k.aria, Rules "E1823 unreadable `styles` (no fix)."
// Spec: k.aria, Part styles "Any other value, part or spread is E1823, except `props.styles` or its members, collected where written."
// Seed: 1337.
// Collection of readable `styles` is packages/compiler/conformance/part-styles-any-component.test.ts.
// Pending: not implemented yet.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const page = (styles: string, pre = ""): string =>
  `import { Card } from './Card.tsx'\n${pre}export default function Page() { return <Card styles=${styles} /> }\n`;
const codes = (source: string) =>
  check([{ path: "Page.tsx", source }], { types: false }).diagnostics.filter((d) => d.code === "E1823");

describe("k.aria: E1823", () => {
  test.skip("a `styles` object literal of part literals is not E1823", () => {
    expect(codes(page("{{ body: { p: '2' } }}"))).toEqual([]);
  });

  test.skip("E1823: a `styles` value that is not an object literal is reported", () => {
    expect(codes(page("{mine}", "const mine = { body: { p: '2' } }\n"))).toHaveLength(1);
    expect(codes(page("{make()}", "const make = () => ({})\n"))).toHaveLength(1);
  });

  test.skip("E1823: a part that is not an object literal is reported", () => {
    expect(codes(page("{{ body: part }}", "const part = { p: '2' }\n"))).toHaveLength(1);
  });

  test.skip("E1823: a spread in `styles` or in a part is reported", () => {
    expect(codes(page("{{ ...base }}", "const base = {}\n"))).toHaveLength(1);
    expect(codes(page("{{ body: { ...base } }}", "const base = {}\n"))).toHaveLength(1);
  });

  test.skip("E1823: `props.styles` and its members, forwarded, are not reported", () => {
    const fwd = (v: string) =>
      `import { Card } from './Card.tsx'\nexport function Wrap(props: { styles?: { body?: { p?: string } } }) { return <Card styles=${v} /> }\n`;
    expect(codes(fwd("{props.styles}"))).toEqual([]);
    expect(codes(fwd("{{ body: props.styles?.body }}"))).toEqual([]);
  });

  test.skip("E1823: carries no fix", () => {
    const [d] = codes(page("{mine}", "const mine = {}\n"));
    expect(d).toBeDefined();
    expect(d?.fix).toBeUndefined();
  });

  test.skip("property: any non-literal `styles` identifier is one E1823", () => {
    const id = fc.stringMatching(/^[a-z]{3,8}$/);
    fc.assert(
      fc.property(id, (name) => {
        expect(codes(page(`{${name}x}`, `const ${name}x = {}\n`))).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
