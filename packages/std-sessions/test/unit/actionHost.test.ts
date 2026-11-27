// `actionHost`: the process side of `keel-session-action`. Its flags, env, clock and fetch are the process's own; `run`
// starts `KEEL_COMMAND` in the working directory with the given env, captures stdout and passes stderr on line by
// line, cleaned and prefixed `keel: `; `read` answers for files under the working directory only.
// Seed 1337 (no random inputs)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { actionHost } from "../../src/internal/actionHost.ts";

const dir = tempDir("keel-action-host-");
const script = path.join(dir, "child.mjs");
const argv = process.argv;
const command = process.env.KEEL_COMMAND;

beforeAll(() => {
  fs.writeFileSync(
    script,
    [
      'const mode = process.argv[2] ?? "";',
      'if (mode === "echo") process.stdout.write(JSON.stringify({ args: process.argv.slice(3), cwd: process.cwd(), env: process.env }));',
      'if (mode === "stderr") {',
      '  process.stdout.write("out-1\\n");',
      '  process.stderr.write("one\\n   \\n::error::two\\u001b[31m!\\n" + "x".repeat(400) + "\\nthree");',
      '  process.stdout.write("out-2\\n");',
      "  process.exitCode = 3;",
      "}",
      'if (mode === "split") {',
      '  process.stderr.write("first ha");',
      '  setTimeout(() => process.stderr.write("lf\\nsecond\\n"), 150);',
      "}",
      'if (mode === "killed") process.kill(process.pid, "SIGKILL");',
      "",
    ].join("\n"),
  );
});
afterEach(() => {
  process.argv = argv;
  if (command === undefined) Reflect.deleteProperty(process.env, "KEEL_COMMAND");
  else process.env.KEEL_COMMAND = command;
  Reflect.deleteProperty(process.env, "KEEL_ACTION_HOST_MARK");
  vi.restoreAllMocks();
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

/** The lines `run` passed on to stderr while `work` ran. */
async function stderrOf(work: () => Promise<unknown>): Promise<string[]> {
  const lines: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  await work();
  return lines;
}

describe("actionHost: what it reads from the process", () => {
  test("args are the arguments after the script, env the process env, tty whether stdout is a terminal", () => {
    process.argv = ["node", "keel-session-action", "--quiet", "--limit", "3"];
    process.env.KEEL_ACTION_HOST_MARK = "here";
    const host = actionHost();
    expect(host.args).toEqual(["--quiet", "--limit", "3"]);
    expect(host.env.KEEL_ACTION_HOST_MARK).toBe("here");
    expect(Object.keys(host.env).sort()).toEqual(Object.keys(process.env).sort());
    expect(Object.values(host.env).every((v) => typeof v === "string")).toBe(true);
    expect(host.tty).toBe(process.stdout.isTTY === true);
  });

  test("tty follows stdout.isTTY", () => {
    const real = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    try {
      Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
      expect(actionHost().tty).toBe(true);
      Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
      expect(actionHost().tty).toBe(false);
      Object.defineProperty(process.stdout, "isTTY", { value: undefined, configurable: true });
      expect(actionHost().tty).toBe(false);
    } finally {
      if (real === undefined) Reflect.deleteProperty(process.stdout, "isTTY");
      else Object.defineProperty(process.stdout, "isTTY", real);
    }
  });

  test("now is the wall clock in milliseconds", () => {
    vi.useFakeTimers({ now: 1_800_000_000_000 });
    try {
      const host = actionHost();
      expect(host.now()).toBe(1_800_000_000_000);
      vi.advanceTimersByTime(1500);
      expect(host.now()).toBe(1_800_000_001_500);
    } finally {
      vi.useRealTimers();
    }
  });

  test("fetch is the global fetch, with and without init", async () => {
    const server = http.createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ method: req.method, mark: req.headers["x-mark"] ?? null }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      const host = actionHost();
      const plain = await host.fetch(`http://127.0.0.1:${port}/`);
      expect(await plain.json()).toEqual({ method: "GET", mark: null });
      const posted = await host.fetch(`http://127.0.0.1:${port}/`, { method: "POST", headers: { "x-mark": "m" } });
      expect(await posted.json()).toEqual({ method: "POST", mark: "m" });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("actionHost: run", () => {
  test("starts KEEL_COMMAND, split on white space, with the args after its own, in the cwd, under the given env", async () => {
    process.env.KEEL_COMMAND = `  ${process.execPath}   ${script}\techo `;
    const r = await actionHost().run(["session", "replay", "a b.json"], { PATH: process.env.PATH ?? "", ONLY: "this" });
    expect(r.code).toBe(0);
    const seen: unknown = JSON.parse(r.stdout);
    expect(seen).toMatchObject({ args: ["session", "replay", "a b.json"], env: { ONLY: "this" } });
    expect(seen).not.toHaveProperty("env.KEEL_COMMAND");
    expect(seen).toHaveProperty("cwd", fs.realpathSync(process.cwd()));
  });

  test("stdout is captured whole and the exit code returned; stderr goes on line by line, cleaned, as `keel: `", async () => {
    process.env.KEEL_COMMAND = `${process.execPath} ${script} stderr`;
    let result: { code: number; stdout: string } | undefined;
    const lines = await stderrOf(async () => {
      result = await actionHost().run([], {});
    });
    expect(result).toEqual({ code: 3, stdout: "out-1\nout-2\n" });
    expect(lines).toEqual(["keel: one\n", "keel: ::error::two!\n", `keel: ${"x".repeat(297)}...\n`, "keel: three\n"]);
  });

  test("a stderr line that arrives in two pieces is passed on once, whole", async () => {
    process.env.KEEL_COMMAND = `${process.execPath} ${script} split`;
    const lines = await stderrOf(() => actionHost().run([], {}));
    expect(lines).toEqual(["keel: first half\n", "keel: second\n"]);
  });

  test("a command that cannot start is code 127 with no output; a child ended by a signal is code 1", async () => {
    process.env.KEEL_COMMAND = path.join(dir, "no-such-binary");
    expect(await actionHost().run(["x"], {})).toEqual({ code: 127, stdout: "" });
    process.env.KEEL_COMMAND = `${process.execPath} ${script} killed`;
    expect(await actionHost().run([], {})).toEqual({ code: 1, stdout: "" });
  });

  test("the command is read when the host is made, not at each run", async () => {
    process.env.KEEL_COMMAND = `${process.execPath} ${script} echo`;
    const host = actionHost();
    process.env.KEEL_COMMAND = path.join(dir, "no-such-binary");
    expect((await host.run([], {})).code).toBe(0);
  });
});

describe("actionHost: read", () => {
  test("a file under the cwd is its text; a missing one is undefined", () => {
    const host = actionHost();
    expect(host.read("package.json")).toBe(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    expect(host.read("./src/../package.json")).toBe(host.read("package.json"));
    expect(host.read("no/such/file.json")).toBeUndefined();
  });

  test("nothing outside the cwd is read, by a relative or an absolute path", () => {
    const host = actionHost();
    const outside = path.join(dir, "secret.txt");
    fs.writeFileSync(outside, "secret");
    expect(host.read(outside)).toBeUndefined();
    expect(host.read(path.relative(process.cwd(), outside))).toBeUndefined();
    expect(host.read("../../package.json")).toBeUndefined();
    const sibling = `${process.cwd()}-sibling-${process.pid}`;
    fs.mkdirSync(sibling);
    try {
      fs.writeFileSync(path.join(sibling, "a.txt"), "sibling");
      expect(host.read(`../${path.basename(sibling)}/a.txt`)).toBeUndefined();
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true });
    }
  });
});
