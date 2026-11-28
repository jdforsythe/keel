// The disk half of `keel build --target`, generic over the shell target: a temp project and a fake `npx` on PATH stand in
// for Vite; a stub `ShellTarget` records what its `build` is given. Covers the Vite build's environment, the shell
// files copied beside `www/`, the artifacts, a failing tool's trimmed output and E1049.
import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, describe, expect, test, vi } from "vitest";
import { shellBuild } from "../src/shell/shellBuild.ts";
import type { ShellBuild } from "../src/types/ShellBuild.ts";
import type { ShellPlan } from "../src/types/ShellPlan.ts";
import type { ShellTarget } from "../src/types/ShellTarget.ts";

const app = (deployable: string) => ({
  deployable,
  id: `dev.keel.${deployable}`,
  name: deployable,
  version: "1.0.0",
  pkg: "golden-1",
  policy: undefined,
  identity: false,
});

/** The stub target: `build` appends what it was given to `calls`, then answers with `answer`. */
function stub(answer: (at: ShellBuild) => { artifact: string } | { error: string }) {
  const calls: ShellBuild[] = [];
  const target: ShellTarget = {
    platforms: [],
    files: () => ({}),
    tools: () => [],
    plugins: () => [],
    build: (at) => {
      calls.push(at);
      return answer(at);
    },
    ci: () => [],
  };
  return { calls, target };
}
const plan = (target: ShellTarget, apps: readonly string[] = ["web"]): ShellPlan => ({
  target: "tauri",
  shell: target,
  platform: undefined,
  release: false,
  origin: "https://app.example.com",
  apps: apps.map(app),
  connect: { web: ["https://api.example"] },
});

/** The fake `npx`: `vite build` records its environment and writes the shell entry's page for the deployable it names. */
const NPX = `#!/bin/sh
case "$2" in
  vite)
    echo "$KEEL_DEPLOYABLE $KEEL_SHELL $KEEL_ORIGIN \${NODE_ENV-unset}" >> vite-env.txt
    mkdir -p dist/$KEEL_DEPLOYABLE/$KEEL_SHELL/www && echo '<html><head></head></html>' > dist/$KEEL_DEPLOYABLE/$KEEL_SHELL/www/index.html ;;
  *) exit 64 ;;
esac
`;
/** A cargo failure as a tool prints it: thousands of progress lines, then the error block. */
const FAILING = `${Array.from({ length: 3000 }, (_, i) => `   Compiling crate-${i} v1.0.${i}`).join("\n")}
error: proc macro panicked
 --> src/lib.rs:7:14
  |
  = help: message: failed to open icon ROOT/icons/missing.png: No such file or directory (os error 2)

failed to build app: failed to build app
`;

