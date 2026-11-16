// Spec: k.shell, Files "`icons/icon.png` there is the app's own, committed and not generated; without one the build uses Keel's mark."
// Spec: k.shell, Build "The shell entry and web build into `dist/<name>/<shell>/www/` (the Vite plugin, given `KEEL_SHELL`), beside the shell files, for Capacitor the app's `package.json` and, for Tauri, the http permission for `KEEL_ORIGIN`."
// Spec: k.shell, Build "A failing tool ends the build with its error lines, at most 12."
// Seed: 1337.
// Fake tools: `PATH` holds a `cargo`, a `rustc` and an `npx` written by the test. The fake `npx` hands `vite` to the real
// `npx` (the web build runs for real) and records the arguments and working directory of `tauri` and `cap`.
// Assumption: the Tauri tool is run as `npx ... tauri build ...` and the Capacitor tool as `npx ... cap ...` (the spec names the tools, not the runner).
// Assumption: the 12 lines of a failing tool are not required to start at the first error line; the test asserts the
// error line is present and that no more than 12 of the tool's lines appear.
// Assumption: the Capacitor toolchain check is satisfied by a fake `java` printing 21, `JAVA_HOME` and `ANDROID_HOME`; the spec does not say how they are found.
// UNTESTABLE: that the Tauri http permission names `KEEL_ORIGIN` exactly (the spec gives no file name or shape): asserted as "a file under `dist/web/tauri/capabilities/` mentions the origin".
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Rec, cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const ORIGIN = "https://app.example";

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [], routes: [] } })\n`;
const PKG = `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-tauri": "workspace:*", "@keel/std-capacitor": "workspace:*" }, devDependencies: { "@tauri-apps/cli": "2.0.0", "@capacitor/cli": "8.0.0" } })}\n`;
const files = (): Record<string, string> => ({
  "package.json": PKG,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.golden', name: 'Golden' }, capacitor: { id: 'dev.keel.golden', name: 'Golden' } } },\n})\n",
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nconst Page = () => null\nexport const routes = manifest({ 'c.page': { path: '/', component: Page } })\n",
});

