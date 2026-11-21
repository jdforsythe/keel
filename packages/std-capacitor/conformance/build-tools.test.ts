// Spec: std.capacitor, Build "Into `dir`: the app's `package.json` (the Capacitor CLI reads the app's plugins from it); `www/index.html` carries the `client` policy in a `<meta http-equiv>`, without the directives a meta tag ignores."
// Spec: std.capacitor, Conformance "A build runs `cap sync android` in `dist/web/capacitor/` beside `www/` and the app's `package.json`, and `www/index.html` holds the policy in a `<meta http-equiv>`."
// Spec: std.capacitor, Conformance "`--target capacitor` with no `java` on `PATH` and no `JAVA_HOME` prints one E1575 naming `java` and JDK 21."
// Seed: 1337.
// Fake tools: `PATH` holds an `npx` written by the test. It hands `vite` to the real `npx` (the web build runs for real) and records the arguments and working directory of `cap`;
// `java`, `JAVA_HOME` and `ANDROID_HOME` (holding `platform-tools`) satisfy the tools check (std.capacitor Tools); the fake `cap add android` makes the platform folder.
// Assumption: the Capacitor tool is run as `npx ... cap ...` (the spec names the tool, not the runner).
// Assumption: "the directives a meta tag ignores" are `frame-ancestors`, `report-uri` and `sandbox` (the CSP spec's list); every other directive of `dist/web/csp.txt` is in the `<meta>`.
// UNTESTABLE: the iOS build (`xcodebuild`, Xcode 26): the spec does not say how Xcode is found.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const PKG = `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-capacitor": "workspace:*" }, devDependencies: { "@capacitor/cli": "8.0.0" } })}\n`;
const files = (): Record<string, string> => ({
  "package.json": PKG,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts":
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { capacitor: { id: 'dev.keel.golden', name: 'Golden' } } },\n})\n",
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/Page.tsx":
    "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>home</Text>\n    </Box>\n  )\n}\n",
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
});

let project = "";
let scratch = "";
let realNpx = "";
beforeAll(() => {
  project = materialize(files());
  for (const pkg of ["@capacitor/cli"]) {
    mkdirSync(join(project, "node_modules", pkg), { recursive: true });
    writeFileSync(join(project, "node_modules", pkg, "package.json"), `{ "name": "${pkg}", "version": "1.0.0" }\n`);
  }
  mkdirSync(join(project, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(project, "node_modules", ".bin", "vite"));
  for (const bin of ["cap"]) exe(join(project, "node_modules", ".bin", bin), "exit 0\n");
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
function tools(withJava = true): { env: Record<string, string>; log: string } {
  const root = mkdtempSync(join(scratch, "t-"));
  const bin = join(root, "bin");
  const log = join(root, "log");
  mkdirSync(log, { recursive: true });
  mkdirSync(bin, { recursive: true });
  symlinkSync(process.execPath, join(bin, "node"));
  if (withJava) exe(join(bin, "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
  exe(
    join(bin, "npx"),
    `for a in "$@"; do
  case "$a" in
    vite) exec "${realNpx}" "$@" ;;
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
  if (withJava) exe(join(jdk, "bin", "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "PATH") continue;
    if (k === "JAVA_HOME" && !withJava) continue;
    env[k] = v;
  }
  Object.assign(env, {
    // With a JDK: the stand-ins, Node's directory and the system directories.
    // Without one: `bin` alone (holding a link to this Node and the stand-ins), so no system directory can supply a `java`.
    PATH: withJava ? [bin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter) : bin,
    KEEL_ORIGIN: ORIGIN,
    ...(withJava ? { JAVA_HOME: jdk } : {}),
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

const reset = (): void => {
  rmSync(join(project, "dist"), { recursive: true, force: true });
};

const directives = (policy: string): string[] =>
  policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "");
const IGNORED_BY_META = ["frame-ancestors", "report-uri", "sandbox"];

describe("std.capacitor: build", () => {
  test(
    "A build runs `cap sync android` in `dist/web/capacitor/` beside `www/` and the app's `package.json`.",
    () => {
      reset();
      const t = tools();
      const r = build(["--target", "capacitor", "--platform", "android"], t.env);
      expect(r.records.filter((x) => x.code === "E1575")).toEqual([]);
      expect(r.status).toBe(0);
      expect(existsSync(join(project, "dist", "web", "capacitor", "www", "index.html"))).toBe(true);
      expect(readFileSync(join(t.log, "cap.txt"), "utf8")).toContain("sync android");
      const cwds = readFileSync(join(t.log, "cap-cwd.txt"), "utf8").trim().split("\n");
      expect(cwds.every((c) => c.endsWith("dist/web/capacitor"))).toBe(true);
      const copied = readFileSync(join(project, "dist", "web", "capacitor", "package.json"), "utf8");
      expect(copied).toBe(readFileSync(join(project, "package.json"), "utf8"));
      reset();
    },
    SLOW,
  );

  test(
    "`www/index.html` holds the policy in a `<meta http-equiv>`.",
    () => {
      reset();
      const r = build(["--target", "capacitor", "--platform", "android"], tools().env);
      expect(r.status).toBe(0);
      const html = readFileSync(join(project, "dist", "web", "capacitor", "www", "index.html"), "utf8");
      const meta = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i)?.[0] ?? "";
      expect(meta).not.toBe("");
      const policy = directives(readFileSync(join(project, "dist", "web", "csp.txt"), "utf8"));
      for (const d of policy) {
        const name = d.split(/\s+/)[0] ?? "";
        if (IGNORED_BY_META.includes(name)) expect(meta).not.toContain(name);
        else expect(meta).toContain(d);
      }
      reset();
    },
    SLOW,
  );

  test(
    "`--target capacitor` with no `java` on `PATH` and no `JAVA_HOME` prints one E1575 naming `java` and JDK 21.",
    () => {
      reset();
      const r = build(["--target", "capacitor", "--platform", "android"], tools(false).env);
      const named = r.records.filter(
        (x) => x.kind === "diag" && x.code === "E1575" && String(x.message).includes("java"),
      );
      expect(named).toHaveLength(1);
      expect(String(named[0]?.message)).toContain("21");
      expect(r.status).toBe(1);
      expect(existsSync(join(project, "dist", "web", "capacitor"))).toBe(false);
      reset();
    },
    SLOW,
  );
});
