// Shared harness for the `create-app` bin conformance (not a test file). Seed 1337 for every property.
// ASSUMED (the spec fixes the bin's name, not its path): the bin is `packages/create-app/src/bin.ts`, run by Node's type stripping as `packages/cli/src/bin.ts` is.
// The bin is run as a child process in folders under the OS temp folder with a minimal environment (`PATH`, `TMPDIR`, `npm_config_user_agent`).
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  chmodSync,
  lstatSync,
  watch,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO = fileURLToPath(new URL("../../..", import.meta.url));
export const BIN = fileURLToPath(new URL("../src/bin.ts", import.meta.url));
export const KEEL_BIN = join(REPO, "packages/cli/src/bin.ts");
export const SEED = 1337;
export const PNPM = "pnpm/9.12.0 node/v22.15.0";

export type Rec = { kind: string; [key: string]: unknown };
export type Run = { status: number | null; stdout: string; stderr: string; out: string };

const made: string[] = [];
/** A fresh temp folder, removed by `cleanAll`. */
export function sandbox(): string {
  const d = mkdtempSync(join(tmpdir(), "keel-create-"));
  made.push(d);
  return d;
}
export function cleanAll(): void {
  for (const d of made.splice(0)) {
    try {
      chmodTree(d);
    } catch {
      // nothing left to unlock
    }
    rmSync(d, { recursive: true, force: true });
  }
}
function chmodTree(dir: string): void {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    try {
      const st = lstatSync(p);
      if (st.isDirectory() && !st.isSymbolicLink()) {
        chmodSync(p, 0o755);
        chmodTree(p);
      }
    } catch {
      // a dangling link
    }
  }
}

export const put = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

/** Every file under `dir`, relative path to text; a missing `dir` is the empty map. `node_modules` is skipped. */
export function tree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rel: string): void => {
    let names: string[] = [];
    try {
      names = readdirSync(join(dir, rel)).sort();
    } catch {
      return;
    }
    for (const n of names) {
      const p = rel === "" ? n : `${rel}/${n}`;
      if (p === "node_modules") continue;
      if (statSync(join(dir, p)).isDirectory()) walk(p);
      else out.set(p, readFileSync(join(dir, p), "utf8"));
    }
  };
  walk("");
  return out;
}

/** Every entry (files and folders, folders with a trailing "/"; a link is listed as itself, never followed) under `dir`: what "left as it was" compares. */
export function entries(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    let names: string[] = [];
    try {
      names = readdirSync(join(dir, rel)).sort();
    } catch {
      return;
    }
    for (const n of names) {
      const p = rel === "" ? n : `${rel}/${n}`;
      if (lstatSync(join(dir, p)).isDirectory()) {
        out.push(`${p}/`);
        walk(p);
      } else out.push(p);
    }
  };
  walk("");
  return out;
}

export function envOf(
  userAgent: string | undefined = PNPM,
  extra: Record<string, string> = {},
): Record<string, string> {
  const env: Record<string, string> = { ...extra };
  for (const k of ["PATH", "TMPDIR", "HOME"]) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  if (userAgent !== undefined) env.npm_config_user_agent = userAgent;
  return env;
}

export type RunOpts = {
  /** `open`: standard input a pipe nothing writes and nothing closes; `closed`: a pipe closed at once. Default `open`. */
  stdin?: "open" | "closed";
  userAgent?: string | undefined;
  nodeArgs?: string[];
  env?: Record<string, string>;
};

/** Runs the bin; resolves when it exits (the test's own time bound ends a hang). Never reads or closes the child's standard input but as asked. */
export function run(args: string[], cwd: string, opts: RunOpts = {}): Promise<Run> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn(process.execPath, [...(opts.nodeArgs ?? []), BIN, ...args], {
      cwd,
      env: envOf("userAgent" in opts ? opts.userAgent : PNPM, opts.env),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8").on("data", (d: string) => {
      stdout += d;
    });
    child.stderr?.setEncoding("utf8").on("data", (d: string) => {
      stderr += d;
    });
    child.stdin?.on("error", () => {
      // the child may exit before a pipe is closed
    });
    if ((opts.stdin ?? "open") === "closed") child.stdin?.end();
    // An open standard input pipe may keep `close` from firing: end our side once the process has exited.
    child.on("exit", () => {
      child.stdin?.destroy();
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr, out: `${stdout}${stderr}` });
    });
    child.on("error", (e) => {
      resolve({ status: null, stdout, stderr: `${stderr}${String(e)}`, out: `${stdout}${stderr}${String(e)}` });
    });
  });
}

