import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ShellBuild } from "@keel/cli";
import { toolCommand } from "@keel/cli/shell";
import { returnScheme } from "../returnScheme.ts";
import { allowConfig } from "./allowConfig.ts";
import { androidNetworkSecurity } from "./androidNetworkSecurity.ts";
import { metaPolicy } from "./metaPolicy.ts";

type Step = {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly cwd: string;
  /** Runs before the tool starts. */
  readonly before?: () => void;
};

/** The platform file that registers the shell's `id` as a URI scheme (std.capacitor Return links). */
const SCHEME_FILES: Readonly<Record<string, string>> = {
  android: "android/app/src/main/AndroidManifest.xml",
  ios: "ios/App/App/Info.plist",
};

/** Writes `androidNetworkSecurity`'s manifest and config into the Android project at `android` when it has a manifest. */
function cleartext(android: string, at: ShellBuild): void {
  const main = join(android, "app", "src", "main");
  const manifestFile = join(main, "AndroidManifest.xml");
  if (!existsSync(manifestFile)) return;
  const { manifest, config } = androidNetworkSecurity(readFileSync(manifestFile, "utf8"), at.origin, at.release);
  writeFileSync(manifestFile, manifest);
  const file = join(main, "res", "xml", "keel_network_security.xml");
  if (config === undefined) rmSync(file, { force: true });
  else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, config);
  }
}

/** The shell's `id` registered in the platform project (`returnScheme`); a project without that file is left as it is. */
function scheme(dir: string, platform: string, id: string): void {
  const file = join(dir, SCHEME_FILES[platform] ?? "");
  if (existsSync(file)) writeFileSync(file, returnScheme(readFileSync(file, "utf8"), id));
}

/** The tools of one platform's build and the artifact they leave, relative to the project. */
function stepsOf(at: ShellBuild, platform: string): { steps: Step[]; artifact: string } {
  const dir = at.dir;
  const rel = `dist/${at.deployable}/capacitor`;
  const add: Step[] = existsSync(join(dir, platform))
    ? []
    : [{ ...toolCommand(dir, "@capacitor/cli", "cap", ["add", platform]), cwd: dir }];
  const sync: Step = { ...toolCommand(dir, "@capacitor/cli", "cap", ["sync", platform]), cwd: dir };
  if (platform === "android") {
    const task = at.release ? "assembleRelease" : "assembleDebug";
    const mode = at.release ? "release/app-release-unsigned.apk" : "debug/app-debug.apk";
    return {
      steps: [
        ...add,
        sync,
        {
          cmd: "./gradlew",
          args: [task],
          cwd: join(dir, "android"),
          before: () => {
            scheme(dir, platform, at.id);
            cleartext(join(dir, "android"), at);
          },
        },
      ],
      artifact: `${rel}/android/app/build/outputs/apk/${mode}`,
    };
  }
  const config = at.release ? "Release" : "Debug";
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
    cwd: join(dir, "ios"),
    before: () => scheme(dir, platform, at.id),
  };
  return {
    steps: [...add, sync, build],
    artifact: `${rel}/ios/build/Build/Products/${config}-iphonesimulator/App.app`,
  };
}

/**
 * A Capacitor shell build in `at.dir`, beside `www/` and `capacitor.config.json` (std.capacitor Build): the app's
 * `package.json` (the Capacitor CLI runs only at the root of an npm package and reads the app's plugins from it), the
 * deployable's `csp.txt` policy as a meta tag in `www/index.html`, `plugins.KeelHttp.allow` (`origin` then `connect`)
 * added to `capacitor.config.json` there (`allowConfig`), which the native plugin reads, then `cap add` (once), `cap sync`, the shell's `id`
 * registered as a URI scheme in the platform project (`returnScheme`), and the platform's build, on Android after
 * `androidNetworkSecurity`'s cleartext rule. The artifact is the APK or the simulator app; a failing tool's output is
 * the error.
 */
export function capacitorBuild(at: ShellBuild): { readonly artifact: string } | { readonly error: string } {
  cpSync(join(at.root, "package.json"), join(at.dir, "package.json"));
  const index = join(at.dir, "www", "index.html");
  const csp = join(at.root, "dist", at.deployable, "csp.txt");
  if (existsSync(csp)) writeFileSync(index, metaPolicy(readFileSync(index, "utf8"), readFileSync(csp, "utf8")));
  const config = join(at.dir, "capacitor.config.json");
  const generated = existsSync(config) ? readFileSync(config, "utf8") : "";
  // The generated file is read-only and was copied so: the build's own replaces it.
  rmSync(config, { force: true });
  writeFileSync(config, allowConfig(generated, at.origin, at.connect));
  const { steps, artifact } = stepsOf(at, at.platform ?? "android");
  for (const s of steps) {
    s.before?.();
    const r = spawnSync(s.cmd, s.args, {
      cwd: s.cwd,
      env: at.env,
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: 2 ** 28,
    });
    if (r.status !== 0) return { error: `${r.stdout}\n${r.stderr}\n${r.error?.message ?? ""}` };
  }
  return { artifact };
}
