import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import type { ShellBuild } from "@keel/cli";
import { toolCommand } from "@keel/cli/shell";
import { crateName } from "./crateName.ts";
import { defaultIcon } from "./defaultIcon.ts";
import { tauriHttpCapability } from "./tauriHttpCapability.ts";

/**
 * A Tauri shell build in `at.dir`, beside `www/` and the shell files (std.tauri Build): `capabilities/http.json`
 * allowing `KEEL_ORIGIN` when the build has one (to the default browser too with `identity`) and the `connect` origins,
 * or, with none of those, no such file (one an earlier build left is removed), `defaultIcon` as `icons/icon.png` when the app
 * has none, then `tauri build --debug --no-bundle` (`--release`: without `--debug`) with Cargo's `bin` folder first on
 * `PATH`. A new `Cargo.lock` is copied back to `deploy/<name>/tauri/`. The artifact is the binary; a failing tool's
 * output is the error.
 */
export function tauriBuild(at: ShellBuild): { readonly artifact: string } | { readonly error: string } {
  const http = tauriHttpCapability(at.origin, at.connect, at.identity);
  const httpFile = join(at.dir, "capabilities", "http.json");
  if (http === undefined) rmSync(httpFile, { force: true });
  else {
    mkdirSync(dirname(httpFile), { recursive: true });
    writeFileSync(httpFile, http);
  }
  if (!existsSync(join(at.dir, "icons", "icon.png"))) {
    mkdirSync(join(at.dir, "icons"), { recursive: true });
    writeFileSync(join(at.dir, "icons", "icon.png"), defaultIcon());
  }
  // The cargo `tauriTools` accepts may be under `CARGO_HOME` only: the tools find it first on `PATH`.
  const cargo = join(at.env.CARGO_HOME ?? join(at.env.HOME ?? "", ".cargo"), "bin");
  const env = { ...at.env, PATH: `${cargo}${delimiter}${at.env.PATH ?? ""}` };
  const args = ["build", ...(at.release ? [] : ["--debug"]), "--no-bundle"];
  const tool = toolCommand(at.dir, "@tauri-apps/cli", "tauri", args);
  const r = spawnSync(tool.cmd, tool.args, { cwd: at.dir, env, encoding: "utf8", stdio: "pipe", maxBuffer: 2 ** 28 });
  if (r.status !== 0) return { error: `${r.stdout}\n${r.stderr}\n${r.error?.message ?? ""}` };
  const lock = join(at.root, "deploy", at.deployable, "tauri", "Cargo.lock");
  if (!existsSync(lock) && existsSync(join(at.dir, "Cargo.lock"))) cpSync(join(at.dir, "Cargo.lock"), lock);
  return { artifact: `dist/${at.deployable}/tauri/target/${at.release ? "release" : "debug"}/${crateName(at.pkg)}` };
}