const isRec = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && typeof Reflect.get(v, "kind") === "string";
export function records(stdout: string): Rec[] {
  const out: Rec[] = [];
  for (const line of stdout.split("\n")) {
    try {
      const v: unknown = JSON.parse(line);
      if (isRec(v)) out.push(v);
    } catch {
      // a non-JSON line
    }
  }
  return out;
}

export const readJson = (text: string | undefined): Record<string, unknown> => {
  try {
    const v: unknown = JSON.parse(text ?? "{}");
    return typeof v === "object" && v !== null ? { ...v } : {};
  } catch {
    return {};
  }
};

/** Create's own version: the `version` of `packages/create-app/package.json`. */
export const createVersion = (): string => {
  const v = readJson(readFileSync(join(REPO, "packages/create-app/package.json"), "utf8")).version;
  return typeof v === "string" ? v : "";
};
export const cliVersion = (): string => {
  const v = readJson(readFileSync(join(REPO, "packages/cli/package.json"), "utf8")).version;
  return typeof v === "string" ? v : "";
};

/** The skill names `@keel/cli` ships, one folder each. */
export const skillNames = (): string[] =>
  readdirSync(join(REPO, "packages/cli/skills"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
export const skillPaths = (): string[] => skillNames().map((n) => `.claude/skills/${n}/SKILL.md`);

export const CLIENT_FILES = [
  "package.json",
  "README.md",
  "tsconfig.json",
  "vite.config.ts",
  "tokens.ts",
  "topology.ts",
  "turbo.json",
  ".gitignore",
  ".keel/.gitkeep",
  "public/keel-mark.svg",
  ".github/workflows/ci.yml",
  "modules/app/module.ts",
  "modules/app/app.contract.ts",
  "modules/app/routes.ts",
  "modules/app/HomePage.tsx",
  "modules/app/home.route.test.ts",
  "AGENTS.md",
  "CLAUDE.md",
];
export const NODE_EXTRA = ["modules/app/loadHome.server.ts", "deploy/web/Dockerfile", "deploy/compose.yaml"];
export const sorted = (a: string[]): string[] => [...a].sort();
export const clientSet = (): string[] => sorted([...CLIENT_FILES, ...skillPaths()]);
export const nodeSet = (): string[] => sorted([...CLIENT_FILES, ...NODE_EXTRA, ...skillPaths()]);

/** `node_modules/@keel/*` and the external tools linked into `dir`, so a created project beside it resolves what its commands import. */
export function link(dir: string): void {
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(REPO, "packages")))
    symlinkSync(join(REPO, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  for (const n of ["vitest", "vite", "typescript", "happy-dom", "fast-check"])
    symlinkSync(join(REPO, "node_modules", n), join(dir, "node_modules", n));
}

export type KeelRun = { status: number | null; records: Rec[]; out: string };
/** The real `keel` over a folder (JSON output). */
export function keel(cwd: string, args: string[]): KeelRun {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("VITEST") && !k.startsWith("npm_config_") && k !== "NODE_OPTIONS") env[k] = v;
  }
  const r = spawnSync(process.execPath, [KEEL_BIN, ...args, "--format=json"], { cwd, encoding: "utf8", env });
  return { status: r.status, records: records(r.stdout), out: `${r.stdout}${r.stderr}` };
}

const HOLD = pathToFileURL(fileURLToPath(new URL("./stall-after-first-write.ts", import.meta.url))).href;
export type Held = { stalled: boolean; finish: (signal: NodeJS.Signals) => Promise<Run> };

/** Runs the bin with its second project write held (stall-after-first-write.ts); resolves once it is held or has exited. `finish` signals it and resolves with its end. */
export function runHeld(args: string[], cwd: string, userAgent: string = PNPM): Promise<Held> {
  const flag = join(sandbox(), "ready");
  const child: ChildProcess = spawn(process.execPath, ["--import", HOLD, BIN, ...args], {
    cwd,
    env: envOf(userAgent, { KEEL_CONFORMANCE_READY: flag }),
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8").on("data", (d: string) => {
    stdout += d;
  });
  child.stderr?.setEncoding("utf8").on("data", (d: string) => {
    stderr += d;
  });
  child.stdin?.on("error", () => {
    // the child may exit before a pipe is closed
  });
  const ended = new Promise<Run>((resolve) => {
    child.on("close", (status) => {
      resolve({ status, stdout, stderr, out: `${stdout}${stderr}` });
    });
  });
  return new Promise<Held>((resolve) => {
    const watcher = watch(dirname(flag), () => {
      if (existsSync(flag)) settle(true);
    });
    let done = false;
    const settle = (stalled: boolean): void => {
      if (done) return;
      done = true;
      watcher.close();
      resolve({
        stalled,
        finish: (signal) => {
          child.kill(signal);
          return ended;
        },
      });
    };
    child.on("exit", () => settle(false));
    if (existsSync(flag)) settle(true);
  });
}
