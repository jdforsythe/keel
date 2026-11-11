// Mutation-killing tests for src/bin.ts: the binary is run as a child process with controlled argv, stdin and cwd.
import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const BIN = new URL("../src/bin.ts", import.meta.url).pathname;

type Out = { code: number | null; stdout: string; stderr: string };
const made: string[] = [];
const tmp = (): string => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "keel-mut-bin-")));
  made.push(d);
  return d;
};
const put = (root: string, rel: string, text: string): void => {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
};
const fakeVite = (d: string, body: string): void => {
  put(d, "vite.config.ts", "export default {}\n");
  put(d, "node_modules/.bin/vite", `#!/bin/sh\n${body}\n`);
  chmodSync(join(d, "node_modules/.bin/vite"), 0o755);
};
const cleanEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.toLowerCase().startsWith("npm_") && k !== "KEEL_AGENT" && k !== "NODE_OPTIONS")
      env[k] = v;
  }
  return env;
};

/** Run the binary. `stdin` is written then closed, unless `keepOpen`, which leaves it open until the child ends. */
const keel = (cwd: string, args: string[], opts: { stdin?: string; keepOpen?: boolean } = {}): Promise<Out> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], { cwd, env: cleanEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (c: string) => {
      stdout += c;
    });
    child.stderr.setEncoding("utf8").on("data", (c: string) => {
      stderr += c;
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`keel ${args.join(" ")} did not exit`));
    }, 20_000);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.on("error", () => undefined);
    if (opts.stdin !== undefined) child.stdin.write(opts.stdin);
    if (opts.keepOpen !== true) child.stdin.end();
  });

