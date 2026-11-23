// Spec: std.capacitor, Conformance "`KEEL_ORIGIN=http://localhost:8080 keel build --target capacitor --platform android` leaves a network security config whose one cleartext domain is `localhost`, named in `AndroidManifest.xml`; a next build with `https://golden-1.example`, or with `--release`, leaves neither; `capacitor.config.json` is the generated one each time."
// Seed: 1337 (no generated input: the origins are the ones the clause names; the build writes files and binds no port, 8080 is only text).
// Fake tools: as in build-tools.test.ts, `PATH` holds a fake `npx` that hands `vite` to the real `npx` (the web build runs for real) and answers `cap`; `java`, `JAVA_HOME` and `ANDROID_HOME` satisfy the toolchain check.
// The fake `cap add android` makes the platform folder the way Capacitor does: a `gradlew` and `app/src/main/AndroidManifest.xml` with an `<application>`, and only when the folder is not there yet, so a later build meets the folder an earlier build left.
// Assumptions (the clause names no paths): the config and the manifest are found by name anywhere under the project (outside `node_modules`); a network security config is an `.xml` file under a `res/xml` folder whose root is `network-security-config`;
// "named in `AndroidManifest.xml`" is `android:networkSecurityConfig="@xml/<file name without .xml>"`; "cleartext domain" is a `<domain>` inside a `<domain-config>` that permits cleartext, and no `<base-config>` permits it.
// "The generated one" is held to: the `capacitor.config.json` files are the same after each build (the origin aside), and none turns on Capacitor's own cleartext switch (`server.cleartext`, or `usesCleartextTraffic` in the manifest).
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
import { delimiter, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { capacitorDeps } from "./plugin-deps.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const LOCAL = "http://localhost:8080";
const HTTPS = "https://golden-1.example";

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const PKG = `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: capacitorDeps(), devDependencies: { "@capacitor/cli": "8.0.0" } })}\n`;
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

const MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:allowBackup="true" android:icon="@mipmap/ic_launcher" android:label="@string/app_name" android:theme="@style/AppTheme">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
`;

let project = "";
let scratch = "";
let realNpx = "";
const env: Record<string, string> = {};

function exe(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
}

beforeAll(() => {
  project = materialize(files());
  mkdirSync(join(project, "node_modules", "@capacitor", "cli"), { recursive: true });
  writeFileSync(
    join(project, "node_modules", "@capacitor", "cli", "package.json"),
    '{ "name": "@capacitor/cli", "version": "1.0.0" }\n',
  );
  mkdirSync(join(project, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(project, "node_modules", ".bin", "vite"));
  exe(join(project, "node_modules", ".bin", "cap"), "exit 0\n");
  scratch = mkdtempSync(join(tmpdir(), "keel-cleartext-"));
  for (const d of (process.env.PATH ?? "").split(delimiter)) {
    if (d !== "" && existsSync(join(d, "npx"))) {
      realNpx = join(d, "npx");
      break;
    }
  }
  const bin = join(scratch, "bin");
  exe(join(bin, "cargo"), 'echo "cargo 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "rustc"), 'echo "rustc 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
  exe(
    join(bin, "npx"),
    `for a in "$@"; do
  case "$a" in
    vite) exec "${realNpx}" "$@" ;;
    cap) if [ "$3" = add ] || [ "$2" = add ]; then
           for last; do :; done
           if [ ! -d "$last" ]; then
             mkdir -p "$last/app/src/main" && printf '#!/bin/sh\\nexit 0\\n' > "$last/gradlew" && chmod +x "$last/gradlew"
             cat > "$last/app/src/main/AndroidManifest.xml" <<'XML'
${MANIFEST}XML
           fi
         fi
         exit 0 ;;
  esac
