// Project trees for the E1258 suites (not a test file). Public API only. Seed 1337 for every property.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { check } from "@keel/check";
import type { Files } from "./support.ts";

export type Diag = ReturnType<typeof check>["diagnostics"][number];

export const NO_TYPES = { types: false } as const;

const f = (path: string, source: string): Files[number] => ({ path, source });

/** App components every fixture tree can import: `Card` takes any prop; `Icon`, `A`, `B` and `Shell` return JSX. */
export const COMPONENTS = f(
  "modules/app/Card.tsx",
  `import { Box } from '@keel/ui'
export function Card(props: { children?: unknown; icon?: unknown; footer?: unknown; header?: unknown }) { return <Box>{props.children}</Box> }
export function Icon() { return <Box>i</Box> }
export function A() { return <Box>a</Box> }
export function B() { return <Box>b</Box> }
export function Shell(_props: object) { return <Box>shell</Box> }
export function label(n: number) { return 'n' + n }
`,
);

/** A module that exports a `const` holding an element made at load. */
export const HEADER = f(
  "modules/app/ui/header.ts",
  `import { Heading } from '@keel/ui'\nexport const header = Heading({ level: 2, children: 'Title' })\n`,
);

const IMPORTS = `${[
  "import { Box, Button, Heading, Input, Text } from '@keel/ui'",
  "import { Form } from '@keel/router'",
  "import { Part } from '@keel/ui/aria'",
  "import { Disclosure } from '@keel/std-headless'",
  "import { DataTable } from '@keel/std-tables'",
  "import { For, Match, Case } from '@keel/runtime-dom'",
  "import { signal, computed } from '@keel/reactive'",
  "import { Card, Icon, A, B, Shell, label } from './Card.tsx'",
].join("\n")}\n`;

/** A page file `modules/app/Page.<ext>` whose component body is `body`, over the shared components. */
export function page(body: string, ext: "ts" | "tsx" = "tsx", head = ""): Files {
  return [
    COMPONENTS,
    HEADER,
    f(
      `modules/app/Page.${ext}`,
      `${IMPORTS}${head}export default function Page(props: { children?: () => unknown; icon?: unknown; xs: string[]; ok: boolean; a?: unknown; n: number }) {\n${body}\n}\n`,
    ),
  ];
}

/** The E1258 diagnostics of `files`. */
export const e1258 = (files: Files): Diag[] => check(files, NO_TYPES).diagnostics.filter((d) => d.code === "E1258");

/** The 1-based line of the first line of the page file holding `needle`. */
export function lineOf(files: Files, needle: string, path = "modules/app/Page.tsx"): number {
  const source = files.find((x) => x.path === path)?.source ?? "";
  const i = source.split("\n").findIndex((l) => l.includes(needle));
  return i + 1;
}

/** Writes `files` to a fresh directory, `git apply`s `fix` there and returns the patched files. */
export function applyFix(files: Files, fix: string): Files {
  const dir = mkdtempSync(join(tmpdir(), "keel-e1258-"));
  try {
    for (const file of files) {
      mkdirSync(dirname(join(dir, file.path)), { recursive: true });
      writeFileSync(join(dir, file.path), file.source);
    }
    writeFileSync(join(dir, "fix.patch"), `${fix}\n`);
    execFileSync("git", ["apply", "--unsafe-paths", "--directory=.", "fix.patch"], { cwd: dir, stdio: "pipe" });
    return files.map((file) => ({ path: file.path, source: readFileSync(join(dir, file.path), "utf8") }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
