// std.multi: a group's project host is shared by the process and keeps it alive only while it starts or a request
// waits on it. A child process starts the host for the conformance fixture's user module and waits on it alone, so the
// host must hold the process open until its dev server is up; then the child has nothing left to do and must end on
// its own, well before the host would.
// Seed 7 (no random inputs)
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixedTime } from "@keel/tooling/test-time";
import { expect, test } from "vitest";
import { USER } from "../conformance/group-fixtures.ts";

const tsx = pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href;
const server = new URL("../src/group/internal/projectServer.ts", import.meta.url).href;
/** Bounds the child's run: the host's start, then the exit that must follow it. */
const CHILD_MS = fixedTime(60_000);

test(
  "a process whose project host is up and that has nothing else to do exits by itself",
  async () => {
    const code = [
      `const { projectServer } = await import(${JSON.stringify(server)});`,
      `await projectServer(${JSON.stringify(USER)});`,
      "process.stdout.write('up');",
    ].join("\n");
    const ended = await new Promise<{ killed: boolean; out: string }>((resolve) => {
      const c = execFile(
        process.execPath,
        ["--import", tsx, "--input-type=module", "-e", code],
        { cwd: fileURLToPath(new URL("..", import.meta.url)), timeout: CHILD_MS },
        (_err, stdout) => resolve({ killed: c.killed, out: String(stdout) }),
      );
    });
    expect(ended).toEqual({ killed: false, out: "up" });
  },
  CHILD_MS + fixedTime(10_000),
);
