// The `claude` calls of the public mode: the working directory is the project, only project settings load, and the
// iteration's transcript (`stream-json`) is kept in a file for the audit.
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { isRecord } from "./run.ts";

export type Reply = {
  text: string;
  transcript: string;
  input: number;
  output: number;
  costUsd: number;
  timedOut: boolean;
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * The argument list for one call. `--setting-sources project` keeps the user's and local settings out; `stream-json`
 * records every tool call, and the claude CLI accepts it in print mode only together with `--verbose`, so the flag is
 * here for that reason and no other.
 */
export function claudeArgs(prompt: string, model: string | undefined, maxTurns: number): string[] {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--setting-sources",
    "project",
    "--dangerously-skip-permissions",
    "--max-turns",
    String(maxTurns),
  ];
  if (model !== undefined) args.push("--model", model);
  args.push("--", prompt);
  return args;
}

/** The `result` line of a `stream-json` transcript: text, usage (input tokens include cache reads and writes), cost. */
export function parseTranscript(transcript: string): Omit<Reply, "timedOut" | "transcript"> {
  let result: Record<string, unknown> = {};
  for (const line of transcript.split("\n")) {
    try {
      const e: unknown = JSON.parse(line);
      if (isRecord(e) && e["type"] === "result") result = e;
    } catch {
      continue;
    }
  }
  const u = isRecord(result["usage"]) ? result["usage"] : {};
  return {
    text: typeof result["result"] === "string" ? result["result"] : "",
    input: num(u["input_tokens"]) + num(u["cache_creation_input_tokens"]) + num(u["cache_read_input_tokens"]),
    output: num(u["output_tokens"]),
    costUsd: num(result["total_cost_usd"]),
  };
}

/** Runs `claude` in `cwd` to its end (or `timeoutMs`), writes the transcript to `transcriptFile`. */
export function callClaude(
  cwd: string,
  prompt: string,
  model: string | undefined,
  maxTurns: number,
  transcriptFile: string,
  timeoutMs = 60 * 60_000,
): Promise<Reply> {
  return new Promise((resolve) => {
    const child = spawn("claude", claudeArgs(prompt, model, maxTurns), {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, KEEL_AGENT: "1" },
    });
    let out = "";
    let timedOut = false;
    child.stdout.on("data", (b: Buffer) => {
      out += b.toString("utf8");
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.on("close", () => {
      clearTimeout(timer);
      void writeFile(transcriptFile, out).then(() => resolve({ ...parseTranscript(out), transcript: out, timedOut }));
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ text: "", transcript: out, input: 0, output: 0, costUsd: 0, timedOut });
    });
  });
}