const made: string[] = [];
/** A project with the fake `npx` and PATH pointing at it. */
function project(files: Record<string, string> = {}): string {
  const root = realpathSync(tempDir("keel-shell-build-"));
  made.push(root);
  for (const [rel, content] of Object.entries({ "bin/npx": NPX, ...files })) {
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
  test("per app: the Vite build, the shell files copied beside www/, then the target's build with the plan's fields", () => {
    const root = project({
      "deploy/web/tauri/tauri.conf.json": "{}\n",
      "deploy/web/tauri/src/main.rs": "fn main() {}\n",
    });
    const { calls, target } = stub((at) => ({ artifact: `dist/${at.deployable}/tauri/out` }));
    const r = shellBuild(root, { ...plan(target), platform: "x", release: true });
    expect(r).toEqual({ code: 0, notes: [], stderr: "", artifacts: ["dist/web/tauri/out"] });
    expect(readFileSync(join(root, "dist/web/tauri/tauri.conf.json"), "utf8")).toBe("{}\n");
    expect(readFileSync(join(root, "dist/web/tauri/src/main.rs"), "utf8")).toBe("fn main() {}\n");
    expect(existsSync(join(root, "dist/web/tauri/www/index.html"))).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      ...app("web"),
      root,
      dir: join(root, "dist/web/tauri"),
      origin: "https://app.example.com",
      connect: ["https://api.example"],
      platform: "x",
      release: true,
    });
    expect(calls[0]?.env).toMatchObject({ KEEL_ORIGIN: "https://app.example.com", KEEL_SHELL: "tauri" });
  });

  test("a plan with no origin gives the target no origin and no KEEL_ORIGIN, even one inherited empty", () => {
    const root = project();
    vi.stubEnv("KEEL_ORIGIN", "");
    const { calls, target } = stub(() => ({ artifact: "a" }));
    const { origin: _, ...none } = plan(target);
    expect(shellBuild(root, none).code).toBe(0);
    expect(Object.keys(calls[0] ?? {})).not.toContain("origin");
    expect(Object.keys(calls[0]?.env ?? {})).not.toContain("KEEL_ORIGIN");
    expect(readFileSync(join(root, "vite-env.txt"), "utf8")).toBe("web tauri  production\n");
  });

  test("a shell build of an app with no deploy folder builds with the Vite output alone", () => {
    const root = project();
    const { calls, target } = stub(() => ({ artifact: "a" }));
    expect(shellBuild(root, plan(target)).code).toBe(0);
    expect(existsSync(join(root, "deploy"))).toBe(false);
    expect(calls).toHaveLength(1);
  });

  test("each app builds in order and its artifact is kept in order", () => {
    const root = project();
    const { calls, target } = stub((at) => ({ artifact: `art-${at.deployable}` }));
    const r = shellBuild(root, plan(target, ["web", "desk"]));
    expect(r.artifacts).toEqual(["art-web", "art-desk"]);
    expect(calls.map((c) => c.deployable)).toEqual(["web", "desk"]);
    expect(calls.map((c) => c.connect)).toEqual([["https://api.example"], []]);
    expect(readFileSync(join(root, "vite-env.txt"), "utf8")).toBe(
      "web tauri https://app.example.com production\ndesk tauri https://app.example.com production\n",
    );
  });

  test("the shell entry's Vite build runs with NODE_ENV=production whatever the shell sets", () => {
    const root = project();
    vi.stubEnv("NODE_ENV", "development");
    const { calls, target } = stub(() => ({ artifact: "a" }));
    expect(shellBuild(root, plan(target)).code).toBe(0);
    expect(readFileSync(join(root, "vite-env.txt"), "utf8")).toBe("web tauri https://app.example.com production\n");
    expect(calls[0]?.env.NODE_ENV).toBe("development");
  });

  test("a failing target build's error is the stderr, trimmed: the cause, paths relative, no progress lines; later apps do not build", () => {
    const root = project();
    const { calls, target } = stub(() => ({ error: FAILING.replace("ROOT", root) }));
    const r = shellBuild(root, plan(target, ["web", "desk"]));
    expect(r.code).toBe(1);
    expect(r.artifacts).toEqual([]);
    expect(r.stderr.split("\n")).toEqual([
      "error: proc macro panicked",
      " --> src/lib.rs:7:14",
      "  |",
      "  = help: message: failed to open icon icons/missing.png: No such file or directory (os error 2)",
      "failed to build app: failed to build app",
      "",
    ]);
    expect(calls).toHaveLength(1);
  });

  test("an artifact from an app built before a failure is not reported", () => {
    const root = project();
    const { target } = stub((at) => (at.deployable === "web" ? { artifact: "a" } : { error: "boom\n" }));
    expect(shellBuild(root, plan(target, ["web", "desk"]))).toMatchObject({ code: 1, stderr: "boom\n" });
  });

  test("a Vite build that cannot start shows why and runs no target build", () => {
    const root = project();
    rmSync(join(root, "bin", "npx"));
    const { calls, target } = stub(() => ({ artifact: "a" }));
    const r = shellBuild(root, plan(target));
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("npx ENOENT");
    expect(r.stderr).not.toContain("null");
    expect(calls).toEqual([]);
  });

  test("a Vite build that writes no shell page is E1049 and runs no target build", () => {
    const root = project({ "bin/npx": "#!/bin/sh\nexit 0\n" });
    const { calls, target } = stub(() => ({ artifact: "a" }));
    const r = shellBuild(root, plan(target));
    expect(r.code).toBe(1);
    expect(r.notes).toEqual(["E1049 shell entry not built: the Vite plugin wrote no dist/web/tauri/www/index.html\n"]);
    expect(calls).toEqual([]);
  });
});
