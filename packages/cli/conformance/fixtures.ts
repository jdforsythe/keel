// Shared fixtures for k.cli conformance. Property seed: 1337.
// Assumed (spec names no programmatic entry): `run(argv, io)` from '@keel/cli' is a pure, in-process entry; the `keel` binary wraps it.
//   run(argv: string[], io: { cwd: string; files?: { path: string; source: string }[]; stdin?: string; env?: Record<string,string>; tty?: boolean })
//     => Promise<{ code: number; stdout: string; stderr: string }>
// Spec-named API used: `formatter(kind, { schema, compact, pretty })` from '@keel/cli' (k.cli "Formatter registry").
// `keel mcp` / `keel lsp` have no named programmatic factory; their clauses are marked untestable where they appear.
import { readFileSync } from "node:fs";
import { run } from "@keel/cli";

export const SEED = 1337;

export type Files = { path: string; source: string }[];
export type Result = { code: number; stdout: string; stderr: string };

export const COMMANDS = [
  "check",
  "test",
  "build",
  "dev",
  "spec",
  "explain",
  "inspect",
  "render",
  "scaffold",
  "codemod",
  "ledger",
] as const;

/** A file whose name matches its single export: clean for E1752. */
export const cleanFile = (n: number): { path: string; source: string } => ({
  path: `src/Ok${n}.ts`,
  source: `export const Ok${n} = ${n}\n`,
});

/** A file with two exports: one E1752 diagnostic (k.check Rules). */
export const dirtyFile = (n: number): { path: string; source: string } => ({
  path: `src/Bad${n}.ts`,
  source: `export const Bad${n} = ${n}\nexport const Extra${n} = ${n}\n`,
});

export const cleanProject = (): Files => [cleanFile(1), cleanFile(2)];
export const dirtyProject = (count: number): Files => Array.from({ length: count }, (_, i) => dirtyFile(i));

export const specFile = (name: string): { path: string; source: string } => ({
  path: `spec/kernel/${name}.md`,
  source: readFileSync(new URL(`../../../spec/kernel/${name}.md`, import.meta.url), "utf8"),
});

export const keel = (
  argv: string[],
  opts: { files?: Files; env?: Record<string, string>; tty?: boolean } = {},
): Promise<Result> => run(argv, { cwd: "/work/app", files: opts.files, env: opts.env ?? {}, tty: opts.tty ?? false });

export const lines = (s: string): string[] => s.split("\n").filter((l) => l.length > 0);

/** Token estimate stand-in (docs/OUTPUT.md names no tokenizer): ceil(chars / 4). */
export const tokens = (s: string): number => Math.ceil(s.length / 4);

export const parseJsonLines = (s: string): Record<string, unknown>[] =>
  lines(s).map((l) => {
    const v: unknown = JSON.parse(l);
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("not an object line");
    return Object.fromEntries(Object.entries(v));
  });
