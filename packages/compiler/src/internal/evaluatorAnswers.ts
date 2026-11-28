import fs from "node:fs";
import path from "node:path";
import type { EvaluatorAnswer } from "../types/EvaluatorAnswer.ts";
import type { Observed } from "./Observed.ts";
import type { ObservedKind } from "./ObservedKind.ts";

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === "string" ? x : "");
/** The stat fields a view asks one at a time (`HOST_VIEWS.stats`), each read from the `bigint` stat. */
const FIELDS = new Set([
  "mtimeNs",
  "ctimeNs",
  "birthtimeNs",
  "ino",
  "dev",
  "nlink",
  "uid",
  "gid",
  "rdev",
  "blksize",
  "blocks",
]);
/** The modules whose functions a view's `call` member asks for (`HOST_VIEWS.builtins`). */
const CALLED = new Set(["os", "tty"]);

/** Node's error as an answer the view throws again. */
function failed(e: unknown): EvaluatorAnswer {
  const code = isRecord(e) && typeof e.code === "string" ? e.code : "EIO";
  const message = e instanceof Error ? e.message : String(e);
  const errno = isRecord(e) && typeof e.errno === "number" ? e.errno : undefined;
  const syscall = isRecord(e) && typeof e.syscall === "string" ? e.syscall : undefined;
  return {
    err: { code, message, ...(errno === undefined ? {} : { errno }), ...(syscall === undefined ? {} : { syscall }) },
  };
}

type Kind = "file" | "dir" | "link" | "other";
const kindOf = (s: fs.Stats): Kind =>
  s.isFile() ? "file" : s.isDirectory() ? "dir" : s.isSymbolicLink() ? "link" : "other";

const direntKind = (d: fs.Dirent): Kind =>
  d.isFile() ? "file" : d.isDirectory() ? "dir" : d.isSymbolicLink() ? "link" : "other";

/** A fact of the command's process by name (`navigator.<name>` a property of its `navigator`), as JSON data. */
function factOf(name: string): unknown {
  if (name.startsWith("navigator.")) {
    const nav: unknown = Reflect.get(globalThis, "navigator");
    return isRecord(nav) ? Reflect.get(nav, name.slice("navigator.".length)) : undefined;
  }
  const v: unknown = Reflect.get(process, name);
  return typeof v === "function" ? Reflect.apply(v, process, []) : v;
}

/**
 * The command's side of an evaluation's questions (k.evaluator Questions): `answer`, given to `evaluate`, reads the
 * disk, the environment and the command's own process for each question a view asks, and records it as `Observed`
 * holds it (`observed()`, read after the evaluation): `read` and `open` a read; `stat`, `lstat` (or, `as: 'realpath'`,
 * a resolver's folder lookup), `exists`, `access` (a `stat`), `realpath`, `readlink` (a `realpath`), `list`, `field`
 * (`<stat|lstat> <field> <path>`), `fact` (`process`) and `call` (`<module>.<function>:<JSON arguments>`) a probe;
 * `env` a name with the value it got; `envNames` the listing, each name with its value. A path is resolved against the
 * command's working folder. The process's working folder, Node's version and the default locale and time zone are
 * always among the probes.
 */
export function evaluatorAnswers(): {
  answer: (q: Readonly<Record<string, unknown>>) => EvaluatorAnswer;
  observed: () => Observed;
} {
  const reads: string[] = [];
  const probes: [ObservedKind, string][] = [
    ["process", "cwd"],
    ["process", "version"],
    ["process", "Intl.locale"],
    ["process", "Intl.timeZone"],
  ];
  const env: [string, string | null][] = [];
  const seenEnv = new Set<string>();
  let envListed = false;
  const probe = (kind: ObservedKind, p: string): void => {
    probes.push([kind, p]);
  };
  const noteEnv = (name: string): string | null => {
    const v = process.env[name];
    const value = v === undefined ? null : v;
    if (!seenEnv.has(name)) {
      seenEnv.add(name);
      env.push([name, value]);
    }
    return value;
  };
  const answer = (q: Readonly<Record<string, unknown>>): EvaluatorAnswer => {
    const k = q.k;
    const p = path.resolve(str(q.p));
    try {
      if (k === "read") {
        reads.push(p);
        return { ok: fs.readFileSync(p).toString("base64") };
      }
      if (k === "stat" || k === "lstat") {
        probe(q.as === "realpath" ? "realpath" : k, p);
        const s = (k === "lstat" ? fs.lstatSync : fs.statSync)(p);
        return { ok: { kind: kindOf(s), size: s.size, mode: s.mode } };
      }
      if (k === "exists") {
        probe("exists", p);
        return { ok: fs.existsSync(p) };
      }
      if (k === "access") {
        probe("stat", p);
        fs.accessSync(p, typeof q.m === "number" ? q.m : fs.constants.F_OK);
        return { ok: null };
      }
      if (k === "realpath") {
        probe("realpath", p);
        return { ok: fs.realpathSync(p) };
      }
      if (k === "readlink") {
        probe("realpath", p);
        return { ok: fs.readlinkSync(p) };
      }
      if (k === "list") {
        probe("list", p);
        return {
          ok: fs.readdirSync(p, { withFileTypes: true }).map((d) => [d.name, direntKind(d)]),
        };
      }
      if (k === "field") {
        const of = q.of === "lstat" ? "lstat" : "stat";
        const f = str(q.f);
        if (!FIELDS.has(f)) return { err: { code: "E1050", message: `the stat field ${f}` } };
        probe("field", `${of} ${f} ${p}`);
        const v: unknown = Reflect.get((of === "lstat" ? fs.lstatSync : fs.statSync)(p, { bigint: true }), f);
        return { ok: typeof v === "bigint" ? String(v) : v };
      }
      if (k === "env") return { ok: noteEnv(str(q.n)) };
      if (k === "envNames") {
        envListed = true;
        const names = Object.keys(process.env);
        for (const n of names) noteEnv(n);
        return { ok: names };
      }
      if (k === "fact") {
        const n = str(q.n);
        probe("process", n);
        return { ok: JSON.parse(JSON.stringify(factOf(n)) ?? "null") };
      }
      if (k === "call") {
        const m = str(q.m);
        const f = str(q.f);
        const args: unknown = q.a;
        const mod: unknown = CALLED.has(m) ? process.getBuiltinModule(`node:${m}`) : undefined;
        const fn = isRecord(mod) ? mod[f] : undefined;
        if (typeof fn !== "function" || !Array.isArray(args)) return { err: { code: "E1050", message: `${m}.${f}` } };
        probe("call", `${m}.${f}:${JSON.stringify(args)}`);
        return { ok: JSON.parse(JSON.stringify(Reflect.apply(fn, mod, args)) ?? "null") };
      }
    } catch (e) {
      return failed(e);
    }
    return { err: { code: "E1050", message: `a question Keel does not answer (${str(k)})` } };
  };
  return { answer, observed: () => ({ reads: [...new Set(reads)], probes: dedupe(probes), env, envListed }) };
}

/** Each probe once, in first-seen order. */
function dedupe(probes: readonly [ObservedKind, string][]): [ObservedKind, string][] {
  const seen = new Set<string>();
  return probes.filter(([k, p]) => {
    const key = `${k}\0${p}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
