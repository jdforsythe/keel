// Spec: k.ctx, clause "`import(URL.createObjectURL(b))`, `new Worker(URL.createObjectURL(b))`, `new Worker('data:,' + s)`, and `Object.getPrototypeOf(async function () {}).constructor(s)` are each one E1603; `new Worker('/w.js')` is not."
// Seed 1337 (no random generation in this file). RFC 0061: each form as `export const a = (b: Blob, s: string) => <expr>;` in `modules/app/a.ts`.
import { check } from "@keel/check";
import { expect, test } from "vitest";

const e1603 = (expr: string) =>
  check([{ path: "modules/app/a.ts", source: `export const a = (b: Blob, s: string) => ${expr};\n` }], {
    types: false,
  }).diagnostics.filter((d) => d.code === "E1603");

const FORMS: readonly string[] = [
  "import(URL.createObjectURL(b))",
  "new Worker(URL.createObjectURL(b))",
  "new Worker('data:,' + s)",
  "Object.getPrototypeOf(async function () {}).constructor(s)",
];

for (const expr of FORMS) {
  test(`\`${expr}\` is one E1603`, () => {
    expect(e1603(expr)).toHaveLength(1);
  });
}

test("`new Worker('/w.js')` is not E1603", () => {
  expect(e1603("new Worker('/w.js')")).toEqual([]);
});
