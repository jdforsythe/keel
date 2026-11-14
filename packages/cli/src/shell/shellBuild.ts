import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tauriHttpCapability } from "@keel/scaffold";
import type { ShellPlan } from "../types/ShellPlan.ts";
import { metaPolicy } from "./metaPolicy.ts";

type Step = { readonly cmd: string; readonly args: readonly string[]; readonly cwd: string };
type Done = { code: number; notes: string[]; stderr: string; artifacts: string[] };

const tail = (r: { stdout: string | null; stderr: string | null }): string =>
  `${(r.stderr || r.stdout || "").trim().split("\n").slice(-5).join("\n")}\n`;

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
 * committed); for Tauri `capabilities/http.json` allowing `KEEL_ORIGIN`, for Capacitor the deployable's `csp.txt`
 * policy as a meta tag in `www/index.html`; then the shell's tools. A Tauri build's new `Cargo.lock` is copied back to
 * `deploy/<name>/tauri/`. Stops at the first failing step: its output tail is `stderr`.
 */
export function shellBuild(cwd: string, plan: ShellPlan): Done {
  const done: Done = { code: 0, notes: [], stderr: "", artifacts: [] };
  const env = { ...process.env, KEEL_ORIGIN: plan.origin, KEEL_SHELL: plan.target };
  for (const name of plan.deployables) {
    const rel = `dist/${name}/${plan.target}`;
    const at = join(cwd, rel);
    const vite = spawnSync("npx", ["--no-install", "vite", "build"], {
      cwd,
      env: { ...env, KEEL_DEPLOYABLE: name },
      encoding: "utf8",
      stdio: "pipe",
    });
    if ((vite.status ?? 1) !== 0) return { ...done, code: 1, stderr: tail(vite) };
    const index = join(at, "www", "index.html");
    if (!existsSync(index)) {
      done.notes.push(`E1049 shell entry not built: the Vite plugin wrote no ${rel}/www/index.html\n`);
      return { ...done, code: 1 };
    }
    cpSync(join(cwd, "deploy", name, plan.target), at, { recursive: true });
    if (plan.target === "tauri") writeFileSync(join(at, "capabilities", "http.json"), tauriHttpCapability(plan.origin));
    else {
      const csp = join(cwd, "dist", name, "csp.txt");
      if (existsSync(csp)) writeFileSync(index, metaPolicy(readFileSync(index, "utf8"), readFileSync(csp, "utf8")));
    }
    const { steps, artifact } = stepsOf(plan, name, at);
    for (const s of steps) {
      const r = spawnSync(s.cmd, s.args, { cwd: s.cwd, env, encoding: "utf8", stdio: "pipe" });
      if ((r.status ?? 1) !== 0) return { ...done, code: 1, stderr: tail(r) };
    }
    const lock = join(cwd, "deploy", name, "tauri", "Cargo.lock");
    if (plan.target === "tauri" && !existsSync(lock) && existsSync(join(at, "Cargo.lock")))
      cpSync(join(at, "Cargo.lock"), lock);
    done.artifacts.push(artifact);
  }
  return done;
}
