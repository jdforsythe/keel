import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { EvaluateFailure } from "./EvaluateFailure.ts";
import { EVALUATOR_BOOTSTRAP } from "./internal/EVALUATOR_BOOTSTRAP.ts";
import { liveEvaluators } from "./internal/liveEvaluators.ts";
import type { EvaluateInput } from "./types/EvaluateInput.ts";
import type { EvaluateResult } from "./types/EvaluateResult.ts";
import type { EvaluatorAnswer } from "./types/EvaluatorAnswer.ts";

const DEADLINE = 30_000;
/** The longest line the command buffers from an evaluator: 64 MiB. */
const LINE_LIMIT = 64 * 1024 * 1024;
/** The command's environment names an evaluator keeps (k.evaluator Start). */
const KEPT = /^(?:TZ|LANG|LC_[A-Z_]+)$/;
const REFUSED: EvaluatorAnswer = {
  err: { code: "E1050", message: "a question no command answers at build time" },
};

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
/** `text` with each control character removed, a run of tabs and line breaks becoming one space (k.evaluator Placing). */
const clean = (text: string): string =>
  text.replace(/[\t\n\r]+/g, " ").replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
const pair = (line: number, col: number): readonly [number, number] => [line, col];
const frameList = (x: unknown): (readonly [number, number])[] =>
  Array.isArray(x)
    ? x.flatMap((f: unknown) =>
        Array.isArray(f) && typeof f[0] === "number" && typeof f[1] === "number" ? [pair(f[0], f[1])] : [],
      )
    : [];

/** The evaluator's environment: `TZ`, `LANG` and each `LC_*` name of the command's, nothing else. */
function evaluatorEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (KEPT.test(k) && v !== undefined) env[k] = v;
  return env;
}

/**
 * Node and its arguments for an evaluator of `entry` (k.evaluator Start). Where a POSIX shell exists the child is
 * started through it with a processor-time limit of twice the deadline and a second (`ulimit -t`, then `exec`, so the
 * child is Node itself): a loop that never yields ends at that limit even when the command was killed outright and
 * can no longer end it. A shell that refuses the limit (a lower hard limit already set) still starts Node, under the
 * limit it has.
 */
function command(entry: string, deadlineMs: number): { file: string; args: string[] } {
  const node = [
    "--permission",
    `--allow-fs-read=${path.dirname(entry)}`,
    "--disallow-code-generation-from-strings",
    "--zero-fill-buffers",
    "--input-type=module",
    "-e",
    EVALUATOR_BOOTSTRAP,
    entry,
  ];
  if (process.platform === "win32" || !fs.existsSync("/bin/sh")) return { file: process.execPath, args: node };
  const cpu = String(Math.ceil((2 * deadlineMs) / 1000) + 1);
  return { file: "/bin/sh", args: ["-c", `ulimit -t ${cpu} 2>/dev/null; exec "$0" "$@"`, process.execPath, ...node] };
}

/**
 * Evaluate `entry` in an evaluator (k.evaluator): a Node child of its own, started as k.evaluator Start says, in a new
 * empty working folder removed when it ends. Each question its views ask arrives as a line on the child's descriptor
 * 3 and is answered by `answer` (refused without one) on its descriptor 4; its output streams are discarded. The
 * entry's result ends the child (`SIGKILL`), and the call resolves once the child has closed: to the entry's exports
 * as JSON, or to one `EvaluateFailure`: the throw that ended the entry, as the child recorded it; E1048 when no result
 * came within `deadlineMs` (or the child reached its processor-time limit) or Node ended it on a top-level await that
 * can never settle (exit 13 after its loop emptied, which the child reports as `idle`); E1049 for any other end, a
 * result line that is no JSON, and a line past 64 MiB. Every text that crosses from the child loses its control
 * characters. `file` in those messages is the entry file the child last named (`at`), else the entry's own name. An
 * aborted `signal` ends the child and rejects with its reason.
 */
