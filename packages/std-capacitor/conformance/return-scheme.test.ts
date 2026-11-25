// Spec: std.capacitor, Conformance "The Capacitor shell files register `id` as a scheme: an Android intent filter, iOS `CFBundleURLTypes`."
// Seed: 1337 (the reverse-DNS `id` is generated). This file is the Android part (the `AndroidManifest.xml` a Capacitor build leaves).
// UNTESTABLE blind: iOS `CFBundleURLTypes` (the `Info.plist` belongs to the platform project, and the spec does not say how the build finds Xcode 26, so no fake toolchain can be written from the spec).
// Fake tools: as in android-cleartext.test.ts (a fake `npx` answering `cap`, `java`, `ANDROID_HOME`); the fake `cap add android` writes a manifest with a launcher activity and no scheme.
// ASSUMPTION: "an Android intent filter" is an `<intent-filter>` of the manifest holding the action `android.intent.action.VIEW`, the categories `android.intent.category.DEFAULT` and `android.intent.category.BROWSABLE`, and a `<data android:scheme="<id>"/>`.
import { testTime } from "@keel/tooling/test-time";
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
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { capacitorDeps } from "./plugin-deps.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const ORIGIN = "https://golden-1.example";
const SEED = 1337;

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const PKG = `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: capacitorDeps(), devDependencies: { "@capacitor/cli": "8.0.0" } })}\n`;
const files = (id: string): Record<string, string> => ({
  "package.json": PKG,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts": `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { capacitor: { id: '${id}', name: 'Golden' } } },\n  api: { modules: [], adapter: 'node' },\n})\n`,
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

function exe(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
}

function setup(id: string): { project: string; scratch: string; env: Record<string, string> } {
  const env: Record<string, string> = {};
  const project = materialize(files(id));
  let realNpx = "";
  mkdirSync(join(project, "node_modules", "@capacitor", "cli"), { recursive: true });
  writeFileSync(
    join(project, "node_modules", "@capacitor", "cli", "package.json"),
    '{ "name": "@capacitor/cli", "version": "1.0.0" }\n',
  );
  mkdirSync(join(project, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(project, "node_modules", ".bin", "vite"));
  exe(join(project, "node_modules", ".bin", "cap"), "exit 0\n");
  const scratch = mkdtempSync(join(tmpdir(), "keel-cleartext-"));
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
  return { project, scratch, env };
}

function build(project: string, env: Record<string, string>): number | null {
  const r = spawnSync(
    process.execPath,
    [BIN, "build", "--target", "capacitor", "--platform", "android", "--format=json"],
    { cwd: project, encoding: "utf8", env: { ...env, KEEL_ORIGIN: ORIGIN }, timeout: testTime(240_000) },
  );
  return r.status;
}

/** Every file under `dir`, outside `node_modules`, as a path relative to it. */
function walk(root: string, dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(root, full, out);
    else out.push(relative(root, full));
  }
  return out;
}

const label = fc.stringMatching(/^[a-z][a-z0-9]{2,8}$/);
const identifier = fc.tuple(label, label, label).map(([a, b, c]) => `${a}.${b}.${c}`);

describe("std.capacitor: the shell files register id as a scheme (Android)", () => {
  test(
    "the Android manifest a Capacitor build leaves has an intent filter for the declared `id` as a scheme: VIEW, DEFAULT, BROWSABLE",
    () => {
      fc.assert(
        fc.property(identifier, (id) => {
          const made = setup(id);
          try {
            expect(build(made.project, made.env)).toBe(0);
            const found = walk(made.project, made.project).filter((p) => p.split(sep).pop() === "AndroidManifest.xml");
            expect(found).toHaveLength(1);
            const xml = readFileSync(join(made.project, found[0] ?? ""), "utf8");
            const filters = [...xml.matchAll(/<intent-filter\b[\s\S]*?<\/intent-filter>/g)].map((m) => m[0]);
            const mine = filters.filter((f) => f.includes(`android:scheme="${id}"`));
            expect(mine).toHaveLength(1);
            expect(mine[0]).toContain("android.intent.action.VIEW");
            expect(mine[0]).toContain("android.intent.category.DEFAULT");
            expect(mine[0]).toContain("android.intent.category.BROWSABLE");
          } finally {
            cleanup(made.project);
            rmSync(made.scratch, { recursive: true, force: true });
          }
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW,
  );
});
