// Spec: std.capacitor, Conformance "A build with `KEEL_ORIGIN=https://golden-1.example` of a deployable declaring `origins.connect` `https://api.example` leaves `dist/web/capacitor/capacitor.config.json` with `plugins.KeelHttp.allow` `[\"https://golden-1.example\", \"https://api.example\"]`; with no `origins`, the first alone. The file under `deploy/` has no `plugins`."
// Spec: std.capacitor, Conformance "The target's `plugins` for an app with `identity` false: `@capacitor/preferences` and `@capacitor/app`, each at the version `@keel/std-capacitor`'s `package.json` `dependencies` hold, and no other; with `identity` true, `@capacitor/browser` too."
// Spec: std.capacitor, Conformance "`keel check` of a project declaring `capacitor`, with no `identity.ts`, whose `dependencies` hold `@keel/std-capacitor` and those two at those versions: no E1572. Adding `identity.ts` (and its source, a `node` deployable serving it): one E1572 naming `@capacitor/browser` and `(the external browser of identity.ts)`. Removing `@capacitor/app` instead: one naming it."
// Seed: 1337 (the declared origins of the allow property are generated; the projects are otherwise fixed).
// The real binary over a temp project. The target's `plugins` is read through `keel check`: with `@keel/std-capacitor` alone in `dependencies` the E1572 diagnostics are the plugins the target gives, one each,
// so "and no other" is the count; the message form is k.shell Plugins, the `need` texts are the ones of std.capacitor's table.
// Fake tools for the build: as build-tools.test.ts (`npx` hands `vite` to the real `npx`, answers `cap`; `java`, `JAVA_HOME`, `ANDROID_HOME`).
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
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, diags, keel, materialize, readText } from "./compat-support.ts";

const SLOW = 300_000;
const SEED = 1337;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const SELF = "https://golden-1.example";

/** `dependencies` of `@keel/std-capacitor`'s own `package.json`. */
const pinned = (name: string): string => {
  const pkg: unknown = JSON.parse(readFileSync(join(REPO, "packages", "std-capacitor", "package.json"), "utf8"));
  const deps: unknown = typeof pkg === "object" && pkg !== null ? Reflect.get(pkg, "dependencies") : undefined;
  const v: unknown = typeof deps === "object" && deps !== null ? Reflect.get(deps, name) : undefined;
  if (typeof v !== "string") throw new Error(`@keel/std-capacitor does not pin ${name}`);
  return v;
};
const NEEDS: Record<string, string> = {
  "@capacitor/preferences": "storage",
  "@capacitor/app": "launch and return links",
  "@capacitor/browser": "the external browser of identity.ts",
};

const manifestSrc = (id: string): string =>
  `import { module } from '@keel/compiler'\nexport default module({ id: '${id}', deps: [], capabilities: [], public: { exports: [] } })\n`;
type Opts = { identity?: boolean; origins?: string; deps?: Record<string, string> };
const topo = (o: Opts): string =>
  `import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client'${o.identity ? ", servedBy: 'api'" : ""}, shells: { capacitor: { id: 'dev.keel.golden', name: 'Golden' } }${o.origins ? `, origins: ${o.origins}` : ""} },\n${o.identity ? "  api: { modules: [], adapter: 'node' },\n" : ""}})\n`;
const IDENTITY: Record<string, string> = {
  "identity.ts": "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n",
  "identity.server.ts":
    "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n",
};
const files = (o: Opts): Record<string, string> => ({
  "package.json": `${JSON.stringify({ name: "fx", private: true, type: "module", version: "1.0.0", dependencies: { "@keel/std-capacitor": "workspace:*", ...o.deps }, devDependencies: { "@capacitor/cli": "8.0.0" } })}\n`,
  "vite.config.ts":
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  "tsconfig.json": JSON.stringify({
    compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
  }),
  "topology.ts": topo(o),
  "modules/c/module.ts": manifestSrc("c"),
  "modules/c/Page.tsx":
    "import { Box, Text } from '@keel/ui'\nexport default function Page() {\n  return (\n    <Box as=\"main\">\n      <Text>home</Text>\n    </Box>\n  )\n}\n",
  "modules/c/routes.ts":
    "import { manifest } from '@keel/router'\nimport { c } from './c.contract.ts'\nimport Page from './Page.tsx'\nexport const routes = manifest(c, { 'c.page': { component: Page } })\n",
  "modules/c/c.contract.ts":
    "import { contract } from '@keel/router/contract'\nexport const c = contract('c', { 'c.page': { path: '/' } })\n",
  ...(o.identity ? IDENTITY : {}),
});
const declared = (hosts: readonly string[]): string =>
  `{ connect: { ${hosts.map((h) => `'https://${h}.example': 'r'`).join(", ")} } }`;