export function evaluate(input: EvaluateInput): Promise<EvaluateResult> {
  const deadlineMs = input.deadlineMs ?? DEADLINE;
  const entry = fs.realpathSync(input.entry);
  const answer = input.answer ?? ((): EvaluatorAnswer => REFUSED);
  if (input.signal?.aborted === true) return Promise.reject(input.signal.reason);
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-evaluator-")));
  const { file: bin, args } = command(entry, deadlineMs);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env: evaluatorEnv(),
      stdio: ["pipe", "ignore", "ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    liveEvaluators.add(child);
    let file: string | undefined;
    let ended: EvaluateResult | undefined;
    let late = false;
    let idle = false;
    let aborted = false;
    const end = (): void => {
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => {
      late = true;
      end();
    }, deadlineMs);
    const onAbort = (): void => {
      aborted = true;
      end();
    };
    input.signal?.addEventListener("abort", onAbort, { once: true });
    const q3 = child.stdio[3];
    const a4 = child.stdio[4];
    const questions = q3 instanceof Readable ? q3 : undefined;
    const answers = a4 instanceof Writable ? a4 : undefined;
    let parts: Buffer[] = [];
    let size = 0;
    let dropped = false;
    const onRecord = (m: Readonly<Record<string, unknown>>): void => {
      if (m.t === "ask") {
        let a: EvaluatorAnswer;
        try {
          a = answer(isRecord(m.q) ? m.q : {});
        } catch (e) {
          a = { err: { code: "E1049", message: e instanceof Error ? e.message : String(e) } };
        }
        answers?.write(`${JSON.stringify(a)}\n`);
      } else if (m.t === "at" && typeof m.file === "string") file = clean(m.file);
      else if (m.t === "idle") idle = true;
      else if (m.t === "result" && ended === undefined) {
        let v: unknown;
        let json = true;
        try {
          v = typeof m.json === "string" ? JSON.parse(m.json) : undefined;
        } catch {
          json = false;
        }
        const why = json ? "the entry's exports are not an object" : "the entry's result is not JSON";
        ended = isRecord(v) ? v : new EvaluateFailure("E1049", `${name()}: ${why}`);
        end();
      } else if (m.t === "failure" && ended === undefined) {
        ended = new EvaluateFailure(
          typeof m.code === "string" && /^[EW][0-9]{4}$/.test(m.code) ? m.code : "E1049",
          typeof m.message === "string" ? clean(m.message) : `${name()}: the evaluation failed`,
          { what: typeof m.what === "string" ? clean(m.what) : undefined, frames: frameList(m.frames), file },
        );
        end();
      }
    };
    const name = (): string => file ?? path.basename(entry);
    /** A line past `LINE_LIMIT` ends the evaluation: nothing of it is parsed or kept. */
    const tooLong = (): void => {
      dropped = true;
      parts = [];
      size = 0;
      ended ??= new EvaluateFailure("E1049", `${name()}: the evaluator sent a line past 64 MiB`, { file });
      end();
    };
    const onLine = (line: string): void => {
      let m: unknown;
      try {
        m = JSON.parse(line);
      } catch {
        ended ??= new EvaluateFailure("E1049", `${name()}: the evaluator sent a line that is not JSON`, { file });
        end();
        return;
      }
      if (isRecord(m)) onRecord(m);
    };
    questions?.on("data", (chunk: Buffer) => {
      if (dropped) return;
      let from = 0;
      for (let i = chunk.indexOf(10, from); i >= 0; i = chunk.indexOf(10, from)) {
        if (size + i - from > LINE_LIMIT) return tooLong();
        parts.push(chunk.subarray(from, i));
        const line = Buffer.concat(parts).toString("utf8");
        parts = [];
        size = 0;
        from = i + 1;
        onLine(line);
      }
      if (size + chunk.length - from > LINE_LIMIT) return tooLong();
      parts.push(chunk.subarray(from));
      size += chunk.length - from;
    });
    // A write to a child that has ended fails; its end is what decides the result.
    answers?.on("error", () => undefined);
    child.stdin?.on("error", () => undefined);
    child.on("error", (e) => {
      ended ??= new EvaluateFailure("E1049", `${name()}: the evaluator did not start: ${e.message}`, { file });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      liveEvaluators.remove(child);
      fs.rmSync(cwd, { recursive: true, force: true });
      if (aborted && ended === undefined) {
        reject(input.signal?.reason);
        return;
      }
      const at = { file };
      if (ended !== undefined) resolve(ended);
      else if (late || signal === "SIGXCPU")
        resolve(new EvaluateFailure("E1048", `${name()} did not finish evaluating in ${String(deadlineMs)} ms`, at));
      else if (code === 13 && idle)
        resolve(
          new EvaluateFailure("E1048", `${name()} did not finish evaluating: a top-level await never settles`, at),
        );
      else
        resolve(
          new EvaluateFailure(
            "E1049",
            signal !== null
              ? `${name()}: the evaluator ended with signal ${signal}`
              : `${name()}: the evaluator ended with exit ${String(code)}`,
            at,
          ),
        );
    });
  });
}
