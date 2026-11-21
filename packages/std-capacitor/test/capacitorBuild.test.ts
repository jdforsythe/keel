import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
// The Capacitor shell build (std.capacitor Build) against fake tools: a temp build folder and a fake `npx` and
// `xcodebuild` on PATH stand in for the Capacitor CLI and the platform builds. Covers the build folder, the policy in
// the page, the scheme registered in the platform file, the cleartext rule and the artifacts.
import type { ShellBuild } from "@keel/cli";
import { afterEach, describe, expect, test } from "vitest";
import { returnScheme } from "../src/returnScheme.ts";
import { capacitorBuild } from "../src/tools/capacitorBuild.ts";

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:label="@string/app_name">
        <activity android:name=".MainActivity" android:launchMode="singleTask" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;
const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
</dict>
</plist>
`;
/**
 * The fake `npx`: `cap`, as the Capacitor CLI, refuses a folder without a `package.json`; `cap add` leaves the platform
 * project (a `gradlew` and a manifest, or a plist) from the files beside `bin/`.
 */
const NPX = `#!/bin/sh
echo "$@" >> "$(dirname "$0")/calls.txt"
case "$2" in
  cap)
    test -f package.json || { echo "[error] The Capacitor CLI needs to run at the root of an npm package." >&2; exit 1; }
    if [ "$3" = add ] && [ "$4" = android ]; then
      mkdir -p android/app/src/main && cp "$(dirname "$0")/../manifest.xml" android/app/src/main/AndroidManifest.xml
      printf '#!/bin/sh\\necho "$@" > task.txt\\n' > android/gradlew && chmod +x android/gradlew
    fi
    if [ "$3" = add ] && [ "$4" = ios ]; then
      mkdir -p ios/App/App && cp "$(dirname "$0")/../Info.plist" ios/App/App/Info.plist
    fi ;;
  *) exit 64 ;;
