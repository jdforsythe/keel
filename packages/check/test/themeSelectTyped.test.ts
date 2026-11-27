// k.schemes Checks: with the type pass on, E1816 finds `@keel/ui`'s `ThemeSelect` however an app reaches it.
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { brandTokens } from "@keel/ui/brand";
import { afterEach, beforeEach, expect, it } from "vitest";
import { check } from "../src/index.ts";

const UI = resolve(import.meta.dirname, "../../ui");
const MESSAGE = "ThemeSelect needs a choice theme; the tokens have none";
const SELECT = `<ThemeSelect id="theme" label="Theme" labels={{ default: 'Keel' }} />`;

let root = "";
beforeEach(() => {
  root = tempDir("keel-theme-select-types-");
  writeFileSync(join(root, "package.json"), "{}");
  mkdirSync(join(root, "node_modules", "@keel"), { recursive: true });
  symlinkSync(UI, join(root, "node_modules", "@keel", "ui"), "dir");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const write = (files: readonly { path: string; source: string }[]): void => {
  for (const f of files) {
    mkdirSync(dirname(join(root, f.path)), { recursive: true });
    writeFileSync(join(root, f.path), f.source);
  }
};

/** The E1816 findings, as `[path, line, message]`, of an app over `files` with the type pass on. */
function run(files: { path: string; source: string }[]): [string, number, string][] {
  write(files);
  return check(files, { root, types: true, artifacts: { tokens: brandTokens } })
    .diagnostics.filter((d) => d.code === "E1816")
    .map((d) => [d.path, d.line, d.message]);
}

it("a namespace import of `@keel/ui` reaches it", () => {
  const source = `import * as ui from '@keel/ui'\nexport default function C() { return <ui.ThemeSelect id="theme" label="Theme" labels={{ default: 'Keel' }} /> }\n`;
  expect(run([{ path: "C.tsx", source }])).toEqual([["C.tsx", 2, MESSAGE]]);
});

it("an aliased import reaches it", () => {
  const source = `import { ThemeSelect as Pick } from '@keel/ui'\nexport default function C() { return <Pick id="theme" label="Theme" labels={{ default: 'Keel' }} /> }\n`;
  expect(run([{ path: "C.tsx", source }])).toEqual([["C.tsx", 2, MESSAGE]]);
});

it("a library the app lists that re-exports it reaches it", () => {
  const lib = "node_modules/@acme/kit";
  const files = [
    {
      path: `${lib}/package.json`,
      source: JSON.stringify({ name: "@acme/kit", version: "1.0.0", types: "./index.d.ts", main: "./index.js" }),
    },
    { path: `${lib}/index.d.ts`, source: "export { ThemeSelect as Theme } from '@keel/ui'\n" },
    {
      path: "C.tsx",
      source: `import { Theme } from '@acme/kit'\nexport default function C() { return <Theme id="theme" label="Theme" labels={{ default: 'Keel' }} /> }\n`,
    },
  ];
  expect(run(files).filter(([p]) => p === "C.tsx")).toEqual([["C.tsx", 2, MESSAGE]]);
});

it("a wrapper component is judged at the element in its own file, not at its use", () => {
  const files = [
    {
      path: "Pick.tsx",
      source: `import { ThemeSelect } from '@keel/ui'\nexport function Pick() { return ${SELECT} }\n`,
    },
    {
      path: "C.tsx",
      source: "import { Pick } from './Pick.tsx'\nexport default function C() { return <Pick /> }\n",
    },
  ];
  expect(run(files)).toEqual([["Pick.tsx", 2, MESSAGE]]);
});

it("a `Box` reached through a library re-export has its `scheme` judged by E1814", () => {
  const lib = "node_modules/@acme/kit";
  const files = [
    {
      path: `${lib}/package.json`,
      source: JSON.stringify({ name: "@acme/kit", version: "1.0.0", types: "./index.d.ts", main: "./index.js" }),
    },
    { path: `${lib}/index.d.ts`, source: "export { Box as Frame } from '@keel/ui'\n" },
    {
      path: "C.tsx",
      source: `import { Frame } from '@acme/kit'\nexport default function C() { return <Frame scheme="dark" /> }\n`,
    },
  ];
  write(files);
  const d = check(files, { root, types: true, artifacts: { tokens: brandTokens } }).diagnostics.filter(
    (x) => x.code === "E1814" && x.path === "C.tsx",
  );
  expect(d.map((x) => x.message)).toEqual(['scheme="dark" needs schemes light and dark; the tokens have light only']);
});
