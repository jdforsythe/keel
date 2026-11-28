// Handing the brief to an agent CLI, non-interactive, in the arm's directory. `claude` and `codex` both run with their
// permission prompts off: the arm directory is a throwaway outside the repository. Usage is read from each CLI's JSON.
import { spawn } from "node:child_process";

export type Agent = "claude" | "codex";
export type Usage = { input: number; output: number; costUsd: number; turns: number; text: string; timedOut: boolean };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** The claude CLI's `--output-format json` result; input tokens include cache reads and writes, as in evals/run.ts. */
export function claudeUsage(stdout: string): Usage {
  const j = parseJson(stdout);
  const o = isRecord(j) ? j : {};
  const u = isRecord(o["usage"]) ? o["usage"] : {};
  return {
    input: num(u["input_tokens"]) + num(u["cache_creation_input_tokens"]) + num(u["cache_read_input_tokens"]),
    output: num(u["output_tokens"]),
    costUsd: num(o["total_cost_usd"]),
    turns: num(o["num_turns"]),
    text: typeof o["result"] === "string" ? o["result"] : "",
    timedOut: false,
  };
}

/** The codex CLI's `--json` event lines: the `turn.completed` usages summed, the last agent message as text. */
export function codexUsage(stdout: string): Usage {
  let input = 0;
  let output = 0;
  let turns = 0;
  let text = "";
  for (const line of stdout.split("\n")) {
    const e = parseJson(line);
    if (!isRecord(e)) continue;
    if (e["type"] === "turn.completed" && isRecord(e["usage"])) {
      input += num(e["usage"]["input_tokens"]);
      output += num(e["usage"]["output_tokens"]);
      turns++;
    }
    const item = e["item"];
    if (
      e["type"] === "item.completed" &&
      isRecord(item) &&
      item["type"] === "agent_message" &&
      typeof item["text"] === "string"
    )
      text = item["text"];
  }
  return { input, output, costUsd: 0, turns, text, timedOut: false };
}

/** The command line for `agent` in `dir` (a pure function, so the shapes are testable without spending anything). */
export function agentCommand(
  agent: Agent,
  dir: string,
  prompt: string,
  model: string | undefined,
): { cmd: string; args: string[] } {
  if (agent === "claude") {
    const args = ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--max-turns", "80"];
    if (model !== undefined) args.push("--model", model);
    // `--` ends the options: a prompt that starts with `-` would otherwise parse as one.
    return { cmd: "claude", args: [...args, "--", prompt] };
  }
  const args = ["exec", "--json", "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check", "-C", dir];
  if (model !== undefined) args.push("-m", model);
  return { cmd: "codex", args: [...args, prompt] };
}

/** Runs the agent to its end or `timeoutMs`, whichever is first. */
export function runAgent(
  agent: Agent,
  dir: string,
  prompt: string,
  model: string | undefined,
  timeoutMs: number,
): Promise<Usage> {
  const { cmd, args } = agentCommand(agent, dir, prompt, model);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: dir,
      env: { ...process.env, KEEL_AGENT: "1" },
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    child.stdout.on("data", (d: Buffer) => {
      out += String(d);
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    const finish = (): void => {
      clearTimeout(timer);
      const usage = agent === "claude" ? claudeUsage(out) : codexUsage(out);
      resolve({ ...usage, timedOut });
    };
    child.once("error", finish);
    child.once("close", finish);
  });
}
