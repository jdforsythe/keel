import type { ShellProbe } from "@keel/cli";
import { versionOf } from "./versionOf.ts";

const older = (a: readonly [number, number], b: readonly [number, number]): boolean =>
  a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/** One tool at a version: missing, unreadable or older is its entry. */
function need(
  at: ShellProbe,
  cmd: string,
  args: readonly string[],
  want: { readonly tool: string; readonly at: readonly [number, number]; readonly need: string },
  pick: (out: string) => string,
): { tool: string; need: string }[] {
  const r = at.probe.run(cmd, args);
  const v = r === undefined || r.code !== 0 ? undefined : versionOf(pick(r.out));
  return v === undefined || older(v, want.at) ? [{ tool: want.tool, need: want.need }] : [];
}

/**
 * What a Capacitor build lacks, checked before any work (std.capacitor Tools): for Android JDK 21
 * (`$JAVA_HOME/bin/java`, else `java`) and the Android SDK (`ANDROID_HOME` or `ANDROID_SDK_ROOT`, holding
 * `platform-tools`); for iOS macOS and Xcode 26 (`xcodebuild`); and `@capacitor/cli` in the project
 * (`node_modules/.bin/cap`). Each missing or older one is one entry.
 */
export function capacitorTools(at: ShellProbe): readonly { readonly tool: string; readonly need: string }[] {
  const { probe, env } = at;
  const out: { tool: string; need: string }[] = [];
  if (at.platform === "ios") {
    if (probe.platform !== "darwin") out.push({ tool: "xcodebuild", need: "macOS and Xcode 26" });
    else
      out.push(
        ...need(at, "xcodebuild", ["-version"], { tool: "xcodebuild", at: [26, 0], need: "Xcode 26" }, (o) =>
          o.replace(/^\D*/, ""),
        ),
      );
  } else {
    const java = env.JAVA_HOME === undefined ? "java" : `${env.JAVA_HOME}/bin/java`;
    out.push(
      ...need(at, java, ["-version"], { tool: "java", at: [21, 0], need: "JDK 21" }, (o) =>
        // A `1.8.0` Java version is major 8.
        (/version "([^"]+)"/.exec(o)?.[1] ?? "").replace(/^1\.(?=\d)/, ""),
      ),
    );
    const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT;
    if (sdk === undefined || !probe.exists(`${sdk}/platform-tools`))
      out.push({ tool: "Android SDK", need: "ANDROID_HOME set to an SDK with platform-tools" });
  }
  if (!probe.exists("node_modules/.bin/cap"))
    out.push({ tool: "cap", need: "@capacitor/cli in the app's devDependencies" });
  return out;
}
