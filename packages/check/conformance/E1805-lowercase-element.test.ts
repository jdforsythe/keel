// Seed 1337 (no random inputs; examples only)
// Conformance: E1805 forbids lowercase intrinsic elements in app code, with no exceptions; the fix names the base element.
import { check } from "@keel/check";
import { expect, test } from "vitest";
import { one } from "./support.ts";

const BAD = `export default function C() { return <div>hi</div> }\n`;
const CLEAN = `import { Box } from '@keel/ui'\nexport default function C() { return <Box>hi</Box> }\n`;

test("E1805: a lowercase intrinsic element reports exactly E1805 with a fix naming the base element", () => {
  const ds = check(one(BAD), {}).diagnostics;
  expect(ds.map((d) => d.code)).toEqual(["E1805"]);
  expect(ds[0]?.fix).toContain("Box");
});

test("E1805: the same component written with a base element reports nothing", () => {
  expect(check(one(CLEAN), {}).diagnostics).toEqual([]);
});
