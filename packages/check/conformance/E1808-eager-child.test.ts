// Spec: k.check, clause "A base element given `children: Input(...)`, also through an aliased import, in an array, or held by a `const`, reports E1808; a thunk, a string or `props.children` does not."
// Seed 1337
// The fix-applies clause for E1808 is covered by fix-applies.test.ts (rfc:0069), not repeated here.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, one } from "./support.ts";

const e1808 = (source: string, path = "modules/app/Page.ts") =>
  check(one(source, path), { types: false }).diagnostics.filter((d) => d.code === "E1808");

const IN = `Input({ label: 'L', onInput: () => undefined })`;
const HEAD = `import { Box, Text, Input } from '@keel/ui'\n`;
const page = (body: string, head = HEAD) => `${head}export default function Page() { ${body} }\n`;

test("A base element given `children: Input(...)` reports E1808 with a fix wrapping it in `() =>`", () => {
  const ds = e1808(page(`return Box({ children: ${IN} })`));
  expect(ds).toHaveLength(1);
  expect(ds[0]?.fix).toContain("() =>");
});

test("A base element given `children: Input(...)` through an aliased import reports E1808", () => {
  const head = `import { Box as B, Input as I } from '@keel/ui'\n`;
  expect(e1808(page(`return B({ children: I({ label: 'L', onInput: () => undefined }) })`, head))).toHaveLength(1);
});

test("A base element given `children: Input(...)` through a const alias of the element reports E1808", () => {
  expect(e1808(page(`const C = Box\n return C({ children: ${IN} })`))).toHaveLength(1);
});

test("A base element given `children: ui.Input(...)` through a namespace import reports E1808", () => {
  const head = `import * as ui from '@keel/ui'\n`;
  expect(
    e1808(page(`return ui.Box({ children: ui.Input({ label: 'L', onInput: () => undefined }) })`, head)),
  ).toHaveLength(1);
});

test("A base element given `children: [..., Input(...)]` in an array reports E1808", () => {
  expect(e1808(page(`return Box({ children: [Text({ children: 'a' }), ${IN}] })`))).toHaveLength(1);
});

test("A base element given a child held by a `const` reports E1808", () => {
  expect(e1808(page(`const field = ${IN}\n return Box({ children: field })`))).toHaveLength(1);
});

test("A base element given a JSX value as `children` reports E1808", () => {
  const src = `import { Box, Input } from '@keel/ui'\nexport default function Page() { return Box({ children: <Input label="L" /> }) }\n`;
  expect(e1808(src, "modules/app/Page.tsx")).toHaveLength(1);
});

test("A thunk, a string or `props.children` as `children` does not report E1808", () => {
  expect(e1808(page(`return Box({ children: () => ${IN} })`))).toHaveLength(0);
  expect(e1808(page(`return Box({ children: 'text' })`))).toHaveLength(0);
  const withProps = `import { Box } from '@keel/ui'\nexport default function Page(props: { children: () => unknown }) { return Box({ children: props.children }) }\n`;
  expect(e1808(withProps)).toHaveLength(0);
});

test("A local function named Box, not imported from @keel/ui, given an eager child does not report E1808", () => {
  const src = `import { Input } from '@keel/ui'\nfunction Box(_a: { children: unknown }) { return null }\nexport default function Page() { return Box({ children: ${IN} }) }\n`;
  expect(e1808(src)).toHaveLength(0);
});

const NAMES = ["Box", "Text", "Heading", "Button", "Link", "Image", "Input", "TextArea", "Select", "Checkbox"];

// Seed 1337
test("Property: over every base element child and wrapper kind, an eager child reports one E1808 and a thunk reports none", () => {
  const head = `import { ${NAMES.join(", ")} } from '@keel/ui'\n`;
  fc.assert(
    fc.property(fc.constantFrom(...NAMES), fc.constantFrom("inline", "array", "const"), (name, kind) => {
      const child = `${name}({ children: 'x' })`;
      const eager =
        kind === "inline"
          ? page(`return Box({ children: ${child} })`, head)
          : kind === "array"
            ? page(`return Box({ children: [${child}] })`, head)
            : page(`const c = ${child}\n return Box({ children: c })`, head);
      const thunk = page(`return Box({ children: () => ${child} })`, head);
      expect(e1808(eager)).toHaveLength(1);
      expect(e1808(thunk)).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 30 },
  );
});