const dirs: string[] = [];
const made = (o: Opts): string => {
  const dir = materialize(files(o));
  dirs.push(dir);
  return dir;
};
const exe = (path: string, body: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
};
let scratch = "";
const env: Record<string, string> = {};
beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "keel-allow-"));
  let realNpx = "";
  for (const d of (process.env.PATH ?? "").split(delimiter)) {
    if (d !== "" && existsSync(join(d, "npx"))) {
      realNpx = join(d, "npx");
      break;
    }
  }
  const bin = join(scratch, "bin");
  exe(
    join(bin, "npx"),
    `for a in "$@"; do
  case "$a" in
    vite) exec "${realNpx}" "$@" ;;
    cap) if [ "$3" = add ] || [ "$2" = add ]; then
           for last; do :; done
           mkdir -p "$last" && printf '#!/bin/sh\\nexit 0\\n' > "$last/gradlew" && chmod +x "$last/gradlew"
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
  exe(join(bin, "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
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
  for (const d of dirs) cleanup(d);
  rmSync(scratch, { recursive: true, force: true });
});

function buildAndroid(dir: string): number | null {
  const cli = join(dir, "node_modules", "@capacitor", "cli");
  mkdirSync(cli, { recursive: true });
  writeFileSync(join(cli, "package.json"), '{ "name": "@capacitor/cli", "version": "1.0.0" }\n');
  mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
  if (!existsSync(join(dir, "node_modules", ".bin", "vite")))
    symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(dir, "node_modules", ".bin", "vite"));
  exe(join(dir, "node_modules", ".bin", "cap"), "exit 0\n");
  const r = spawnSync(
    process.execPath,
    [BIN, "build", "--target", "capacitor", "--platform", "android", "--format=json"],
    {
      cwd: dir,
      encoding: "utf8",
      env: { ...env, KEEL_ORIGIN: SELF },
      timeout: 240_000,
    },
  );
  return r.status;
}
const allowOf = (dir: string): unknown => {
  const config: unknown = JSON.parse(readText(dir, "dist/web/capacitor/capacitor.config.json"));
  const plugins: unknown = typeof config === "object" && config !== null ? Reflect.get(config, "plugins") : undefined;
  const http: unknown = typeof plugins === "object" && plugins !== null ? Reflect.get(plugins, "KeelHttp") : undefined;
  return typeof http === "object" && http !== null ? Reflect.get(http, "allow") : undefined;
};

const e1572 = (dir: string): string[] => diags(keel(dir, ["check"]), "E1572").map((d) => String(d.message));
const line = (plugin: string): string =>
  `web: capacitor needs ${plugin} ${pinned(plugin)} in package.json dependencies (${NEEDS[plugin]})`;
const listed = (...plugins: string[]): Record<string, string> => Object.fromEntries(plugins.map((p) => [p, pinned(p)]));

describe("std.capacitor: KeelHttp allow list and plugins", () => {
  test(
    'a build with `KEEL_ORIGIN=https://golden-1.example` of a deployable declaring `origins.connect` `https://api.example` leaves `plugins.KeelHttp.allow` `["https://golden-1.example", "https://api.example"]`; the file under `deploy/` has no `plugins`',
    () => {
      const dir = made({ origins: declared(["api"]), deps: listed(...Object.keys(NEEDS)) });
      expect(buildAndroid(dir)).toBe(0);
      expect(allowOf(dir)).toEqual([SELF, "https://api.example"]);
      const generated: unknown = JSON.parse(readText(dir, "deploy/web/capacitor/capacitor.config.json"));
      expect(typeof generated === "object" && generated !== null && "plugins" in generated).toBe(false);
    },
    SLOW,
  );

  test(
    "with no `origins`, `plugins.KeelHttp.allow` is the first alone; with declared origins it is `KEEL_ORIGIN` then each declared one",
    () => {
      fc.assert(
        fc.property(fc.uniqueArray(fc.constantFrom("a", "b", "c", "d"), { maxLength: 3 }), (hosts) => {
          const dir = made({
            origins: hosts.length === 0 ? undefined : declared(hosts),
            deps: listed(...Object.keys(NEEDS)),
          });
          expect(buildAndroid(dir)).toBe(0);
          expect(allowOf(dir)).toEqual([SELF, ...hosts.map((h) => `https://${h}.example`)]);
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW * 2,
  );

  test(
    "the target's `plugins` for an app with `identity` false: `@capacitor/preferences` and `@capacitor/app` at the versions `@keel/std-capacitor` pins, and no other",
    () => {
      const dir = made({});
      expect(e1572(dir).sort()).toEqual([line("@capacitor/app"), line("@capacitor/preferences")].sort());
    },
    SLOW,
  );

  test(
    "with `identity` true, `@capacitor/browser` too",
    () => {
      const dir = made({ identity: true });
      expect(e1572(dir).sort()).toEqual(
        [line("@capacitor/app"), line("@capacitor/browser"), line("@capacitor/preferences")].sort(),
      );
    },
    SLOW,
  );

  test(
    "`keel check` with no `identity.ts`, whose `dependencies` hold `@keel/std-capacitor` and those two at those versions, reports no E1572",
    () => {
      const dir = made({ deps: listed("@capacitor/preferences", "@capacitor/app") });
      expect(e1572(dir)).toEqual([]);
    },
    SLOW,
  );

  test(
    "adding `identity.ts` and its source is one E1572 naming `@capacitor/browser` and `(the external browser of identity.ts)`",
    () => {
      const dir = made({ identity: true, deps: listed("@capacitor/preferences", "@capacitor/app") });
      expect(e1572(dir)).toEqual([line("@capacitor/browser")]);
    },
    SLOW,
  );

  test(
    "removing `@capacitor/app` instead is one E1572 naming it",
    () => {
      const dir = made({ deps: listed("@capacitor/preferences") });
      const found = e1572(dir);
      expect(found).toEqual([line("@capacitor/app")]);
    },
    SLOW,
  );
});