const frame = (m: unknown): string => {
  const body = JSON.stringify(m);
  return `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;
};

afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("keel binary", () => {
  it("runs argv after the node and script entries and prints the result to stdout", async () => {
    const r = await keel(tmp(), ["explain", "E1051"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout.split("\n")[0]).toBe("E1051 unknown command.");
    expect(r.stdout.endsWith("ok explain E1051\n")).toBe(true);
  }, 30_000);

  it("exit code follows the result: usage errors 2, failures 1", async () => {
    const d = tmp();
    const usage = await keel(d, ["bogus"]);
    expect(usage.code).toBe(2);
    expect(usage.stdout).toBe('E1051 unknown command "bogus"\n  see: k.cli\nfail bogus 1 errors\n');
    put(d, "a.ts", "export const x: = ;");
    const bad = await keel(d, ["check"]);
    expect(bad.code).toBe(1);
    expect(bad.stdout).toBe(
      "E1000 a.ts:1:17 syntax error: Unexpected token\n  see: k.compiler\nfail check 1 files, 1 errors, 0 warnings\n",
    );
  }, 30_000);

  it("loads the project from the process cwd", async () => {
    const d = tmp();
    put(d, "src/x.ts", "export const x = 1;\n");
    const r = await keel(d, ["check"]);
    expect(r).toEqual({ code: 0, stdout: "ok check 1 files, 0 errors, 0 warnings\n", stderr: "" });
  }, 30_000);

  it("mcp streams stdin through to stdout and exits", async () => {
    const r = await keel(tmp(), ["mcp"], { stdin: '{"jsonrpc":"2.0","id":1,"method":"ping"}\n' });
    expect(r.code).toBe(0);
    expect(r.stdout).toBe('{"jsonrpc":"2.0","id":1,"result":{}}\n');
  }, 30_000);

  it("mcp with an extra argument is a usage error, not a server", async () => {
    const r = await keel(tmp(), ["mcp", "extra"], { stdin: '{"jsonrpc":"2.0","id":1,"method":"ping"}\n' });
    expect(r.code).toBe(2);
    expect(r.stdout).toBe("E1052 mcp takes no arguments: extra\n  see: k.cli\nfail mcp 1 errors\n");
  }, 30_000);

  it("lsp serves frames and the process exits at `exit` even though stdin stays open", async () => {
    const r = await keel(tmp(), ["lsp"], {
      stdin: frame({ jsonrpc: "2.0", id: 1, method: "shutdown" }) + frame({ jsonrpc: "2.0", method: "exit" }),
      keepOpen: true,
    });
    expect(r.stdout).toContain('"id":1');
    expect(r.code).toBe(0);
  }, 30_000);

  it("dev hands over to vite when vite.config.ts exists: plain `vite`, its exit code, its output", async () => {
    const d = tmp();
    fakeVite(d, 'echo "args=$#" > args.txt\necho from-vite\nexit 7');
    const r = await keel(d, ["dev"]);
    expect(r.code).toBe(7);
    expect(r.stdout).toBe("from-vite\n");
    expect(readFileSync(join(d, "args.txt"), "utf8")).toBe("args=0\n");
  }, 30_000);

  it("dev without vite.config.ts, or with arguments, is the engine's answer and never starts vite", async () => {
    const d = tmp();
    const none = await keel(d, ["dev"]);
    expect(none.code).toBe(0);
    expect(none.stdout).toBe(
      "I1055 dev not available: needs vite.config.ts and the keel binary (vite dev server)\n  see: k.server\nok dev\n",
    );
    fakeVite(d, "echo ran > ran.txt");
    const withArg = await keel(d, ["dev", "extra"]);
    expect(existsSync(join(d, "ran.txt"))).toBe(false);
    expect(withArg.stdout).not.toBe("");
    const other = await keel(d, ["explain", "E1051"]);
    expect(other.code).toBe(0);
    expect(existsSync(join(d, "ran.txt"))).toBe(false);
  }, 60_000);

  it("build runs vite build after a green engine build; silent on success, engine output kept", async () => {
    const d = tmp();
    fakeVite(d, 'echo "$@" > args.txt\necho vite-noise\necho vite-err >&2');
    const r = await keel(d, ["build"]);
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toBe("ok build 0 files, 5 artifacts, 0 errors\n");
    expect(readFileSync(join(d, "args.txt"), "utf8")).toBe("build\n");
  }, 30_000);

  it("build runs vite once per client, then once per node deployable with KEEL_DEPLOYABLE, stopping at a failure", async () => {
    const d = tmp();
    put(
      d,
      "topology.ts",
      'export default topology({ web: { modules: ["w"], adapter: "client" }, z: { modules: ["z"], adapter: "node" }, api: { modules: ["a"], adapter: "node" } })\n',
    );
    fakeVite(d, 'echo "${KEEL_DEPLOYABLE-own}" >> runs.txt');
    const r = await keel(d, ["build"]);
    expect(r.code).toBe(0);
    expect(readFileSync(join(d, "runs.txt"), "utf8")).toBe("web\napi\nz\n");
    fakeVite(
      d,
      'echo "${KEEL_DEPLOYABLE-own}" >> fail.txt\n[ "$KEEL_DEPLOYABLE" = api ] && { echo api-broke >&2; exit 3; }\nexit 0',
    );
    const f = await keel(d, ["build"]);
    expect(f.code).toBe(1);
    expect(f.stderr).toBe("api-broke\n");
    expect(readFileSync(join(d, "fail.txt"), "utf8")).toBe("web\napi\n");
  }, 30_000);

  it("build without vite.config.ts is just the engine build", async () => {
    const r = await keel(tmp(), ["build"]);
    expect(r).toEqual({ code: 0, stdout: "ok build 0 files, 5 artifacts, 0 errors\n", stderr: "" });
  }, 30_000);

  it("a vite build failure prints its last lines to stderr and fails the command with 1", async () => {
    const d = tmp();
    fakeVite(d, 'for i in 1 2 3 4 5 6; do echo "bad$i" >&2; done\nexit 5');
    const r = await keel(d, ["build"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toBe("bad2\nbad3\nbad4\nbad5\nbad6\n");
    expect(r.stdout).toBe("ok build 0 files, 5 artifacts, 0 errors\n");
  }, 30_000);

  it("a failing engine build never starts vite and keeps its own exit code", async () => {
    const d = tmp();
    put(d, "a.ts", "export const x: = ;");
    fakeVite(d, "echo ran > ran.txt");
    const r = await keel(d, ["build"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toBe("");
    expect(existsSync(join(d, "ran.txt"))).toBe(false);
  }, 30_000);

  it("only `build` triggers vite after the engine: other green commands do not", async () => {
    const d = tmp();
    fakeVite(d, "echo ran > ran.txt\nexit 3");
    const r = await keel(d, ["check"]);
    expect(r.code).toBe(0);
    expect(existsSync(join(d, "ran.txt"))).toBe(false);
  }, 30_000);
});
