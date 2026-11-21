import type { ShellProbe } from "@keel/cli";
import { versionOf } from "./versionOf.ts";

/** Rust 1.95, which `tauri` 2.12.5 needs. */
const RUST: readonly [number, number] = [1, 95];

/**
 * What a Tauri build lacks, checked before any work (std.tauri Tools): `cargo` of Rust 1.95 (`$CARGO_HOME/bin/cargo`,
 * else `~/.cargo/bin/cargo`, else `cargo` on `PATH`; missing, unreadable or older), on Linux WebKitGTK 4.1 (through
 * `pkg-config`), and `@tauri-apps/cli` in the project (`node_modules/.bin/tauri`). Each is one entry.
 */
export function tauriTools(at: ShellProbe): readonly { readonly tool: string; readonly need: string }[] {
  const out: { tool: string; need: string }[] = [];
  const { probe, env } = at;
  const cargoHome = env.CARGO_HOME ?? (env.HOME === undefined ? undefined : `${env.HOME}/.cargo`);
  const local = cargoHome === undefined ? undefined : `${cargoHome}/bin/cargo`;
  const cargo = probe.run(local !== undefined && probe.exists(local) ? local : "cargo", ["--version"]);
  const v = cargo === undefined || cargo.code !== 0 ? undefined : versionOf(cargo.out.replace(/^\D*/, ""));
  if (v === undefined || v[0] < RUST[0] || (v[0] === RUST[0] && v[1] < RUST[1]))
    out.push({ tool: "cargo", need: "Rust 1.95" });
  if (probe.platform === "linux") {
    const r = probe.run("pkg-config", ["--modversion", "webkit2gtk-4.1"]);
    if (r === undefined || r.code !== 0) out.push({ tool: "webkit2gtk-4.1", need: "WebKitGTK 4.1" });
  }
  if (!probe.exists("node_modules/.bin/tauri"))
    out.push({ tool: "tauri", need: "@tauri-apps/cli in the app's devDependencies" });
  return out;
}