/** Any small valid RGB PNG (8-bit, color type 2, 1x1), so it differs from Keel's RGBA mark. */
const OWN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let project = "";
let scratch = "";
let realNpx = "";
beforeAll(() => {
  project = materialize(files());
  for (const pkg of ["@tauri-apps/cli", "@capacitor/cli"]) {
    mkdirSync(join(project, "node_modules", pkg), { recursive: true });
    writeFileSync(join(project, "node_modules", pkg, "package.json"), `{ "name": "${pkg}", "version": "1.0.0" }\n`);
  }
  mkdirSync(join(project, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(project, "node_modules", ".bin", "vite"));
  for (const bin of ["tauri", "cap"]) exe(join(project, "node_modules", ".bin", bin), "exit 0\n");
  scratch = mkdtempSync(join(tmpdir(), "keel-tools-"));
  for (const d of (process.env.PATH ?? "").split(delimiter)) {
    if (d !== "" && existsSync(join(d, "npx"))) {
      realNpx = join(d, "npx");
      break;
    }
  }
}, SLOW);
afterAll(() => {
  cleanup(project);
  rmSync(scratch, { recursive: true, force: true });
});

function exe(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
}

/** The fake tool layer: `bin/` for `PATH`, `log/` for what the fake tools saw. Returns the env to build with. */
function tools(tauriBody: string): { env: Record<string, string>; log: string } {
  const root = mkdtempSync(join(scratch, "t-"));
  const bin = join(root, "bin");
  const log = join(root, "log");
  mkdirSync(log, { recursive: true });
  exe(join(bin, "cargo"), 'echo "cargo 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "rustc"), 'echo "rustc 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
  exe(join(bin, "pkg-config"), "exit 0\n");
  exe(join(root, "tauri.sh"), tauriBody);
  exe(
    join(bin, "npx"),
    `for a in "$@"; do
  case "$a" in
    vite) exec "${realNpx}" "$@" ;;
    tauri) echo "$@" >> "${log}/tauri.txt"; pwd >> "${log}/tauri-cwd.txt"; exec sh "${root}/tauri.sh" ;;
    cap) echo "$@" >> "${log}/cap.txt"; pwd >> "${log}/cap-cwd.txt"
         if [ "$3" = add ] || [ "$2" = add ]; then
           for last; do :; done
           mkdir -p "$last" && printf '#!/bin/sh\\nexit 0\\n' > "$last/gradlew" && chmod +x "$last/gradlew"
         fi
         exit 0 ;;
  esac
done
exec "${realNpx}" "$@"
`,
  );
  const sdk = join(root, "sdk");
  mkdirSync(join(sdk, "platform-tools"), { recursive: true });
  const jdk = join(root, "jdk");
  mkdirSync(join(jdk, "bin"), { recursive: true });
  exe(join(jdk, "bin", "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "PATH") continue;
    env[k] = v;
  }
  Object.assign(env, {
    PATH: [bin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    KEEL_ORIGIN: ORIGIN,
    JAVA_HOME: jdk,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
  });
  return { env, log };
}

function build(
  args: readonly string[],
  env: Record<string, string>,
): { status: number | null; out: string; records: Rec[] } {
  const r = spawnSync(process.execPath, [BIN, "build", ...args, "--format=json"], {
    cwd: project,
    encoding: "utf8",
    env,
    timeout: 240_000,
  });
  const records: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string")
        records.push({ ...v, kind: v.kind });
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, out: `${r.stdout}\n${r.stderr}`, records };
}

const tauriDir = (): string => join(project, "deploy", "web", "tauri");
const distTauri = (): string => join(project, "dist", "web", "tauri");
const reset = (): void => {
  rmSync(join(project, "dist"), { recursive: true, force: true });
  rmSync(join(tauriDir(), "icons"), { recursive: true, force: true });
};

describe("k.shell: build tools", () => {
  test(
    "`icons/icon.png` there is the app's own, committed and not generated; without one the build uses Keel's mark.",
    () => {
      // Without one: Keel's mark, an RGBA PNG, in the build folder only.
      reset();
      const none = tools("exit 0\n");
      const a = build(["--target", "tauri"], none.env);
      expect(a.status).toBe(0);
      const mark = readFileSync(join(distTauri(), "icons", "icon.png"));
      expect(mark.subarray(0, 8).equals(SIGNATURE)).toBe(true);
      expect(mark.subarray(12, 16).toString("latin1")).toBe("IHDR");
      expect(mark[25]).toBe(6);
      expect(existsSync(join(tauriDir(), "icons", "icon.png"))).toBe(false);

      // With the app's own: built with it, and left as it is.
      reset();
      mkdirSync(join(tauriDir(), "icons"), { recursive: true });
      writeFileSync(join(tauriDir(), "icons", "icon.png"), OWN_PNG);
      const own = tools("exit 0\n");
      const b = build(["--target", "tauri"], own.env);
      expect(b.status).toBe(0);
      expect(readFileSync(join(distTauri(), "icons", "icon.png")).equals(OWN_PNG)).toBe(true);
      expect(readFileSync(join(tauriDir(), "icons", "icon.png")).equals(OWN_PNG)).toBe(true);
      reset();
    },
    SLOW,
  );

  test(
    "The shell entry and web build into `dist/<name>/<shell>/www/`, beside the shell files, for Tauri the http permission for `KEEL_ORIGIN`.",
    () => {
      reset();
      const t = tools("exit 0\n");
      const r = build(["--target", "tauri"], t.env);
      expect(r.status).toBe(0);
      expect(existsSync(join(distTauri(), "www", "index.html"))).toBe(true);
      expect(existsSync(join(distTauri(), "tauri.conf.json"))).toBe(true);
      const caps = join(distTauri(), "capabilities");
      const mentioning = existsSync(caps)
        ? readdirSync(caps).filter((f) => readFileSync(join(caps, f), "utf8").includes(ORIGIN))
        : [];
      expect(mentioning.length).toBeGreaterThan(0);
      // The tool ran beside the shell files.
      expect(readFileSync(join(t.log, "tauri-cwd.txt"), "utf8").trim().endsWith("dist/web/tauri")).toBe(true);
      reset();
    },
    SLOW,
  );

  // The Capacitor case needs a toolchain check that a fake `java` 21, `JAVA_HOME` and an `ANDROID_HOME` with `platform-tools` satisfy.
  test(
    "The shell entry and web build into `dist/<name>/<shell>/www/`, beside the shell files, for Capacitor the app's `package.json`.",
    () => {
      reset();
      const t = tools("exit 0\n");
      const r = build(["--target", "capacitor", "--platform", "android"], t.env);
      expect(r.records.filter((x) => x.code === "E1575")).toEqual([]);
      expect(r.status).toBe(0);
      const copied = readFileSync(join(project, "dist", "web", "capacitor", "package.json"), "utf8");
      expect(copied).toBe(readFileSync(join(project, "package.json"), "utf8"));
      reset();
    },
    SLOW,
  );

  test(
    "A failing tool ends the build with its error lines, at most 12.",
    () => {
      reset();
      const lines = Array.from({ length: 30 }, (_, i) => (i === 4 ? "error: something broke" : `filler line ${i + 1}`));
      const t = tools(`cat <<'END' >&2\n${lines.join("\n")}\nEND\nexit 1\n`);
      const r = build(["--target", "tauri"], t.env);
      expect(r.status).toBe(1);
      expect(r.out).toContain("error: something broke");
      const shown = lines.filter((l) => new RegExp(`${l}(?!\\d)`).test(r.out));
      expect(shown.length).toBeLessThanOrEqual(12);
      reset();
    },
    SLOW,
  );
});