done
exec "${realNpx}" "$@"
`,
  );
  const sdk = join(scratch, "sdk");
  mkdirSync(join(sdk, "platform-tools"), { recursive: true });
  const jdk = join(scratch, "jdk");
  exe(join(jdk, "bin", "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "PATH") continue;
    env[k] = v;
  }
  Object.assign(env, {
    PATH: [bin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    JAVA_HOME: jdk,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
  });
}, SLOW);
afterAll(() => {
  cleanup(project);
  rmSync(scratch, { recursive: true, force: true });
});

function build(origin: string, extra: readonly string[]): number | null {
  const r = spawnSync(
    process.execPath,
    [BIN, "build", "--target", "capacitor", "--platform", "android", ...extra, "--format=json"],
    { cwd: project, encoding: "utf8", env: { ...env, KEEL_ORIGIN: origin }, timeout: 240_000 },
  );
  return r.status;
}

/** Every file under the project, outside `node_modules`, as a path relative to it. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(relative(project, full));
  }
  return out;
}
const named = (name: string): string[] => walk(project).filter((p) => p.split(sep).pop() === name);
const read = (path: string): string => readFileSync(join(project, path), "utf8");

/** The network security configs under a `res/xml` folder. */
const securityConfigs = (): string[] =>
  walk(project).filter(
    (p) => p.endsWith(".xml") && p.includes(`res${sep}xml${sep}`) && read(p).includes("<network-security-config"),
  );
const manifests = (): string[] => named("AndroidManifest.xml");
const configs = (): Record<string, string> =>
  Object.fromEntries(
    named("capacitor.config.json").map((p) => [p, read(p).replaceAll(LOCAL, "<origin>").replaceAll(HTTPS, "<origin>")]),
  );

function expectCleartextTo(host: string): void {
  const found = securityConfigs();
  expect(found).toHaveLength(1);
  const xml = read(found[0] ?? "");
  expect(xml).not.toMatch(/<base-config[^>]*cleartextTrafficPermitted\s*=\s*"true"/);
  const permitting = [
    ...xml.matchAll(/<domain-config\b[^>]*cleartextTrafficPermitted\s*=\s*"true"[^>]*>([\s\S]*?)<\/domain-config>/g),
  ];
  expect(permitting).toHaveLength(1);
  const domains = [...(permitting[0]?.[1] ?? "").matchAll(/<domain\b[^>]*>([^<]*)<\/domain>/g)].map((m) =>
    (m[1] ?? "").trim(),
  );
  expect(domains).toEqual([host]);
  const name =
    (found[0] ?? "")
      .split(sep)
      .pop()
      ?.replace(/\.xml$/, "") ?? "";
  const listed = manifests();
  expect(listed).toHaveLength(1);
  expect(read(listed[0] ?? "")).toContain(`android:networkSecurityConfig="@xml/${name}"`);
}

function expectNoCleartext(): void {
  expect(securityConfigs()).toEqual([]);
  const listed = manifests();
  expect(listed).toHaveLength(1);
  const manifest = read(listed[0] ?? "");
  expect(manifest).not.toContain("networkSecurityConfig");
  expect(manifest).not.toContain("usesCleartextTraffic");
}

let generated: Record<string, string> = {};
function expectGeneratedConfig(): void {
  const now = configs();
  expect(Object.keys(now).length).toBeGreaterThan(0);
  for (const text of Object.values(now)) {
    expect(JSON.parse(text)).not.toHaveProperty("server.cleartext", true);
  }
  if (Object.keys(generated).length > 0) expect(now).toEqual(generated);
  else generated = now;
}

describe("std.capacitor: a debug Android build with an http origin allows cleartext to that host only", () => {
  test(
    "`KEEL_ORIGIN=http://localhost:8080 keel build --target capacitor --platform android` leaves a network security config whose one cleartext domain is `localhost`, named in `AndroidManifest.xml`",
    () => {
      expect(build(LOCAL, [])).toBe(0);
      expectCleartextTo("localhost");
      expectGeneratedConfig();
    },
    SLOW,
  );

  test(
    "a next build with `https://golden-1.example` leaves neither a network security config nor its name in `AndroidManifest.xml`",
    () => {
      expect(build(HTTPS, [])).toBe(0);
      expectNoCleartext();
      expectGeneratedConfig();
    },
    SLOW,
  );

  test(
    "a next build with `--release` leaves neither a network security config nor its name in `AndroidManifest.xml`",
    () => {
      expect(build(LOCAL, [])).toBe(0);
      expectCleartextTo("localhost");
      expectGeneratedConfig();
      expect(build(LOCAL, ["--release"])).toBe(0);
      expectNoCleartext();
      expectGeneratedConfig();
    },
    SLOW,
  );
});
