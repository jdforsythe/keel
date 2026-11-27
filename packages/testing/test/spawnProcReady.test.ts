// @vitest-environment node
// Readiness of a process `serve` runs (k.e2e-run Time: 20 s for a deployable to answer): a server that writes its
// listen record and gives its first answer to `GET /` after 6 s (a cold first request: its database opened on first
// use) is ready, as is one that resets the first connection and answers the next; one that never answers is E1737's
// `no HTTP answer` cause at the bound.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterEach, describe, expect, it } from "vitest";
import type { Proc } from "../src/internal/e2e/Proc.ts";
import { spawnProc } from "../src/internal/e2e/spawnProc.ts";

/** A node server on `PORT` that writes its json listen record; `first` is how it meets the first `GET /`. */
const SERVER = (first: "slow" | "reset" | "never"): string => `
import { createServer } from "node:http";
let seen = 0;
const server = createServer((req, res) => {
  seen++;
  if (${JSON.stringify(first)} === "never") return;
  if (${JSON.stringify(first)} === "reset" && seen === 1) return req.socket.destroy();
  const wait = ${JSON.stringify(first)} === "slow" && seen === 1 ? 6000 : 0;
  setTimeout(() => res.end("ok"), wait);
});
server.listen(Number(process.env.PORT), "127.0.0.1", () =>
  console.log(JSON.stringify({ kind: "summary", name: "listen", port: Number(process.env.PORT) })),
);
`;

const procs: Proc[] = [];
afterEach(async () => {
  for (const p of procs.splice(0)) await p.kill();
});

function proc(first: "slow" | "reset" | "never", readyMs: number): Proc {
  const dir = tempDir("keel-spawn-ready-");
  const file = join(dir, "server.mjs");
  writeFileSync(file, SERVER(first));
  const p = spawnProc({
    name: "web",
    cwd: dir,
    args: () => [file],
    env: (port) => ({ PORT: String(port) }),
    readyMs,
    waitListen: true,
  });
  procs.push(p);
  return p;
}

describe("spawnProc readiness", () => {
  it(
    "a first answer 6 s after the listen record, inside the 20 s bound, is ready",
    async () => {
      const p = proc("slow", 20_000);
      await expect(p.start()).resolves.toBeUndefined();
      expect(p.running()).toBe(true);
    },
    fixedTime(30_000),
  );

  it(
    "a reset first connection is asked again and the next answer is ready",
    async () => {
      await expect(proc("reset", 20_000).start()).resolves.toBeUndefined();
    },
    fixedTime(30_000),
  );

  it(
    "no answer by the bound is `no HTTP answer to GET /`",
    async () => {
      await expect(proc("never", 1_500).start()).rejects.toThrow("no HTTP answer to GET / within 1.5s");
    },
    fixedTime(30_000),
  );
});
