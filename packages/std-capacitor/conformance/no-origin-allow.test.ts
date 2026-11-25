// Spec: std.capacitor, clause "With `web` alone (no `node` deployable), `keel build --target capacitor --platform android` with no `KEEL_ORIGIN`, after a build with an `api` deployable and `KEEL_ORIGIN=http://localhost:8080`, leaves `plugins.KeelHttp.allow` `[]` and no network security config; declaring `origins.connect` `https://api.example`, `[\"https://api.example\"]`."
// std.capacitor, Build "with no `origin` (k.shell Without a server), `connect` alone, `[]` when it is empty ... an `https:` origin, no `origin` or `--release` allows none and removes one an earlier build wrote."
// Seed: 1337 (the declared origins of the property are generated; the build writes files and binds no port, 8080 is only text).
// Fake tools and the fake `cap add android` as android-cleartext.test.ts. ASSUMPTIONS (the clause names no paths): `capacitor.config.json` is read at `dist/web/capacitor/`;
// a network security config is an `.xml` file under a `res/xml` folder whose root is `network-security-config`, "none" meaning no such file and no `networkSecurityConfig` attribute in `AndroidManifest.xml`; no `server.cleartext` in the config.
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
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { capacitorDeps } from "./plugin-deps.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const LOCAL = "http://localhost:8080";

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
const PKG = `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: capacitorDeps(), devDependencies: { "@capacitor/cli": "8.0.0" } })}\n`;
const topo = (server: boolean, origins?: string): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { capacitor: { id: 'dev.keel.golden', name: 'Golden' } }${origins === undefined ? "" : `, origins: ${origins}`} },\n${server ? "  api: { modules: [], adapter: 'node' },\n" : ""}})\n`;
const declared = (hosts: readonly string[]): string =>
  `{ connect: { ${hosts.map((h) => `'https://${h}.example': 'r'`).join(", ")} } }`;
const files = (): Record<string, string> => ({
  "package.json": PKG,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts": topo(true),
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

/** `origin` undefined leaves `KEEL_ORIGIN` unset. */
function build(origin: string | undefined, extra: readonly string[] = []): number | null {
  const r = spawnSync(
    process.execPath,
    [BIN, "build", "--target", "capacitor", "--platform", "android", ...extra, "--format=json"],
    {
      cwd: project,
      encoding: "utf8",
      env: origin === undefined ? env : { ...env, KEEL_ORIGIN: origin },
      timeout: 240_000,
    },
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

const allowList = (): unknown => {
  const config: unknown = JSON.parse(
    readFileSync(join(project, "dist", "web", "capacitor", "capacitor.config.json"), "utf8"),
  );
  const plugins: unknown = typeof config === "object" && config !== null ? Reflect.get(config, "plugins") : undefined;
  const http: unknown = typeof plugins === "object" && plugins !== null ? Reflect.get(plugins, "KeelHttp") : undefined;
  return typeof http === "object" && http !== null ? Reflect.get(http, "allow") : undefined;
};
function expectNoCleartext(): void {
  expect(securityConfigs()).toEqual([]);
  const listed = manifests();
  expect(listed).toHaveLength(1);
  expect(read(listed[0] ?? "")).not.toContain("networkSecurityConfig");
}
/** A build with `api` and an http origin (which writes a network security config), then `web` alone. */
function afterServerBuild(origins?: string): void {
  writeFileSync(join(project, "topology.ts"), topo(true));
  expect(build(LOCAL)).toBe(0);
  expect(allowList()).toEqual([LOCAL]);
  expect(securityConfigs()).toHaveLength(1);
  writeFileSync(join(project, "topology.ts"), topo(false, origins));
}

describe("std.capacitor: no origin", () => {
  test(
    "with `web` alone and no `KEEL_ORIGIN`, a build after one with `api` and `KEEL_ORIGIN=http://localhost:8080` leaves `plugins.KeelHttp.allow` `[]` and no network security config",
    () => {
      afterServerBuild();
      expect(build(undefined)).toBe(0);
      expect(allowList()).toEqual([]);
      expectNoCleartext();
      expect(JSON.parse(read(join("dist", "web", "capacitor", "capacitor.config.json")))).not.toHaveProperty(
        "server.cleartext",
        true,
      );
    },
    SLOW,
  );

  test(
    "with `web` alone and an empty `KEEL_ORIGIN`, the build leaves `plugins.KeelHttp.allow` `[]` and no network security config",
    () => {
      afterServerBuild();
      expect(build("")).toBe(0);
      expect(allowList()).toEqual([]);
      expectNoCleartext();
    },
    SLOW,
  );

  test(
    'with `web` alone declaring `origins.connect` `https://api.example`, `plugins.KeelHttp.allow` is `["https://api.example"]` and there is no network security config',
    () => {
      afterServerBuild(declared(["api"]));
      expect(build(undefined)).toBe(0);
      expect(allowList()).toEqual(["https://api.example"]);
      expectNoCleartext();
    },
    SLOW,
  );

  test(
    "with no `origin`, `plugins.KeelHttp.allow` is the declared `connect` origins alone, in order",
    () => {
      fc.assert(
        fc.property(fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), { minLength: 1, maxLength: 3 }), (hosts) => {
          afterServerBuild(declared(hosts));
          expect(build(undefined)).toBe(0);
          expect(allowList()).toEqual(hosts.map((h) => `https://${h}.example`));
          expectNoCleartext();
        }),
        { seed: 1337, numRuns: 2 },
      );
    },
    SLOW * 2,
  );
});
