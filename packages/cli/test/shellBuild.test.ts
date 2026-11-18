// The disk half of `keel build --target` against fake tools: a temp project and a fake `npx` on PATH stand in for Vite,
// the Tauri CLI and the Capacitor CLI. Covers the default icon, the app's own icon, `Cargo.lock`, a failing tool's
// output and the Capacitor build folder.
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
import { afterEach, describe, expect, test, vi } from "vitest";
import { defaultIcon } from "../src/shell/defaultIcon.ts";
import { shellBuild } from "../src/shell/shellBuild.ts";
import type { ShellPlan } from "../src/types/ShellPlan.ts";

const PLAN: ShellPlan = {
  target: "tauri",
  platform: undefined,
  release: false,
  origin: "https://app.example.com",
  deployables: ["web"],
  crate: "golden-1",
};
/**
 * The fake `npx`: `vite build` writes the shell entry's page; `tauri build` runs the test's `tauri.sh` in the build
 * folder; `cap`, as the Capacitor CLI, refuses a folder without a `package.json`, and `cap add` leaves a `gradlew`.
 */
const NPX = `#!/bin/sh
echo "$@" >> "$(dirname "$0")/calls.txt"
case "$2" in
  vite) echo "\${NODE_ENV-unset}" > vite-env.txt; mkdir -p dist/web/$KEEL_SHELL/www && echo '<html><head></head></html>' > dist/web/$KEEL_SHELL/www/index.html ;;
  tauri) echo "$@" > args.txt; exec sh "$(dirname "$0")/tauri.sh" ;;
  cap)
    test -f package.json || { echo "[error] The Capacitor CLI needs to run at the root of an npm package." >&2; exit 1; }
    if [ "$3" = add ]; then mkdir -p "$4" && printf '#!/bin/sh\\necho "$@" > task.txt\\n' > "$4/gradlew" && chmod +x "$4/gradlew"; fi ;;
  *) exit 64 ;;
esac
`;
/** A cargo failure as the Tauri CLI prints it: thousands of progress lines, then the error block. */
const FAILING = `i=0
while [ $i -lt 3000 ]; do echo "   Compiling crate-$i v1.0.$i" >&2; i=$((i+1)); done
cat >&2 <<END
error: proc macro panicked
 --> src/lib.rs:7:14
  |
7 |         .run(tauri::generate_context!())
  |              ^^^^^^^^^^^^^^^^^^^^^^^^^^
  |
  = help: message: failed to open icon $PWD/icons/missing.png: No such file or directory (os error 2)

error: could not compile \\\`golden-1\\\` (lib) due to 1 previous error
failed to build app: failed to build app
       Error failed to build app: failed to build app
END
exit 101
`;
const PASSING = "test -f icons/icon.png || exit 3\necho '# lock' > Cargo.lock\n";

