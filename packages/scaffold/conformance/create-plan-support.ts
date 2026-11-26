// Shared harness for the k.create `createPlan` conformance (not a test file). Seed 1337 for every property.
// ASSUMED API (the spec names `createPlan(input)` from `@keel/scaffold/create`, pure, returning `Result<CreatePlan, ScaffoldError>`,
// "from the flags, the folder's listing, the ancestors' files Workspace names, the Node version and `npm_config_user_agent`";
// it fixes no field names, so this file fixes them, one place to change):
//   input  { folder?, name?, adapter?, library?, existing?, listing?, ancestors?, nodeVersion, userAgent?, version, gitAbove?, realPath? }
//     folder     as typed, relative to the working folder; default "."
//     listing    every path under the folder, relative, "/"-separated, a directory with a trailing "/"; default none
//     ancestors  the files Workspace names (`pnpm-workspace.yaml`, `package.json`, `node_modules/@keel/cli/package.json`) at any level
//                from the working folder up, keyed relative to the working folder ("pnpm-workspace.yaml", "../package.json")
//     version    create's own version (the spec lists no such input; an app pins "create's version", so the plan needs it)
//     gitAbove   a `.git` is at or above the folder
//     realPath   the folder's real absolute path (the name of `.`)
//   result { ok: true, value: { files: Map<path, text> (paths relative to the folder), records: { kind, ... }[] } }
//          | { ok: false, error }   (a code is found as a substring of the JSON, as fixtures.ts does)
//   records: `{ kind: "scaffold.edit", action: "create", path }` sorted, then `{ kind: "create.next", command, dir? }`;
//   a warning (W1364) is a `{ kind: "diag", code, ... }` record.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createPlan } from "@keel/scaffold/create";
import { root } from "./keel-cli.ts";

export { root };
export const SEED = 1337;
export const RUNS = 25;

export type PlanInput = {
  folder?: string;
  name?: string;
  adapter?: "client" | "node" | "static";
  library?: string;
  existing?: boolean;
  listing?: string[];
  ancestors?: Record<string, string>;
  nodeVersion?: string;
  userAgent?: string;
  version?: string;
  gitAbove?: boolean;
  realPath?: string;
};

export type Rec = { kind: string; [key: string]: unknown };
export type PlanView = { ok: boolean; files: Map<string, string>; records: Rec[]; text: string };

export const VERSION = "0.4.2";
export const NODE = "22.15.0";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isRec = (v: unknown): v is Rec => isObj(v) && typeof v.kind === "string";

/** `createPlan` with the defaults of a fresh, empty, pnpm-run folder, as a view that never throws on a red run. */
export function plan(input: PlanInput = {}): PlanView {
  const r: unknown = createPlan({ nodeVersion: NODE, version: VERSION, folder: "shop", ...input });
  if (!isObj(r)) return { ok: false, files: new Map(), records: [], text: String(r) };
  const ok = r.ok === true;
  const value = isObj(r.value) ? r.value : {};
  const files = new Map<string, string>();
  if (value.files instanceof Map) {
    for (const [k, v] of value.files) if (typeof k === "string" && typeof v === "string") files.set(k, v);
  }
  const records = Array.isArray(value.records) ? value.records.filter(isRec) : [];
  return { ok, files, records, text: JSON.stringify(ok ? records : r.error) };
}

export const paths = (p: PlanView): string[] => [...p.files.keys()].sort();
export const commands = (p: PlanView): string[] =>
  p.records.filter((r) => r.kind === "create.next").map((r) => String(r.command));
export const json = (p: PlanView, path: string): Record<string, unknown> => {
  const v: unknown = JSON.parse(p.files.get(path) ?? "{}");
  return isObj(v) ? v : {};
};

/** The skill names `keel docs` lists in a project, read from the shipped skills folder of `@keel/cli` (one folder per skill). */
export const skillNames = (): string[] =>
  readdirSync(join(root, "packages/cli/skills"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
export const skillPaths = (): string[] => skillNames().map((n) => `.claude/skills/${n}/SKILL.md`);

export const cliVersion = (): string => {
  const v: unknown = JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8"));
  return isObj(v) && typeof v.version === "string" ? v.version : "";
};

/** The `client` row of k.create Files, with the agent files; the base of every app kind. */
export const CLIENT_FILES: string[] = [
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "tokens.ts",
  "topology.ts",
  "turbo.json",
  ".gitignore",
  ".keel/.gitkeep",
  "public/keel-mark.svg",
  ".github/workflows/ci.yml",
  "modules/app/module.ts",
  "modules/app/app.contract.ts",
  "modules/app/routes.ts",
  "modules/app/HomePage.tsx",
  "modules/app/home.route.test.ts",
  "AGENTS.md",
  "CLAUDE.md",
];
export const NODE_EXTRA = ["modules/app/loadHome.server.ts", "deploy/web/Dockerfile", "deploy/compose.yaml"];
/** `library`'s ten files (k.library-pack Scaffold), at the folder's root. */
export const LIBRARY_FILES = [
  "package.json",
  "module.ts",
  "src/index.ts",
  "src/Example.tsx",
  "test/Example.test.ts",
  "tokens.ts",
  "tsconfig.json",
  "tsconfig.build.json",
  "vitest.config.ts",
  "README.md",
];

export const sorted = (a: string[]): string[] => [...a].sort();
export const clientSet = (): string[] => sorted([...CLIENT_FILES, ...skillPaths()]);
export const nodeSet = (): string[] => sorted([...CLIENT_FILES, ...NODE_EXTRA, ...skillPaths()]);
export const librarySet = (): string[] =>
  sorted([...LIBRARY_FILES, ".gitignore", "AGENTS.md", "CLAUDE.md", ...skillPaths()]);
