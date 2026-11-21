// Support for conformance tests that run the real `keel` binary on a materialized tree. Not a test file.
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function findRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      statSync(join(dir, "pnpm-workspace.yaml"));
      return dir;
    } catch {
      const up = dirname(dir);
      if (up === dir) throw new Error("repo root (pnpm-workspace.yaml) not found");
      dir = up;
    }
  }
}
export const root = findRoot();

const EXTERNAL = ["vitest", "vite", "typescript", "happy-dom", "fast-check"];

export function materialize(files: Map<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "keel-scaffold-"));
  for (const [path, content] of files) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  mkdirSync(join(dir, "node_modules/@keel"), { recursive: true });
  for (const pkg of readdirSync(join(root, "packages"))) {
    symlinkSync(join(root, "packages", pkg), join(dir, "node_modules/@keel", pkg));
  }
  for (const name of EXTERNAL) symlinkSync(join(root, "node_modules", name), join(dir, "node_modules", name));
  return dir;
}

export type CliRecord = { kind: string; [key: string]: unknown };
export type CliResult = { status: number | null; records: CliRecord[] };

function isRecord(v: unknown): v is CliRecord {
  return typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string";
}

export function keel(dir: string, args: string[]): CliResult {
  const env: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [join(root, "packages/cli/src/bin.ts"), ...args, "--format=json"], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
  const records: CliRecord[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (isRecord(v)) records.push(v);
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, records };
}

export function readTree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rel: string): void => {
    for (const name of readdirSync(join(dir, rel)).sort()) {
      const p = rel === "" ? name : `${rel}/${name}`;
      if (p === "node_modules") continue;
      if (statSync(join(dir, p)).isDirectory()) walk(p);
      else out.set(p, readFileSync(join(dir, p), "utf8"));
    }
  };
  walk("");
  return out;
}

export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
