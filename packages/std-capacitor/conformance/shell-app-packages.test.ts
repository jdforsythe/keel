// Spec: std.capacitor, clause "`keel scaffold shell capacitor` writes `@capacitor/core` and the `plugins` for the app at the versions `@keel/std-capacitor`'s `package.json` `dependencies` hold, and `@capacitor/cli`, `@capacitor/android` and `@capacitor/ios` at those its `peerDependencies` hold, each exact; with `identity.ts`, `@capacitor/browser` too. After the install and `keel build`, `keel check` reports no diagnostic and `keel build --target capacitor --platform android` with every native tool present prints no E1572, E1574 or E1575."
// std.capacitor, App packages "in `dependencies`, `@capacitor/core` ... and the `plugins`; in `devDependencies`, `@capacitor/cli`, `@capacitor/android` and `@capacitor/ios`, each at the exact version this package's `package.json` `peerDependencies` hold, marked optional in `peerDependenciesMeta`."
// Seed: 1337 (no generated input: fixed projects).
// Fake tools (as build-tools.test.ts): `npx` hands `vite` to the real `npx` and answers `cap`; `java`, `JAVA_HOME` and `ANDROID_HOME` (holding `platform-tools`) stand in for the toolchain.
// The install is simulated: `node_modules/<package>` and `.bin/cap` are written from the versions the scaffold wrote. No real native toolchain runs.
// The identity case covers the written versions and `keel check` reporting no E1572; the clean check and the build of an identity project are UNTESTABLE here: the spec gives no source for `identity.ts` beyond a `node` deployable serving it.
// ASSUMED: `scaffold("shell", ...)` takes `{ shell, id }` over a file map and `scaffold("project", { name, workspace: true })` writes `package.json` and `topology.ts` at the map's root.
import { testTime } from "@keel/tooling/test-time";
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
import { scaffold } from "@keel/scaffold";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Rec, cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

type Files = Map<string, string>;
type Result = { ok: true; value: { files: Files } } | { ok: false; error: unknown };
/** `Op` does not name `shell` until it is built, so the call goes through `Reflect.apply`. */
const run = (op: string, input: Record<string, unknown>, files: Files): Result =>
  Reflect.apply(scaffold, undefined, [op, input, files]);

const IDENTITY = {
  "identity.ts": "import { identityMount } from '@keel/router'\nexport default identityMount('/api/auth')\n",
  "identity.server.ts":
    "import { identity } from '@keel/server'\nimport mount from './identity.ts'\nexport default identity({ identify: async () => '', handle: { path: mount.path, fn: () => new Response('') } })\n",
};
const IDENTITY_TOPOLOGY = [
  `import { topology } from "@keel/server";`,
  "",
  "export default topology({",
  `  web: { modules: ["app"], adapter: "client", servedBy: "api", styles: ["@keel/ui/fonts"] },`,
  `  api: { modules: [], adapter: "node" },`,
  "});",
  "",
].join("\n");

function app(identity: boolean): Files {
  const project = run("project", { name: "fx", workspace: true }, new Map());
  if (!project.ok) throw new Error(JSON.stringify(project.error));
  let files = project.value.files;
  if (identity) {
    files = new Map(files).set("topology.ts", IDENTITY_TOPOLOGY);
    for (const [path, text] of Object.entries(IDENTITY)) files.set(path, text);
  }
  const out = run("shell", { shell: "capacitor", id: "dev.keel.golden" }, files);
  if (!out.ok) throw new Error(`scaffold shell capacitor failed: ${JSON.stringify(out.error)}`);
  return out.value.files;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};
}
const stdPackage = (): Record<string, unknown> =>
  obj(JSON.parse(readFileSync(join(REPO, "packages", "std-capacitor", "package.json"), "utf8")));
const written = (files: Files, field: string): Record<string, unknown> =>
  obj(obj(JSON.parse(files.get("package.json") ?? "null"))[field]);
const EXACT = /^\d+\.\d+\.\d+$/;

