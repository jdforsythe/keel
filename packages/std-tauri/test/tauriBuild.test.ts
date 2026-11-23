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
// The Tauri shell build (std.tauri Build) against fake tools: a temp build folder and a fake `npx` on PATH stand in for
// the Tauri CLI. Covers the default icon, the app's own icon, `Cargo.lock`, the http capability, a failing tool's output
// and Cargo's `bin` folder on PATH.
import type { ShellBuild } from "@keel/cli";
import { afterEach, describe, expect, test } from "vitest";
import { defaultIcon } from "../src/tools/defaultIcon.ts";
import { tauriBuild } from "../src/tools/tauriBuild.ts";

/** The fake `npx`: `tauri build` writes its arguments and runs the test's `tauri.sh` in the build folder. */
const NPX = `#!/bin/sh
echo "$@" > args.txt
exec sh "$(dirname "$0")/tauri.sh"
`;
const PASSING = "test -f icons/icon.png || exit 3\necho '# lock' > Cargo.lock\n";

const made: string[] = [];
/** A project with the generated Tauri files of `web` copied into its build folder, the fake tools, and the build's input. */
function project(
  tauri: string,
  files: Record<string, string | Buffer> = {},
  over: Partial<ShellBuild> = {},
): { root: string; at: ShellBuild } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-tauri-build-")));
  made.push(root);
  const all: Record<string, string | Buffer> = {
    "bin/npx": NPX,
    "bin/tauri.sh": tauri,
    "dist/web/tauri/tauri.conf.json": "{}\n",
    "dist/web/tauri/capabilities/default.json": "{}\n",
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  chmodSync(join(root, "bin", "npx"), 0o755);
  const at: ShellBuild = {
    deployable: "web",
    id: "dev.keel.golden",
    name: "Golden",
    version: "1.0.0",
    pkg: "golden-1",
    policy: undefined,
    identity: false,
    root,
    dir: join(root, "dist/web/tauri"),
    origin: "https://app.example.com",
    connect: [],
    platform: undefined,
    release: false,
    env: { PATH: `${join(root, "bin")}:/usr/bin:/bin`, HOME: join(root, "nowhere") },
    ...over,
  };
  return { root, at };
}

afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe.skipIf(process.platform === "win32")("tauriBuild", () => {
  test("an app without an icon builds with the default icon; Cargo.lock is copied back; the artifact is named", () => {
    const { root, at } = project(PASSING);
    expect(tauriBuild(at)).toEqual({ artifact: "dist/web/tauri/target/debug/golden-1" });
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

  test("the http capability allows KEEL_ORIGIN and each connect origin, and no other URL", () => {
    const { root, at } = project(PASSING, {}, { connect: ["https://peer.example", "https://api.example"] });
    tauriBuild(at);
    const http: unknown = JSON.parse(readFileSync(join(root, "dist/web/tauri/capabilities/http.json"), "utf8"));
    expect(Reflect.get(Object(http), "permissions")).toEqual([
      {
        identifier: "http:default",
        allow: [
          { url: "https://app.example.com/*" },
          { url: "https://peer.example/*" },
          { url: "https://api.example/*" },
        ],
      },
    ]);
  });

  test("the http capability allows the default browser to open KEEL_ORIGIN only with identity", () => {
    const text = (identity: boolean): string => {
      const { root, at } = project(PASSING, {}, { identity });
      tauriBuild(at);
      return readFileSync(join(root, "dist/web/tauri/capabilities/http.json"), "utf8");
    };
    expect(text(false)).not.toContain("opener:allow-open-url");
    expect(text(true)).toContain("opener:allow-open-url");
  });

  test("the app's own icon is the one built with; a committed Cargo.lock is kept; release drops --debug", () => {
    const own = Buffer.from("the app's icon");
    const { root, at } = project(
      PASSING,
      { "dist/web/tauri/icons/icon.png": own, "deploy/web/tauri/Cargo.lock": "# mine\n" },
      { release: true },
    );
    expect(tauriBuild(at)).toEqual({ artifact: "dist/web/tauri/target/release/golden-1" });
    expect(readFileSync(join(root, "dist/web/tauri/icons/icon.png")).equals(own)).toBe(true);
    expect(readFileSync(join(root, "deploy/web/tauri/Cargo.lock"), "utf8")).toBe("# mine\n");
    expect(readFileSync(join(root, "dist/web/tauri/args.txt"), "utf8")).toBe("--no-install tauri build --no-bundle\n");
  });

  test("the crate in the artifact is named from the package name", () => {
    const { at } = project(PASSING, {}, { pkg: "@acme/My_App" });
    expect(tauriBuild(at)).toEqual({ artifact: "dist/web/tauri/target/debug/my_app" });
  });

  test("a failing tool's whole output is the error", () => {
    const { at } = project("echo one; echo two >&2; exit 2\n");
    const r = tauriBuild(at);
    expect("error" in r && r.error).toMatch(/one\n+two/);
  });

  test("a tool that cannot start shows why", () => {
    const { root, at } = project(PASSING);
    rmSync(join(root, "bin", "npx"));
    const r = tauriBuild(at);
    expect("error" in r && r.error).toContain("npx ENOENT");
  });

  test("cargo under CARGO_HOME or ~/.cargo, absent from PATH, is on the tools' PATH", () => {
    const cargo = "#!/bin/sh\necho '# lock' > Cargo.lock\n";
    const files = { ".cargo/bin/cargo": cargo, "elsewhere/bin/cargo": cargo };
    const run = (env: (root: string) => Record<string, string>) => {
      const { root, at } = project("cargo\n", files);
      chmodSync(join(root, ".cargo/bin/cargo"), 0o755);
      chmodSync(join(root, "elsewhere/bin/cargo"), 0o755);
      return tauriBuild({ ...at, env: { ...at.env, ...env(root) } });
    };
    expect(run((root) => ({ HOME: join(root, "nowhere") }))).toMatchObject({ error: expect.stringContaining("cargo") });
    expect(run((root) => ({ HOME: root }))).toMatchObject({ artifact: expect.any(String) });
    expect(run((root) => ({ HOME: join(root, "nowhere"), CARGO_HOME: join(root, "elsewhere") }))).toMatchObject({
      artifact: expect.any(String),
    });
  });
});
