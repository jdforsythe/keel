import { spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { toolCommand } from "../internal/toolCommand.ts";
import type { ShellPlan } from "../types/ShellPlan.ts";
import { toolError } from "./toolError.ts";

type Done = { code: number; notes: string[]; stderr: string; artifacts: string[] };

/**
 * Binary only: the disk half of `keel build --target` after the web build (k.shell Build 4-5), per app of `plan`: the
 * shell entry's Vite build (`KEEL_DEPLOYABLE`, `KEEL_SHELL`, `KEEL_ORIGIN` only when the plan has an origin, and
 * `NODE_ENV=production` whatever the
 * shell or a project `.env` sets, k.deploy Build), which the Vite plugin writes to `dist/<name>/<shell>/www/`; the
 * shell files of `deploy/<name>/<shell>/` copied beside it; then the target's `build`, given the plan's `connect`
 * origins of that deployable. Stops at the first failure: a
 * tool's output trimmed by `toolError` is `stderr`; each `artifact` is kept, in order.
 */
export function shellBuild(cwd: string, plan: ShellPlan): Done {
  const done: Done = { code: 0, notes: [], stderr: "", artifacts: [] };
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "KEEL_ORIGIN"));
  const env = {
    ...inherited,
    ...(plan.origin === undefined ? {} : { KEEL_ORIGIN: plan.origin }),
    KEEL_SHELL: plan.target,
  };
  for (const app of plan.apps) {
    const name = app.deployable;
    const rel = `dist/${name}/${plan.target}`;
    const at = join(cwd, rel);
    const vite = toolCommand(cwd, "vite", "vite", ["build"]);
    const r = spawnSync(vite.cmd, vite.args, {
      cwd,
      env: { ...env, KEEL_DEPLOYABLE: name, NODE_ENV: "production" },
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: 2 ** 28,
    });
    if (r.status !== 0)
      return { ...done, code: 1, stderr: toolError(`${r.stdout}\n${r.stderr}\n${r.error?.message ?? ""}`, cwd) };
    if (!existsSync(join(at, "www", "index.html"))) {
      done.notes.push(`E1049 shell entry not built: the Vite plugin wrote no ${rel}/www/index.html\n`);
      return { ...done, code: 1 };
    }
    const from = join(cwd, "deploy", name, plan.target);
    if (existsSync(from)) cpSync(from, at, { recursive: true });
    const out = plan.shell.build({
      ...app,
      root: cwd,
      dir: at,
      ...(plan.origin === undefined ? {} : { origin: plan.origin }),
      connect: plan.connect[name] ?? [],
      platform: plan.platform,
      release: plan.release,
      env,
    });
    if ("error" in out) return { ...done, code: 1, stderr: toolError(out.error, cwd) };
    done.artifacts.push(out.artifact);
  }
  return done;
}
