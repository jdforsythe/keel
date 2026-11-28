import { existsSync, lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isRecord } from "../isRecord.ts";
import { sha256Hex } from "../sha256Hex.ts";
import type { CacheProbe } from "./CacheProbe.ts";

const hash = (names: readonly string[]): string => sha256Hex(new TextEncoder().encode([...names].sort().join("\n")));
/** `<module>.<function>:<JSON arguments>`. */
const CALL = /^([a-z_/]+)\.([A-Za-z_$][\w$]*):(.*)$/s;
/** `<stat|lstat> <field> <path>`. */
const FIELD = /^(stat|lstat) ([A-Za-z]+) (.*)$/s;

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
  const mod: unknown = process.getBuiltinModule(`node:${m[1] ?? ""}`);
  const fn = isRecord(mod) ? mod[m[2] ?? ""] : undefined;
  const args: unknown = JSON.parse(m[3] ?? "null");
  return typeof fn === "function" && Array.isArray(args) ? json(Reflect.apply(fn, mod, args)) : null;
}

/** The answer of a field of a stat result (`field`), read again from the `bigint` stat. */
function field(path: string): string | null {
  const m = FIELD.exec(path);
  if (m === null) return null;
  const s = (m[1] === "lstat" ? lstatSync : statSync)(m[3] ?? "", { bigint: true });
  const v: unknown = Reflect.get(s, m[2] ?? "");
  return typeof v === "bigint" || typeof v === "number" ? String(v) : null;
}

/**
 * The answer of a fact of the process (`process`; `navigator.<name>` a property of the global `navigator`;
 * `Intl.locale` and `Intl.timeZone` the default locale and time zone), read again.
 */
function fact(name: string): string | null {
  if (name === "Intl.locale" || name === "Intl.timeZone") {
    const o = new Intl.DateTimeFormat().resolvedOptions();
    return name === "Intl.locale" ? o.locale : o.timeZone;
  }
  const nav = name.startsWith("navigator.") ? Reflect.get(globalThis, "navigator") : undefined;
  if (nav !== undefined) return isRecord(nav) ? json(Reflect.get(nav, name.slice("navigator.".length))) : null;
  const v: unknown = Reflect.get(process, name);
  return json(typeof v === "function" ? Reflect.apply(v, process, []) : v);
}

/**
 * The answer `kind`'s question about `path` gets now (`CacheProbe`), asked of the file system, the process and
 * `process.env`; a `realpath` question goes to `realOf`, a pass's lookup (`realPaths`), when one is given.
 */
export function probeAnswer(
  kind: CacheProbe["kind"],
  path: string,
  realOf?: (file: string) => string | undefined,
): string | null {
  try {
    if (kind === "exists") return existsSync(path) ? "yes" : "no";
    if (kind === "stat") {
      const s = statSync(path, { throwIfNoEntry: false });
      return s === undefined ? "no" : kindOf(s);
    }
    if (kind === "lstat") {
      const s = lstatSync(path, { throwIfNoEntry: false });
      return s === undefined ? "no" : kindOf(s);
    }
    if (kind === "realpath") return realOf === undefined ? realpathSync(path) : (realOf(path) ?? null);
    if (kind === "list")
      return hash(
        readdirSync(path, { withFileTypes: true }).map(
          (d) => `${d.name}${d.isDirectory() ? "/" : d.isSymbolicLink() ? "@" : d.isFile() ? "" : "!"}`,
        ),
      );
    if (kind === "process") return fact(path);
    if (kind === "call") return called(path);
    if (kind === "field") return field(path);
    if (kind === "env") return process.env[path] ?? null;
    return hash(Object.keys(process.env));
  } catch {
    return kind === "stat" || kind === "lstat" ? "no" : null;
  }
}