let plain: Files = new Map();
let withIdentity: Files = new Map();
let project = "";
let scratch = "";
let realNpx = "";
beforeAll(() => {
  plain = app(false);
  withIdentity = app(true);
  project = materialize(Object.fromEntries(plain));
  const listed = { ...written(plain, "dependencies"), ...written(plain, "devDependencies") };
  for (const [name, version] of Object.entries(listed)) {
    if (!name.startsWith("@capacitor/")) continue;
    mkdirSync(join(project, "node_modules", name), { recursive: true });
    writeFileSync(
      join(project, "node_modules", name, "package.json"),
      `${JSON.stringify({ name, version: String(version) })}\n`,
    );
  }
  mkdirSync(join(project, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(project, "node_modules", ".bin", "vite"));
  exe(join(project, "node_modules", ".bin", "cap"), "exit 0\n");
  scratch = mkdtempSync(join(tmpdir(), "keel-shell-app-"));
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

/** The environment with every Android tool present, as fakes. */
function toolsEnv(): Record<string, string> {
  const root = mkdtempSync(join(scratch, "t-"));
  const bin = join(root, "bin");
  mkdirSync(bin, { recursive: true });
  symlinkSync(process.execPath, join(bin, "node"));
  exe(join(bin, "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
  exe(
    join(bin, "npx"),
    `for a in "$@"; do
  case "$a" in
    vite) exec "${realNpx}" "$@" ;;
    cap)  if [ "$3" = add ] || [ "$2" = add ]; then
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
  exe(join(jdk, "bin", "java"), "echo 'openjdk version \"21.0.1\" 2030-01-01' >&2\n");
  const env: Record<string, string> = {};
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
  return env;
}

function keel(
  dir: string,
  args: readonly string[],
  env: Record<string, string>,
): { status: number | null; records: Rec[] } {
  const r = spawnSync(process.execPath, [BIN, ...args, "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
    timeout: testTime(240_000),
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
  return { status: r.status, records };
}
const diags = (rs: Rec[]): Rec[] => rs.filter((r) => r.kind === "diag");

describe("std.capacitor: the packages `keel scaffold shell capacitor` writes", () => {
  test("`@capacitor/core` and the plugins are written at the versions of `@keel/std-capacitor`'s `dependencies`, each exact", () => {
    const pinned = obj(stdPackage().dependencies);
    const deps = written(plain, "dependencies");
    for (const name of ["@capacitor/core", "@capacitor/preferences", "@capacitor/app"]) {
      expect(typeof pinned[name], name).toBe("string");
      expect(String(pinned[name]), name).toMatch(EXACT);
      expect(deps[name], name).toBe(pinned[name]);
    }
    expect(deps["@capacitor/browser"]).toBeUndefined();
  });

  test("`@capacitor/cli`, `@capacitor/android` and `@capacitor/ios` are written at the versions of its `peerDependencies`, each exact, and marked optional", () => {
    const peers = obj(stdPackage().peerDependencies);
    const meta = obj(stdPackage().peerDependenciesMeta);
    const dev = written(plain, "devDependencies");
    for (const name of ["@capacitor/cli", "@capacitor/android", "@capacitor/ios"]) {
      expect(typeof peers[name], name).toBe("string");
      expect(String(peers[name]), name).toMatch(EXACT);
      expect(dev[name], name).toBe(peers[name]);
      expect(obj(meta[name]).optional, name).toBe(true);
      expect(written(plain, "dependencies")[name], name).toBeUndefined();
    }
  });

  test("with `identity.ts`, `@capacitor/browser` is written too, at the version of `dependencies`", () => {
    const pinned = obj(stdPackage().dependencies)["@capacitor/browser"];
    expect(typeof pinned).toBe("string");
    expect(String(pinned)).toMatch(EXACT);
    expect(written(withIdentity, "dependencies")["@capacitor/browser"]).toBe(pinned);
    for (const name of ["@capacitor/core", "@capacitor/preferences", "@capacitor/app"]) {
      expect(written(withIdentity, "dependencies")[name], name).toBe(obj(stdPackage().dependencies)[name]);
    }
  });

  test(
    "with `identity.ts`, after the install `keel check` reports no E1572",
    () => {
      const dir = materialize(Object.fromEntries(withIdentity));
      try {
        const listed = { ...written(withIdentity, "dependencies"), ...written(withIdentity, "devDependencies") };
        for (const [name, version] of Object.entries(listed)) {
          if (!name.startsWith("@capacitor/")) continue;
          mkdirSync(join(dir, "node_modules", name), { recursive: true });
          writeFileSync(
            join(dir, "node_modules", name, "package.json"),
            `${JSON.stringify({ name, version: String(version) })}\n`,
          );
        }
        const check = keel(dir, ["check"], toolsEnv());
        expect(diags(check.records).filter((r) => r.code === "E1572")).toEqual([]);
      } finally {
        cleanup(dir);
      }
    },
    SLOW,
  );

  test(
    "after the install and `keel build`, `keel check` reports no diagnostic and `keel build --target capacitor --platform android` with every native tool present prints no E1572, E1574 or E1575",
    () => {
      const env = toolsEnv();
      const built = keel(project, ["build"], env);
      expect(built.status, JSON.stringify(diags(built.records))).toBe(0);
      const check = keel(project, ["check"], env);
      expect(diags(check.records)).toEqual([]);
      expect(check.status).toBe(0);
      const target = keel(project, ["build", "--target", "capacitor", "--platform", "android"], env);
      const codes = diags(target.records).map((r) => r.code);
      for (const code of ["E1572", "E1574", "E1575"]) expect(codes).not.toContain(code);
      expect(target.status, JSON.stringify(diags(target.records))).toBe(0);
    },
    SLOW,
  );
});
