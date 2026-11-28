// What a Tauri build lacks, against fake machines (std.tauri Tools). Seed 1337.
import type { ShellProbe } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { tauriTools } from "../src/tools/tauriTools.ts";

const run = { seed: 1337, numRuns: 200 };

/** A machine with the given tools (command -> output) and paths, and the environment it runs with. */
const machine = (
  tools: Record<string, string>,
  paths: readonly string[],
  platform: string,
  env: Readonly<Record<string, string | undefined>> = {},
): ShellProbe => ({
  platform: undefined,
  env,
  probe: {
    run: (cmd) => (cmd in tools ? { code: 0, out: tools[cmd] ?? "" } : undefined),
    exists: (p) => paths.includes(p),
    platform,
  },
});
const bin = ["node_modules/.bin/tauri"];

describe("tauriTools", () => {
  test("cargo at Rust 1.95 or newer passes; older or missing is one entry naming cargo and Rust 1.95", () => {
    fc.assert(
      fc.property(fc.integer({ min: 80, max: 120 }), fc.integer({ min: 0, max: 9 }), (minor, patch) => {
        const ok = machine({ cargo: `cargo 1.${minor}.${patch} (abc 2026-01-01)` }, bin, "darwin");
        expect(tauriTools(ok)).toEqual(minor >= 95 ? [] : [{ tool: "cargo", need: "Rust 1.95" }]);
      }),
      run,
    );
    expect(tauriTools(machine({ cargo: "cargo 2.0.0" }, bin, "darwin"))).toEqual([]);
    expect(tauriTools(machine({ cargo: "garbage" }, bin, "darwin"))).toEqual([{ tool: "cargo", need: "Rust 1.95" }]);
  });

  test("a machine with nothing lacks cargo, on Linux WebKitGTK 4.1, and the CLI, in that order", () => {
    expect(tauriTools(machine({}, [], "linux")).map((e) => e.tool)).toEqual(["cargo", "webkit2gtk-4.1", "tauri"]);
    expect(tauriTools(machine({}, [], "darwin")).map((e) => e.tool)).toEqual(["cargo", "tauri"]);
    expect(tauriTools(machine({}, [], "linux"))).toEqual([
      { tool: "cargo", need: "Rust 1.95" },
      { tool: "webkit2gtk-4.1", need: "WebKitGTK 4.1" },
      { tool: "tauri", need: "@tauri-apps/cli in the app's devDependencies" },
    ]);
  });

  test("WebKitGTK is asked of pkg-config on Linux only", () => {
    const ok = { cargo: "cargo 1.99.0", "pkg-config": "2.41.0" };
    expect(tauriTools(machine(ok, bin, "linux"))).toEqual([]);
    expect(tauriTools(machine({ cargo: "cargo 1.99.0" }, bin, "linux")).map((e) => e.tool)).toEqual(["webkit2gtk-4.1"]);
    expect(tauriTools(machine({ cargo: "cargo 1.99.0" }, bin, "darwin"))).toEqual([]);
  });

  test("the CLI is tested at the project-relative node_modules/.bin/tauri, unresolved", () => {
    const seen: string[] = [];
    const at = machine({ cargo: "cargo 1.99.0" }, [], "darwin");
    const probe = {
      ...at.probe,
      exists: (p: string) => {
        seen.push(p);
        return false;
      },
    };
    expect(tauriTools({ ...at, probe })).toEqual([
      { tool: "tauri", need: "@tauri-apps/cli in the app's devDependencies" },
    ]);
    expect(seen).toContain("node_modules/.bin/tauri");
  });

  test("cargo under CARGO_HOME, else ~/.cargo, is found when PATH has none", () => {
    const local = (cargoBin: string): ShellProbe => ({
      platform: undefined,
      env: cargoBin === "/h/.cargo/bin/cargo" ? { HOME: "/h" } : { HOME: "/h", CARGO_HOME: "/c" },
      probe: {
        run: (cmd) => (cmd === cargoBin ? { code: 0, out: "cargo 1.99.1" } : undefined),
        exists: (x) => x === cargoBin || bin.includes(x),
        platform: "darwin",
      },
    });
    expect(tauriTools(local("/h/.cargo/bin/cargo"))).toEqual([]);
    expect(tauriTools(local("/c/bin/cargo"))).toEqual([]);
  });
});
