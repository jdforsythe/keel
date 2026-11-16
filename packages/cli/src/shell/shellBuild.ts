import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { tauriHttpCapability } from "@keel/scaffold";
import type { ShellPlan } from "../types/ShellPlan.ts";
import { defaultIcon } from "./defaultIcon.ts";
import { metaPolicy } from "./metaPolicy.ts";
import { toolError } from "./toolError.ts";

type Step = { readonly cmd: string; readonly args: readonly string[]; readonly cwd: string };
type Done = { code: number; notes: string[]; stderr: string; artifacts: string[] };

/** Run one tool to its end; undefined when it exits 0, else its error lines (`toolError`; the spawn failure when it never ran). */
function run(s: Step, env: NodeJS.ProcessEnv, root: string): string | undefined {
  const r = spawnSync(s.cmd, s.args, { cwd: s.cwd, env, encoding: "utf8", stdio: "pipe", maxBuffer: 2 ** 28 });
  return r.status === 0 ? undefined : toolError(`${r.stdout}\n${r.stderr}\n${r.error?.message ?? ""}`, root);
}

/** The tools of one deployable's shell build and the artifact they leave, relative to the project (k.shell Build 4). */
function stepsOf(plan: ShellPlan, name: string, at: string): { steps: Step[]; artifact: string } {
  const rel = `dist/${name}/${plan.target}`;
  if (plan.target === "tauri") {
    const mode = plan.release ? "release" : "debug";
    const args = ["--no-install", "tauri", "build", ...(plan.release ? [] : ["--debug"]), "--no-bundle"];
    return { steps: [{ cmd: "npx", args, cwd: at }], artifact: `${rel}/target/${mode}/${plan.crate}` };
  }
  const platform = plan.platform ?? "android";
  const add: Step[] = existsSync(join(at, platform))
    ? []
    : [{ cmd: "npx", args: ["--no-install", "cap", "add", platform], cwd: at }];
  const sync: Step = { cmd: "npx", args: ["--no-install", "cap", "sync", platform], cwd: at };
  if (platform === "android") {
    const task = plan.release ? "assembleRelease" : "assembleDebug";
    const mode = plan.release ? "release/app-release-unsigned.apk" : "debug/app-debug.apk";
    return {
      steps: [...add, sync, { cmd: "./gradlew", args: [task], cwd: join(at, "android") }],
      artifact: `${rel}/android/app/build/outputs/apk/${mode}`,
    };
  }
  const config = plan.release ? "Release" : "Debug";
  const build: Step = {
    cmd: "xcodebuild",
    args: [
      "-project",
      "App/App.xcodeproj",
      "-scheme",
      "App",
      "-configuration",
      config,
      "-sdk",
      "iphonesimulator",
      "-derivedDataPath",
      "build",
      "CODE_SIGNING_ALLOWED=NO",
      "build",
    ],
    cwd: join(at, "ios"),
  };
  return {
    steps: [...add, sync, build],
    artifact: `${rel}/ios/build/Build/Products/${config}-iphonesimulator/App.app`,
  };
}

/**
 * Binary only: the disk half of `keel build --target` after the web build (k.shell Build 3-4), per deployable of
 * `plan`: the shell entry's Vite build (`KEEL_DEPLOYABLE`, `KEEL_SHELL`, `KEEL_ORIGIN`), which the Vite plugin writes to
 * `dist/<name>/<shell>/www/`; the shell files of `deploy/<name>/<shell>/` beside it (with Cargo's `Cargo.lock` when
 * committed, and the app's `icons/icon.png` when it has one); for Tauri `capabilities/http.json` allowing `KEEL_ORIGIN`
 * and, when the app has no `icons/icon.png`, `defaultIcon`; for Capacitor the deployable's `csp.txt` policy as a meta
 * tag in `www/index.html`; then the shell's tools. A Tauri build's new `Cargo.lock` is copied back to
 * `deploy/<name>/tauri/`. The tools run with Cargo's `bin` folder first on `PATH`. Stops at the first failing step: its
 * error lines (`toolError`) are `stderr`.
 */
export function shellBuild(cwd: string, plan: ShellPlan): Done {
  const done: Done = { code: 0, notes: [], stderr: "", artifacts: [] };
  // The cargo the toolchain check accepts (`toolchain`) may be under `CARGO_HOME` only: the tools find it first on `PATH`.
  const cargo = join(process.env.CARGO_HOME ?? join(process.env.HOME ?? "", ".cargo"), "bin");
  const PATH = `${cargo}${delimiter}${process.env.PATH ?? ""}`;
  const env = { ...process.env, PATH, KEEL_ORIGIN: plan.origin, KEEL_SHELL: plan.target };
  for (const name of plan.deployables) {
    const rel = `dist/${name}/${plan.target}`;
    const at = join(cwd, rel);
    const vite = run(
      { cmd: "npx", args: ["--no-install", "vite", "build"], cwd },
      { ...env, KEEL_DEPLOYABLE: name },
      cwd,
    );
    if (vite !== undefined) return { ...done, code: 1, stderr: vite };
    const index = join(at, "www", "index.html");
    if (!existsSync(index)) {
      done.notes.push(`E1049 shell entry not built: the Vite plugin wrote no ${rel}/www/index.html\n`);
      return { ...done, code: 1 };
    }
    const from = join(cwd, "deploy", name, plan.target);
    cpSync(from, at, { recursive: true });
    if (plan.target === "tauri") {
      writeFileSync(join(at, "capabilities", "http.json"), tauriHttpCapability(plan.origin));
      if (!existsSync(join(from, "icons", "icon.png"))) {
        mkdirSync(join(at, "icons"), { recursive: true });
        writeFileSync(join(at, "icons", "icon.png"), defaultIcon());
      }
    } else {
      // The Capacitor CLI runs only at the root of an npm package and reads the app's plugins from its dependencies.
      cpSync(join(cwd, "package.json"), join(at, "package.json"));
      const csp = join(cwd, "dist", name, "csp.txt");
      if (existsSync(csp)) writeFileSync(index, metaPolicy(readFileSync(index, "utf8"), readFileSync(csp, "utf8")));
    }
    const { steps, artifact } = stepsOf(plan, name, at);
    for (const s of steps) {
      const failed = run(s, env, cwd);
      if (failed !== undefined) return { ...done, code: 1, stderr: failed };
    }
    const lock = join(from, "Cargo.lock");
    if (plan.target === "tauri" && !existsSync(lock) && existsSync(join(at, "Cargo.lock")))
      cpSync(join(at, "Cargo.lock"), lock);
    done.artifacts.push(artifact);
  }
  return done;
}
