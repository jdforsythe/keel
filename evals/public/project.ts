// A fresh project outside the repository, the way a public user has one: the scaffold run by the packed `@keel/cli`,
// every `@keel/*` range pointed at the kit's tarballs through `overrides` in `pnpm-workspace.yaml`, installed from the
// shared pnpm store. Nothing of the repository is on its path, so no parent `CLAUDE.md` or `.claude/` is found.
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isRecord, sh } from "./run.ts";
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
 * Makes `<tmp>/keel-public-<random>/<name>` (or `<into>/<name>`): a bootstrap folder installs the kit's `@keel/cli`, runs its
 * `keel scaffold project <name>` (the scaffold writes `AGENTS.md`, `CLAUDE.md` and the skills), then goes away; the
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
      `${JSON.stringify({ name: "bootstrap", private: true, dependencies: { "@keel/cli": "0.0.0" } })}\n`,
    );
    await writeFile(join(boot, "pnpm-workspace.yaml"), yaml);
    must("bootstrap install", await sh("pnpm", ["install", "--prefer-offline"], boot));
    must(
      "scaffold",
      await sh(
        "node",
        [join(boot, "node_modules", "@keel", "cli", "dist", "src", "bin.js"), "scaffold", "project", name],
        parent,
      ),
    );
    await rm(boot, { recursive: true, force: true });
    const dir = join(parent, name);
    await writeFile(join(dir, "pnpm-workspace.yaml"), yaml);
    await addPeerTools(dir);
    must("install", await sh("pnpm", ["install", "--prefer-offline"], dir));
    return { parent, dir };
  } catch (e) {
    await rm(into === undefined ? parent : join(parent, name), { recursive: true, force: true });
    await rm(join(parent, ".bootstrap"), { recursive: true, force: true });
    throw e;
  }
}

/**
 * `keel build` loads the project through esbuild, which `@keel/compiler` lists as an optional peer and the scaffold's
 * `package.json` does not list, so the project declares it (the version the compiler names) before the install.
 */
async function addPeerTools(dir: string): Promise<void> {
  const file = join(dir, "package.json");
  const pkg: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!isRecord(pkg)) throw new Error("scaffold wrote a package.json that is not an object");
  const dev = isRecord(pkg["devDependencies"]) ? pkg["devDependencies"] : {};
  await writeFile(file, `${JSON.stringify({ ...pkg, devDependencies: { ...dev, esbuild: "^0.28.2" } }, null, 2)}\n`);
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
