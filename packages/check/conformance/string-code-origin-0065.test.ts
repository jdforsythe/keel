// Spec: k.ctx, clause "`import(String(URL.createObjectURL(b)))`, `` import(`${URL.createObjectURL(b)}`) ``, `new Worker(new URL(URL.createObjectURL(b)))`, `Reflect.construct(Worker, [URL.createObjectURL(b)])`, `import(u)` after `let u; u = URL.createObjectURL(b)`, and `Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s)` are each one E1603; `new Worker(new URL('./w.js', import.meta.url))` is not."
// Seed 1337 (no random generation in this file). RFC 0065: each form in `modules/app/a.ts`.
import { check } from "@keel/check";
import { expect, test } from "vitest";

const e1603 = (body: string) =>
  check(
    [
      {
        path: "modules/app/a.ts",
        source: `declare const b: Blob;\ndeclare const s: string;\n${body}\n`,
      },
    ],
    { types: false },
  ).diagnostics.filter((d) => d.code === "E1603");

const FORMS: readonly (readonly [string, string])[] = [
  ["import(`${URL.createObjectURL(b)}`)", "export const a = () => import(`${URL.createObjectURL(b)}`);"],
  ["import(String(URL.createObjectURL(b)))", "export const a = () => import(String(URL.createObjectURL(b)));"],
  [
    "new Worker(new URL(URL.createObjectURL(b)))",
    "export const a = () => new Worker(new URL(URL.createObjectURL(b)));",
  ],
  [
    "Reflect.construct(Worker, [URL.createObjectURL(b)])",
    "export const a = () => Reflect.construct(Worker, [URL.createObjectURL(b)]);",
  ],
  [
    "import(u) after let u; u = URL.createObjectURL(b)",
    "export const a = () => { let u: string; u = URL.createObjectURL(b); return import(u); };",
  ],
  [
    "Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s)",
    "export const a = () => Object.getPrototypeOf(Object.getPrototypeOf(async () => {})).constructor(s);",
  ],
];

for (const [name, src] of FORMS) {
  test(`\`${name}\` is one E1603`, () => {
    expect(e1603(src)).toHaveLength(1);
  });
}

test("`new Worker(new URL('./w.js', import.meta.url))` is not E1603", () => {
  expect(e1603("export const a = () => new Worker(new URL('./w.js', import.meta.url));")).toEqual([]);
});
