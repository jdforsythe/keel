// Spec: k.component, Shape and Conformance clause "`const label = props.label` at a component's top level with `{label}` as a text child is one E1405; `{props.label}` is none."
// RFC 0090, ADR-0113. Seed 1337.
// The fix-applies clause for E1405 (k.check) is covered by fix-diffs.test.ts, not repeated here.
// ASSUMPTION: the diagnostic code is "E1405", one diagnostic per top-level read that reaches a sink, and it carries `fix`.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, one } from "./support.ts";

const e1405 = (source: string, path = "C.tsx") =>
  check(one(source, path), { types: false }).diagnostics.filter((d) => d.code === "E1405");

const UI = `import { Box, Text } from '@keel/ui'\n`;
const comp = (body: string, head = UI) => `${head}export default function C(props: { label: string }) { ${body} }\n`;

test("`const label = props.label` at a component's top level with `{label}` as a text child is one E1405", () => {
  expect(e1405(comp(`const label = props.label; return <Text>{label}</Text>`))).toHaveLength(1);
});

test("`{props.label}` as a text child is no E1405", () => {
  expect(e1405(comp(`return <Text>{props.label}</Text>`))).toHaveLength(0);
});

test("`const label = props.label` whose value reaches an attribute is one E1405", () => {
  expect(e1405(comp(`const label = props.label; return <Box id={label}>x</Box>`))).toHaveLength(1);
});

test("`const label = props.label` whose value reaches a child's props is one E1405", () => {
  const head = `${UI}import Badge from './Badge.tsx'\n`;
  expect(e1405(comp(`const label = props.label; return <Badge label={label} />`, head))).toHaveLength(1);
});

test("`props.label` read in the attribute or in the child's props is no E1405", () => {
  expect(e1405(comp(`return <Box id={props.label}>x</Box>`))).toHaveLength(0);
  const head = `${UI}import Badge from './Badge.tsx'\n`;
  expect(e1405(comp(`return <Badge label={props.label} />`, head))).toHaveLength(0);
});

test("the E1405 diagnostic carries a fix that reads the prop in the binding", () => {
  const ds = e1405(comp(`const label = props.label; return <Text>{label}</Text>`));
  expect(ds).toHaveLength(1);
  const fix = ds[0]?.fix;
  expect(typeof fix).toBe("string");
  expect(fix?.startsWith("--- a/")).toBe(true);
  expect(fix).toContain("props.label");
});

const NAMES = ["label", "title", "name", "value", "caption"];

// Seed 1337
test("Property: over prop names, a top-level read reaching a text child reports one E1405 and the in-binding read reports none", () => {
  fc.assert(
    fc.property(fc.constantFrom(...NAMES), fc.constantFrom("text", "attr"), (name, sink) => {
      const head = UI;
      const sig = `export default function C(props: { ${name}: string }) {`;
      const bad =
        sink === "text"
          ? `${head}${sig} const v = props.${name}; return <Text>{v}</Text> }\n`
          : `${head}${sig} const v = props.${name}; return <Box id={v}>x</Box> }\n`;
      const good =
        sink === "text"
          ? `${head}${sig} return <Text>{props.${name}}</Text> }\n`
          : `${head}${sig} return <Box id={props.${name}}>x</Box> }\n`;
      expect(e1405(bad)).toHaveLength(1);
      expect(e1405(good)).toHaveLength(0);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
