import { existsSync, lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import os from "node:os";
import tty from "node:tty";
import { isRecord } from "../isRecord.ts";
import { sha256Hex } from "../sha256Hex.ts";
import type { CacheProbe } from "./CacheProbe.ts";

const hash = (names: readonly string[]): string => sha256Hex(new TextEncoder().encode([...names].sort().join("\n")));
/** The process's facts an evaluation calls rather than reads (`OBSERVE_BANNER` of `@keel/compiler`). */
const CALLED = new Set(["cwd", "umask", "getuid", "geteuid", "getgid", "getegid", "getgroups"]);
/** The built-ins whose calls an evaluation records (`RECORDED_BUILTINS` of `@keel/compiler`). */
const RECORDED: Readonly<Record<string, unknown>> = { os, tty };
/** `<module>.<function>:<JSON arguments>`. */
const CALL = /^([a-z]+)\.([A-Za-z_$][\w$]*):(.*)$/s;

type Stat = {
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  readonly size: number;
  readonly mode: number;
};

/** A stat's answer: the kind, with size and mode for a file and mode for a folder; never a time. */
function kindOf(s: Stat): string {
  const mode = (s.mode & 0o7777).toString(8);
  if (s.isFile()) return `file ${String(s.size)} ${mode}`;
  if (s.isDirectory()) return `folder ${mode}`;
  return s.isSymbolicLink() ? "link" : "other";
}

/** The JSON of `v`, or null when it has none. */
const json = (v: unknown): string | null => JSON.stringify(v) ?? null;

/** The answer of a recorded call (`call`), asked again: the real function with the recorded arguments. */
function called(path: string): string | null {
  const m = CALL.exec(path);
  if (m === null) return null;
  const mod = RECORDED[m[1] ?? ""];
  const fn = isRecord(mod) ? mod[m[2] ?? ""] : undefined;
  const args: unknown = JSON.parse(m[3] ?? "null");
  return typeof fn === "function" && Array.isArray(args) ? json(Reflect.apply(fn, mod, args)) : null;
}

/** The answer of a fact of the process (`process`; `navigator.<name>` a property of the global `navigator`), read again. */
function fact(name: string): string | null {
  const nav = name.startsWith("navigator.") ? Reflect.get(globalThis, "navigator") : undefined;
  if (nav !== undefined) return isRecord(nav) ? json(Reflect.get(nav, name.slice("navigator.".length))) : null;
  const v: unknown = Reflect.get(process, name);
  return json(CALLED.has(name) && typeof v === "function" ? Reflect.apply(v, process, []) : v);
}

/**
 * The answer `kind`'s question about `path` gets now (`CacheProbe`), asked of the file system, the process and
 * `process.env`.
 */
export function probeAnswer(kind: CacheProbe["kind"], path: string): string | null {
  try {
    if (kind === "exists") return existsSync(path) ? "yes" : "no";
    if (kind === "stat") return kindOf(statSync(path));
    if (kind === "lstat") return kindOf(lstatSync(path));
    if (kind === "realpath") return realpathSync(path);
    if (kind === "list")
      return hash(
        readdirSync(path, { withFileTypes: true }).map(
          (d) => `${d.name}${d.isDirectory() ? "/" : d.isSymbolicLink() ? "@" : ""}`,
        ),
      );
    if (kind === "process") return fact(path);
    if (kind === "call") return called(path);
    if (kind === "env") return process.env[path] ?? null;
    return hash(Object.keys(process.env));
  } catch {
    return kind === "stat" || kind === "lstat" ? "no" : null;
  }
}
