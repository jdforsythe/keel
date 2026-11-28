// Import of a finished public project into `apps/<name>/`, so the task's `pass.ts` judges it from the repository root
// unchanged. Sources, tests and config come over; the install, the agent's files and every build output stay behind.
// `@keel/*` ranges become `workspace:*` and the scripts take the repository's workspace form.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isRecord } from "./run.ts";

/** Names (at any depth) the import leaves out. */
const LEFT_BEHIND = new Set([
  "node_modules",
  "dist",
  "coverage",
  "reports",
  ".turbo",
  ".keel-dev",
  ".stryker-tmp",
  ".claude",
  ".github",
  "AGENTS.md",
  "CLAUDE.md",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "package-lock.json",
  "turbo.json",
]);

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** `package.json` as the workspace has it: `@keel/*` as `workspace:*`, `scripts` replaced by the task's workspace form. */
export function workspaceManifest(
  pkg: Record<string, unknown>,
  scripts: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...pkg };
  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field];
    if (isRecord(deps))
      out[field] = Object.fromEntries(
        Object.entries(deps).map(([k, v]) => [k, k.startsWith("@keel/") ? "workspace:*" : v]),
      );
  }
  const dev = isRecord(out["devDependencies"]) ? out["devDependencies"] : {};
  out["devDependencies"] = { ...dev, "@keel/tooling": "workspace:*" };
  const current = isRecord(pkg["scripts"]) ? pkg["scripts"] : {};
  out["scripts"] = { ...current, ...scripts };
  return out;
}

/**
 * Copies `project` to `target` (replacing it) and rewrites its `package.json` for the workspace.
 */
export async function importApp(
  project: string,
  target: string,
  scripts: Readonly<Record<string, string>>,
): Promise<void> {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(project, target, {
    recursive: true,
    filter: (src) => !LEFT_BEHIND.has(src.split("/").pop() ?? ""),
  });
  const file = join(target, "package.json");
  const pkg: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!isRecord(pkg)) throw new Error(`${file} is not an object`);
  await writeFile(file, `${JSON.stringify(workspaceManifest(pkg, scripts), null, 2)}\n`);
}
