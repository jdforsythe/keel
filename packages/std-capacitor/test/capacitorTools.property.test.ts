// What a Capacitor build lacks, against fake machines (std.capacitor Tools). Seed 1337.
import type { ShellProbe } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { capacitorTools } from "../src/tools/capacitorTools.ts";

const run = { seed: 1337, numRuns: 200 };

/** A machine for `platform` with the given tools (command -> output), paths and environment. */
const machine = (
  platform: string,
  tools: Record<string, string>,
  paths: readonly string[],
  os: string,
  env: Readonly<Record<string, string | undefined>> = {},
): ShellProbe => ({
  platform,
  env,
  probe: {
    run: (cmd) => (cmd in tools ? { code: 0, out: tools[cmd] ?? "" } : undefined),
    exists: (p) => paths.includes(p),
    platform: os,
  },
});
const cap = "node_modules/.bin/cap";
const tools = (ts: readonly { tool: string }[]): string[] => ts.map((t) => t.tool);

describe("capacitorTools", () => {
  test("Android needs JDK 21 and an SDK with platform-tools; iOS needs macOS and Xcode 26", () => {
    fc.assert(
      fc.property(fc.integer({ min: 8, max: 25 }), fc.integer({ min: 15, max: 30 }), (jdk, xcode) => {
        const java = jdk === 8 ? 'openjdk version "1.8.0_402"' : `openjdk version "${jdk}.0.2" 2024-01-16`;
        const android = machine("android", { "/jdk/bin/java": java }, [cap, "/sdk/platform-tools"], "linux", {
          JAVA_HOME: "/jdk",
          ANDROID_HOME: "/sdk",
        });
        expect(capacitorTools(android)).toEqual(jdk >= 21 ? [] : [{ tool: "java", need: "JDK 21" }]);
        const ios = machine("ios", { xcodebuild: `Xcode ${xcode}.6\nBuild version 17A1` }, [cap], "darwin");
        expect(capacitorTools(ios)).toEqual(xcode >= 26 ? [] : [{ tool: "xcodebuild", need: "Xcode 26" }]);
      }),
      run,
    );
  });

  test("iOS on another OS is one entry naming macOS; Android without an SDK names ANDROID_HOME", () => {
    expect(capacitorTools(machine("ios", { xcodebuild: "Xcode 26.6" }, [cap], "linux"))).toEqual([
      { tool: "xcodebuild", need: "macOS and Xcode 26" },
    ]);
    expect(capacitorTools(machine("android", { java: 'version "21"' }, [cap], "linux"))).toEqual([
      { tool: "Android SDK", need: "ANDROID_HOME set to an SDK with platform-tools" },
    ]);
  });

  test("the SDK is ANDROID_HOME, else ANDROID_SDK_ROOT; java is $JAVA_HOME/bin/java, else java", () => {
    const base = { java: 'openjdk version "21.0.2"' };
    const sdk = (env: Record<string, string>) =>
      capacitorTools(machine("android", base, [cap, "/s/platform-tools"], "linux", env));
    expect(sdk({ ANDROID_SDK_ROOT: "/s" })).toEqual([]);
    expect(sdk({ ANDROID_HOME: "/s" })).toEqual([]);
    expect(sdk({ ANDROID_HOME: "/elsewhere", ANDROID_SDK_ROOT: "/s" })).toHaveLength(1);
    const home = machine("android", { "/jdk/bin/java": 'version "21"' }, [cap, "/s/platform-tools"], "linux", {
      JAVA_HOME: "/jdk",
      ANDROID_HOME: "/s",
    });
    expect(capacitorTools(home)).toEqual([]);
    expect(tools(capacitorTools({ ...home, env: { ANDROID_HOME: "/s" } }))).toEqual(["java"]);
  });

  test("with no platform the Android tools are asked for; the CLI is node_modules/.bin/cap, tested unresolved", () => {
    const seen: string[] = [];
    const at = machine("android", {}, [], "linux");
    const probe = {
      ...at.probe,
      exists: (p: string) => {
        seen.push(p);
        return false;
      },
    };
    const lacking = capacitorTools({ ...at, platform: undefined, probe });
    expect(tools(lacking)).toEqual(["java", "Android SDK", "cap"]);
    expect(lacking[2]).toEqual({ tool: "cap", need: "@capacitor/cli in the app's devDependencies" });
    expect(seen).toContain(cap);
  });
});
