// A fresh project outside the repository, the way a public user starts one: `create-app` of the packed
// `@keel/create-app` (what `pnpm create @keel/app` runs), with the user agent of the pnpm that installs it,
// every `@keel/*` range pointed at the kit's tarballs through `overrides` in `pnpm-workspace.yaml`, installed from the
// shared pnpm store. Nothing of the repository is on its path, so no parent `CLAUDE.md` or `.claude/` is found.
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sh } from "./run.ts";
import type { Step } from "./run.ts";

export type Project = {
  /** The folder that holds the project; remove it with `rm -r` when the run is over. */
  parent: string;
  /** The project itself: `<parent>/<name>`. */
  dir: string;
};

/** `overrides:` lines of a `pnpm-workspace.yaml`: each `keel-<name>-<version>.tgz` of `kit` as `@keel/<name>`. */
export async function overridesYaml(kit: string): Promise<string> {
  const lines = (await readdir(kit))
    .filter((f) => /^keel-.+-\d[^/]*\.tgz$/.test(f))
    .sort()
    .map((f) => `  "@keel/${f.replace(/^keel-/, "").replace(/-\d[^/]*\.tgz$/, "")}": "file:${join(kit, f)}"`);
  if (lines.length === 0) throw new Error(`no keel-*.tgz in ${kit}`);
  return `overrides:\n${lines.join("\n")}\nallowBuilds:\n  esbuild: false\n`;
}

/** The first failed step of `steps`, as an error message. */
function must(label: string, step: Step): void {
  if (!step.ok) throw new Error(`${label} failed: ${step.output}`);
}

/**
 * Makes `<tmp>/keel-public-<random>/<name>` (or `<into>/<name>`): a bootstrap folder installs the kit's
 * `@keel/create-app`, runs its `create-app <name>` (it writes `AGENTS.md`, `CLAUDE.md` and the skills), then goes away; the
 * project installs from the kit with `pnpm install --prefer-offline` (the shared store first; a version it lacks comes from the registry).
 */
export async function setupProject(kit: string, name: string, into?: string): Promise<Project> {
  const parent = into ?? (await mkdtemp(join(tmpdir(), "keel-public-")));
  const boot = join(parent, ".bootstrap");
  const yaml = await overridesYaml(kit);
  try {
    await mkdir(boot);
    await writeFile(
      join(boot, "package.json"),
      `${JSON.stringify({ name: "bootstrap", private: true, dependencies: { "@keel/create-app": "0.0.0" } })}\n`,
    );
    await writeFile(join(boot, "pnpm-workspace.yaml"), yaml);
    must("bootstrap install", await sh("pnpm", ["install", "--prefer-offline"], boot));
    const pnpm = await sh("pnpm", ["--version"], parent);
    must("pnpm --version", pnpm);
    must(
      "create",
      await sh("node", [join(boot, "node_modules", "@keel", "create-app", "dist", "src", "bin.js"), name], parent, {
        npm_config_user_agent: `pnpm/${pnpm.output.trim().split("\n").at(-1) ?? ""} node/${process.version}`,
      }),
    );
    await rm(boot, { recursive: true, force: true });
    const dir = join(parent, name);
    await writeFile(join(dir, "pnpm-workspace.yaml"), yaml);
    must("install", await sh("pnpm", ["install", "--prefer-offline"], dir));
    return { parent, dir };
  } catch (e) {
    await rm(into === undefined ? parent : join(parent, name), { recursive: true, force: true });
    await rm(join(parent, ".bootstrap"), { recursive: true, force: true });
    throw e;
  }
}

/** Proves a project is whole: `keel check`, `keel docs` (the map), `keel test`, `keel build`. Returns the failing step's label. */
export async function proveProject(
  dir: string,
): Promise<{ ok: boolean; steps: { label: string; ok: boolean; output: string }[] }> {
  const steps: { label: string; ok: boolean; output: string }[] = [];
  const commands: [string, string[]][] = [
    ["keel check", ["exec", "keel", "check"]],
    ["keel docs", ["exec", "keel", "docs"]],
    ["keel test", ["exec", "keel", "test"]],
    ["keel build", ["exec", "keel", "build"]],
  ];
  for (const [label, args] of commands) {
    const r = await sh("pnpm", args, dir, {}, 300_000);
    steps.push({ label, ...r });
    if (!r.ok) break;
  }
  return { ok: steps.length === 4 && steps.every((s) => s.ok), steps };
}
