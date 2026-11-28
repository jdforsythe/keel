import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { stepNotes } from "../internal/stepNotes.ts";
import type { ShellHost } from "../types/ShellHost.ts";
import { shellBuild } from "./shellBuild.ts";

/** Binary only: this machine as `keel build --target` sees it: tools run with this process's `PATH`, and `shellBuild`. */
export const hostShell: ShellHost = {
  probe: {
    run: (cmd, args) => {
      const r = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe", timeout: 30_000 });
      return r.error !== undefined ? undefined : { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
    },
    exists: existsSync,
    platform: process.platform,
  },
  build: (cwd, plan) => {
    const r = shellBuild(cwd, plan);
    const sorted = stepNotes(r.notes, false);
    return { code: r.code, diagnostics: sorted.diagnostics, stderr: r.stderr + sorted.stderr, artifacts: r.artifacts };
  },
};
