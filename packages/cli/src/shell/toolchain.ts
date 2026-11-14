import type { Diag } from "../internal/Diag.ts";
import { makeDiag } from "../internal/makeDiag.ts";
import type { Probe } from "../types/Probe.ts";
import { versionOf } from "./versionOf.ts";

type Need = { readonly tool: string; readonly at: readonly [number, number]; readonly label: string };

const RUST: Need = { tool: "cargo", at: [1, 95], label: "Rust 1.95" };
const JDK: Need = { tool: "java", at: [21, 0], label: "JDK 21" };
const XCODE: Need = { tool: "xcodebuild", at: [26, 0], label: "Xcode 26" };

const e1575 = (message: string): Diag => makeDiag("E1575", message, { see: "k.shell" });
const older = (a: readonly [number, number], b: readonly [number, number]): boolean =>
  a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/** One tool at a version: missing, unreadable or older is one E1575 naming it and the version needed. */
function need(probe: Probe, cmd: string, args: readonly string[], n: Need, pick: (out: string) => string): Diag[] {
  const r = probe.run(cmd, args);
  if (r === undefined || r.code !== 0) return [e1575(`${n.tool} not found: a shell build needs ${n.label}`)];
  const v = versionOf(pick(r.out));
  if (v === undefined || older(v, n.at)) return [e1575(`${n.tool} is older than ${n.label}, which this build needs`)];
  return [];
}

/**
 * The toolchain of a shell build, checked before any work (k.shell Build 2): Tauri needs `cargo` of Rust 1.95 and, on
 * Linux, WebKitGTK 4.1 (`pkg-config`); Capacitor Android JDK 21 (`$JAVA_HOME/bin/java`, else `java`) and the Android
 * SDK (`ANDROID_HOME` or `ANDROID_SDK_ROOT`, holding `platform-tools`); Capacitor iOS macOS and Xcode 26. Each shell
 * also needs its CLI in the project (`node_modules/.bin/tauri`, `node_modules/.bin/cap`). Each missing or older one is
 * one E1575 naming it and the version needed.
 */
export function toolchain(
  target: "capacitor" | "tauri",
  platform: "android" | "ios" | undefined,
  probe: Probe,
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): Diag[] {
  const out: Diag[] = [];
  const cli = (bin: string, pkg: string): void => {
    if (!probe.exists(`${cwd}/node_modules/.bin/${bin}`))
      out.push(e1575(`${bin} not found: add ${pkg} to the app's devDependencies`));
  };
  if (target === "tauri") {
    const cargoHome = env.CARGO_HOME ?? (env.HOME === undefined ? undefined : `${env.HOME}/.cargo`);
    const local = cargoHome === undefined ? undefined : `${cargoHome}/bin/cargo`;
    const cmd = local !== undefined && probe.exists(local) ? local : "cargo";
    out.push(...need(probe, cmd, ["--version"], RUST, (o) => o.replace(/^\D*/, "")));
    if (probe.platform === "linux") {
      const r = probe.run("pkg-config", ["--modversion", "webkit2gtk-4.1"]);
      if (r === undefined || r.code !== 0)
        out.push(e1575("webkit2gtk-4.1 not found: a Tauri Linux build needs WebKitGTK 4.1"));
    }
    cli("tauri", "@tauri-apps/cli");
    return out;
  }
  if (platform === "ios") {
    if (probe.platform !== "darwin") out.push(e1575("xcodebuild not found: an iOS build needs macOS and Xcode 26"));
    else out.push(...need(probe, "xcodebuild", ["-version"], XCODE, (o) => o.replace(/^\D*/, "")));
  } else {
    const java = env.JAVA_HOME === undefined ? "java" : `${env.JAVA_HOME}/bin/java`;
    out.push(
      ...need(probe, java, ["-version"], JDK, (o) =>
        // A `1.8.0` Java version is major 8.
        (/version "([^"]+)"/.exec(o)?.[1] ?? "").replace(/^1\.(?=\d)/, ""),
      ),
    );
    const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT;
    if (sdk === undefined || !probe.exists(`${sdk}/platform-tools`))
      out.push(e1575("Android SDK not found: set ANDROID_HOME to an SDK with platform-tools"));
  }
  cli("cap", "@capacitor/cli");
  return out;
}