esac
`;
const XCODEBUILD = `#!/bin/sh
echo "$@" > xcodebuild-args.txt
`;

const made: string[] = [];
/** A project and the build's input: the app's `package.json`, the build folder with `www/` and the config, the fake tools. */
function project(
  files: Record<string, string> = {},
  over: Partial<ShellBuild> = {},
): { root: string; dir: string; at: ShellBuild } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-cap-build-")));
  made.push(root);
  const all: Record<string, string> = {
    "bin/npx": NPX,
    "bin/xcodebuild": XCODEBUILD,
    "manifest.xml": MANIFEST,
    "Info.plist": PLIST,
    "package.json": '{ "name": "app", "dependencies": { "@capacitor/preferences": "8.0.1" } }\n',
    "dist/web/capacitor/capacitor.config.json": "{}\n",
    "dist/web/capacitor/www/index.html": "<html><head></head></html>\n",
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  for (const f of ["npx", "xcodebuild"]) chmodSync(join(root, "bin", f), 0o755);
  const dir = join(root, "dist/web/capacitor");
  const at: ShellBuild = {
    deployable: "web",
    id: "dev.keel.golden",
    name: "Golden",
    version: "1.0.0",
    pkg: "app",
    policy: undefined,
    identity: false,
    root,
    dir,
    origin: "https://app.example.com",
    platform: "android",
    release: false,
    env: { PATH: `${join(root, "bin")}:/usr/bin:/bin` },
    ...over,
  };
  return { root, dir, at };
}

afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("capacitorBuild", () => {
  test("a build folder is an npm package with the app's dependencies and the policy in its page", () => {
    const { root, dir, at } = project({ "dist/web/csp.txt": "default-src 'none'; frame-ancestors 'none'" });
    expect(capacitorBuild(at)).toEqual({
      artifact: "dist/web/capacitor/android/app/build/outputs/apk/debug/app-debug.apk",
    });
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(readFileSync(join(root, "package.json"), "utf8"));
    expect(readFileSync(join(dir, "android/task.txt"), "utf8")).toBe("assembleDebug\n");
    expect(readFileSync(join(dir, "www/index.html"), "utf8")).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'">`,
    );
    expect(existsSync(join(dir, "icons"))).toBe(false);
  });

  test("a page without a policy is left as it is", () => {
    const { dir, at } = project();
    capacitorBuild(at);
    expect(readFileSync(join(dir, "www/index.html"), "utf8")).toBe("<html><head></head></html>\n");
  });

  test("the platform folder exists after the first build: the next one syncs without adding it again; release names its artifact", () => {
    const { root, at } = project();
    capacitorBuild(at);
    expect(capacitorBuild({ ...at, release: true })).toEqual({
      artifact: "dist/web/capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk",
    });
    expect(readFileSync(join(root, "bin/calls.txt"), "utf8").split("\n")).toEqual([
      "--no-install cap add android",
      "--no-install cap sync android",
      "--no-install cap sync android",
      "",
    ]);
    expect(readFileSync(join(at.dir, "android/task.txt"), "utf8")).toBe("assembleRelease\n");
  });

  test("the shell's id is registered as a URI scheme in the platform file, once", () => {
    const { dir, at } = project();
    capacitorBuild(at);
    capacitorBuild(at);
    const manifest = readFileSync(join(dir, "android/app/src/main/AndroidManifest.xml"), "utf8");
    expect(manifest).toBe(returnScheme(MANIFEST, "dev.keel.golden"));
    expect(manifest.match(/android:scheme="dev\.keel\.golden"/g)).toHaveLength(1);
  });

  test("an iOS build registers the scheme in Info.plist and builds the simulator app", () => {
    const { dir, at } = project({}, { platform: "ios" });
    expect(capacitorBuild(at)).toEqual({
      artifact: "dist/web/capacitor/ios/build/Build/Products/Debug-iphonesimulator/App.app",
    });
    expect(readFileSync(join(dir, "ios/App/App/Info.plist"), "utf8")).toBe(returnScheme(PLIST, "dev.keel.golden"));
    expect(readFileSync(join(dir, "ios/xcodebuild-args.txt"), "utf8")).toBe(
      "-project App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath build CODE_SIGNING_ALLOWED=NO build\n",
    );
    expect(capacitorBuild({ ...at, release: true })).toEqual({
      artifact: "dist/web/capacitor/ios/build/Build/Products/Release-iphonesimulator/App.app",
    });
  });

  test("an Android build with an http: origin allows cleartext to its host only; https: or release takes it out", () => {
    const manifest =
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application\n        android:allowBackup="true">\n    </application>\n</manifest>\n';
    const { dir, at } = project({
      "dist/web/capacitor/android/gradlew": '#!/bin/sh\necho "$@" > task.txt\n',
      "dist/web/capacitor/android/app/src/main/AndroidManifest.xml": manifest,
    });
    chmodSync(join(dir, "android/gradlew"), 0o755);
    const main = join(dir, "android/app/src/main");
    const config = join(main, "res/xml/keel_network_security.xml");
    const cleartext = { ...at, origin: "http://localhost:4182" };
    expect("artifact" in capacitorBuild(cleartext)).toBe(true);
    expect(readFileSync(join(main, "AndroidManifest.xml"), "utf8")).toContain(
      'android:networkSecurityConfig="@xml/keel_network_security"',
    );
    expect(readFileSync(config, "utf8")).toContain('<domain includeSubdomains="false">localhost</domain>');
    expect(readFileSync(join(dir, "capacitor.config.json"), "utf8")).toBe("{}\n");
    expect("artifact" in capacitorBuild({ ...cleartext, origin: "https://app.example.com" })).toBe(true);
    expect(existsSync(config)).toBe(false);
    expect(readFileSync(join(main, "AndroidManifest.xml"), "utf8")).not.toContain("networkSecurityConfig");
    expect("artifact" in capacitorBuild(cleartext)).toBe(true);
    expect("artifact" in capacitorBuild({ ...cleartext, release: true })).toBe(true);
    expect(existsSync(config)).toBe(false);
    expect(readFileSync(join(main, "AndroidManifest.xml"), "utf8")).not.toContain("networkSecurityConfig");
  });

  test("a failing tool's whole output is the error, and no platform project is left", () => {
    const { dir, at } = project({ "bin/npx": "#!/bin/sh\necho '[error] nope' >&2\nexit 1\n" });
    const r = capacitorBuild(at);
    expect("error" in r && r.error).toContain("[error] nope");
    expect(existsSync(join(dir, "android"))).toBe(false);
  });
});