const made: string[] = [];
/** A project with the generated Tauri files of `web`, the fake tools, and PATH pointing at them. */
function project(tauri: string, files: Record<string, string | Buffer> = {}): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-shell-build-")));
  made.push(root);
  const all: Record<string, string | Buffer> = {
    "bin/npx": NPX,
    "bin/tauri.sh": tauri,
    "deploy/web/tauri/tauri.conf.json": "{}\n",
    "deploy/web/tauri/capabilities/default.json": "{}\n",
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  chmodSync(join(root, "bin", "npx"), 0o755);
  vi.stubEnv("PATH", `${join(root, "bin")}:/usr/bin:/bin`);
  return root;
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("shellBuild", () => {
  test("an app without an icon builds with the default icon; Cargo.lock is copied back; the artifact is named", () => {
    const root = project(PASSING);
    const r = shellBuild(root, PLAN);
    expect(r).toEqual({ code: 0, notes: [], stderr: "", artifacts: ["dist/web/tauri/target/debug/golden-1"] });
    expect(readFileSync(join(root, "dist/web/tauri/icons/icon.png")).equals(defaultIcon())).toBe(true);
    expect(existsSync(join(root, "deploy/web/tauri/icons"))).toBe(false);
    expect(readFileSync(join(root, "deploy/web/tauri/Cargo.lock"), "utf8")).toBe("# lock\n");
    expect(readFileSync(join(root, "dist/web/tauri/args.txt"), "utf8")).toBe(
      "--no-install tauri build --debug --no-bundle\n",
    );
    expect(readFileSync(join(root, "dist/web/tauri/capabilities/http.json"), "utf8")).toContain(
      "https://app.example.com/*",
    );
  });

  test("the shell entry's Vite build runs with NODE_ENV=production whatever the shell sets", () => {
    const root = project(PASSING);
    vi.stubEnv("NODE_ENV", "development");
    expect(shellBuild(root, PLAN).code).toBe(0);
    expect(readFileSync(join(root, "vite-env.txt"), "utf8")).toBe("production\n");
  });

  test("the app's own icon is the one built with and is left as it is; a committed Cargo.lock is kept", () => {
    const own = Buffer.from("the app's icon");
    const root = project(PASSING, {
      "deploy/web/tauri/icons/icon.png": own,
      "deploy/web/tauri/Cargo.lock": "# mine\n",
    });
    expect(shellBuild(root, { ...PLAN, release: true })).toMatchObject({
      code: 0,
      artifacts: ["dist/web/tauri/target/release/golden-1"],
    });
    expect(readFileSync(join(root, "dist/web/tauri/icons/icon.png")).equals(own)).toBe(true);
    expect(readFileSync(join(root, "deploy/web/tauri/icons/icon.png")).equals(own)).toBe(true);
    expect(readFileSync(join(root, "deploy/web/tauri/Cargo.lock"), "utf8")).toBe("# mine\n");
    expect(readFileSync(join(root, "dist/web/tauri/args.txt"), "utf8")).toBe("--no-install tauri build --no-bundle\n");
  });

  test("an app that drops its icon builds with the default one again", () => {
    const root = project(PASSING, { "deploy/web/tauri/icons/icon.png": Buffer.from("the app's icon") });
    expect(shellBuild(root, PLAN).code).toBe(0);
    rmSync(join(root, "deploy/web/tauri/icons"), { recursive: true });
    expect(shellBuild(root, PLAN).code).toBe(0);
    expect(readFileSync(join(root, "dist/web/tauri/icons/icon.png")).equals(defaultIcon())).toBe(true);
  });

  test("a failing tool's error block is the stderr: the cause, paths relative, no progress lines", () => {
    const root = project(FAILING);
    const r = shellBuild(root, PLAN);
    expect(r.code).toBe(1);
    expect(r.artifacts).toEqual([]);
    expect(r.stderr.split("\n")).toEqual([
      "error: proc macro panicked",
      " --> src/lib.rs:7:14",
      "  |",
      "7 |         .run(tauri::generate_context!())",
      "  |              ^^^^^^^^^^^^^^^^^^^^^^^^^^",
      "  |",
      "  = help: message: failed to open icon dist/web/tauri/icons/missing.png: No such file or directory (os error 2)",
      "error: could not compile `golden-1` (lib) due to 1 previous error",
      "failed to build app: failed to build app",
      "       Error failed to build app: failed to build app",
      "",
    ]);
    expect(existsSync(join(root, "deploy/web/tauri/Cargo.lock"))).toBe(false);
  });

  test("a tool that fails without an error line shows its last lines; one that cannot start shows why", () => {
    const quiet = project("echo one; echo two >&2; exit 2\n");
    expect(shellBuild(quiet, PLAN)).toMatchObject({ code: 1, stderr: "one\ntwo\n" });
    const root = project(PASSING);
    rmSync(join(root, "bin", "npx"));
    const r = shellBuild(root, PLAN);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("npx ENOENT");
    expect(r.stderr).not.toContain("null");
  });

  test("cargo under CARGO_HOME or ~/.cargo, absent from PATH, is on the tools' PATH", () => {
    const cargo = "#!/bin/sh\necho '# lock' > Cargo.lock\n";
    const root = project("cargo\n", { ".cargo/bin/cargo": cargo, "elsewhere/bin/cargo": cargo });
    chmodSync(join(root, ".cargo/bin/cargo"), 0o755);
    chmodSync(join(root, "elsewhere/bin/cargo"), 0o755);
    vi.stubEnv("CARGO_HOME", undefined);
    vi.stubEnv("HOME", join(root, "nowhere"));
    expect(shellBuild(root, PLAN)).toMatchObject({ code: 1, stderr: expect.stringContaining("cargo") });
    vi.stubEnv("HOME", root);
    expect(shellBuild(root, PLAN).code).toBe(0);
    vi.stubEnv("HOME", join(root, "nowhere"));
    vi.stubEnv("CARGO_HOME", join(root, "elsewhere"));
    expect(shellBuild(root, PLAN).code).toBe(0);
  });

  test("a Capacitor build folder is an npm package with the app's dependencies and the policy in its page", () => {
    const pkg = '{ "name": "app", "dependencies": { "@capacitor/preferences": "8.0.1" } }\n';
    const root = project(PASSING, {
      "package.json": pkg,
      "deploy/web/capacitor/capacitor.config.json": "{}\n",
      "dist/web/csp.txt": "default-src 'none'; frame-ancestors 'none'",
    });
    const plan: ShellPlan = { ...PLAN, target: "capacitor", platform: "android" };
    expect(shellBuild(root, plan)).toEqual({
      code: 0,
      notes: [],
      stderr: "",
      artifacts: ["dist/web/capacitor/android/app/build/outputs/apk/debug/app-debug.apk"],
    });
    const at = join(root, "dist/web/capacitor");
    expect(readFileSync(join(at, "package.json"), "utf8")).toBe(pkg);
    expect(readFileSync(join(at, "android/task.txt"), "utf8")).toBe("assembleDebug\n");
    expect(readFileSync(join(at, "www/index.html"), "utf8")).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'">`,
    );
    expect(existsSync(join(at, "icons"))).toBe(false);
    // The platform folder exists: the next build syncs without adding it again.
    expect(shellBuild(root, { ...plan, release: true }).artifacts).toEqual([
      "dist/web/capacitor/android/app/build/outputs/apk/release/app-release-unsigned.apk",
    ]);
    expect(readFileSync(join(root, "bin/calls.txt"), "utf8").split("\n")).toEqual([
      "--no-install vite build",
      "--no-install cap add android",
      "--no-install cap sync android",
      "--no-install vite build",
      "--no-install cap sync android",
      "",
    ]);
  });

  test("an Android build with an http: origin allows cleartext to its host only; https: or release takes it out", () => {
    const manifest =
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application\n        android:allowBackup="true">\n    </application>\n</manifest>\n';
    const root = project(PASSING, {
      "package.json": '{ "name": "app" }\n',
      "deploy/web/capacitor/capacitor.config.json": "{}\n",
      "dist/web/capacitor/android/gradlew": '#!/bin/sh\necho "$@" > task.txt\n',
      "dist/web/capacitor/android/app/src/main/AndroidManifest.xml": manifest,
    });
    chmodSync(join(root, "dist/web/capacitor/android/gradlew"), 0o755);
    const main = join(root, "dist/web/capacitor/android/app/src/main");
    const config = join(main, "res/xml/keel_network_security.xml");
    const plan: ShellPlan = { ...PLAN, target: "capacitor", platform: "android", origin: "http://localhost:4182" };
    expect(shellBuild(root, plan).code).toBe(0);
    expect(readFileSync(join(main, "AndroidManifest.xml"), "utf8")).toContain(
      'android:networkSecurityConfig="@xml/keel_network_security"',
    );
    expect(readFileSync(config, "utf8")).toContain('<domain includeSubdomains="false">localhost</domain>');
    expect(readFileSync(join(root, "dist/web/capacitor/capacitor.config.json"), "utf8")).toBe("{}\n");
    expect(shellBuild(root, { ...plan, origin: "https://app.example.com" }).code).toBe(0);
    expect(readFileSync(join(main, "AndroidManifest.xml"), "utf8")).toBe(manifest);
    expect(existsSync(config)).toBe(false);
    expect(shellBuild(root, plan).code).toBe(0);
    expect(shellBuild(root, { ...plan, release: true }).code).toBe(0);
    expect(readFileSync(join(main, "AndroidManifest.xml"), "utf8")).toBe(manifest);
    expect(existsSync(config)).toBe(false);
  });

  test("a Vite build that writes no shell page is E1049 and runs no tool", () => {
    const root = project(PASSING, { "bin/npx": "#!/bin/sh\nexit 0\n" });
    const r = shellBuild(root, PLAN);
    expect(r.code).toBe(1);
    expect(r.notes).toEqual(["E1049 shell entry not built: the Vite plugin wrote no dist/web/tauri/www/index.html\n"]);
    expect(existsSync(join(root, "dist/web/tauri/icons"))).toBe(false);
  });
});
