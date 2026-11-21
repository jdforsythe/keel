// Spec: std.report, clause "In a project whose module lists `@keel/std-report` in `deps`, `keel report` loads the tools entry itself and prints the tallies."
// Seed 1337
// Runs the real binary in a subprocess so the command slot starts empty; an http server in this process answers the inspect document.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tallyOf } from "@keel/std-report";
import { afterEach, expect, test } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BIN = path.join(repo, "packages/cli/src/bin.ts");

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const project = (deps: string[]): string => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "keel-report-deps-"));
  tmps.push(tmp);
  fs.mkdirSync(path.join(tmp, "modules/a"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "modules/a/module.ts"),
    `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
      id: "a",
      deps,
      capabilities: [],
      public: { exports: [] },
    })})\n`,
  );
  fs.mkdirSync(path.join(tmp, "node_modules/@keel"), { recursive: true });
  for (const p of ["std-report", "schema", "cli"]) {
    fs.symlinkSync(path.join(repo, "packages", p), path.join(tmp, "node_modules/@keel", p));
  }
  return tmp;
};

const serve = (body: unknown): Promise<http.Server> =>
  new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(body));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });

const keel = (cwd: string, args: string[]): Promise<{ code: number | null; stdout: string }> =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd,
      env: { ...process.env, KEEL_AGENT: "1" },
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (c: string) => {
      stdout += c;
    });
    child.on("close", (code) => resolve({ code, stdout }));
  });

test("In a project whose module lists `@keel/std-report` in `deps`, `keel report` loads the tools entry itself and prints the tallies.", async () => {
  const a = tallyOf("orders.status", ["paid", "open", "paid", "paid"]);
  const b = tallyOf("orders.region", ["eu", "us", "eu"]);
  const server = await serve({
    live: true,
    graph: { nodes: [], edges: [] },
    stores: {},
    ids: {},
    a11y: {},
    routes: {},
    sections: { [a.id]: { doc: "t", value: a }, [b.id]: { doc: "t", value: b } },
  });
  try {
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("no port");
    const { port } = addr;
    const r = await keel(project(["@keel/std-report"]), ["report", `http://127.0.0.1:${port}`, "--format=compact"]);
    expect(r.code, r.stdout).toBe(0);
    expect(r.stdout.split("\n").filter((l) => l !== "")).toEqual([
      "orders.region eu=2 us=1",
      "orders.status paid=3 open=1",
      "ok report 2 tallies",
    ]);
  } finally {
    server.close();
  }
}, 120_000);
