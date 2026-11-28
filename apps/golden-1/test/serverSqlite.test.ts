// @vitest-environment node
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { cp, mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCtx } from "@keel/ctx";
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The production entry on `storage: 'sqlite'` (k.deploy Storage, std.db): a copy of the app is built with `keel build`
// in a temporary folder, and its `dist/api/server.mjs` serves on a SQLite file in another, never in the repo tree.
const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", "dist", "reports", ".keel-dev", ".turbo"]);
const SECRET = "golden-1 sqlite test secret, 32 bytes or more";
const BOARD_KEY = "keel.store.api.board";
// The test talks to a real process: a real ctx gives it the clock and the network.
const ctx = createCtx({ mode: "real" });

let dir = "";
let built = "";
const children: ChildProcess[] = [];

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a !== null ? a.port : 0;
      s.close(() => resolve(port));
    });
  });

type Proc = { lines: string[]; exited: Promise<number | null>; stop(): void };
function serve(port: number, url: string): Proc {
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", join(built, "dist/api/server.mjs")], {
    cwd: built,
    env: { ...process.env, PORT: String(port), KEEL_SECRET: SECRET, KEEL_DATABASE_URL: url, KEEL_FORMAT: "" },
    stdio: "pipe",
  });
  children.push(child);
  const lines: string[] = [];
  child.stdout?.on("data", (b) => lines.push(...String(b).split("\n").filter(Boolean)));
  child.stderr?.on("data", (b) => lines.push(...String(b).split("\n").filter(Boolean)));
  const exited = new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  return { lines, exited, stop: () => child.kill("SIGTERM") };
}

async function until(pred: () => boolean): Promise<boolean> {
  for (let i = 0; i < 100 && !pred(); i++) await ctx.clock.after(100);
  return pred();
}

/** One request to the served process through the real ctx's network. */
const call = (url: string, init?: RequestInit): Promise<Response> => ctx.net.fetch(new Request(url, init));

const json = { accept: "application/json", "content-type": "application/json", "x-keel": "1" };

beforeAll(async () => {
  dir = tempDir("golden-1-sqlite-");
  built = join(dir, "app");
  await cp(app, built, { recursive: true, filter: (src) => src === app || !SKIP.has(basename(src)) });
  // The copy's packages are links to the app's. A tool launcher finds its package relative to its own path, which a
  // linked directory would change, so each launcher in the copy calls the app's launcher by its real path.
  const modules = join(app, "node_modules");
  await mkdir(join(built, "node_modules", ".bin"), { recursive: true });
  for (const name of await readdir(modules))
    if (name !== ".bin") await symlink(join(modules, name), join(built, "node_modules", name));
  // `keel build` checks first, test files included: their `vitest` resolves from the workspace root, as in the app.
  await symlink(join(app, "..", "..", "node_modules", "vitest"), join(built, "node_modules", "vitest"));
  for (const name of await readdir(join(modules, ".bin")).catch(() => []))
    await writeFile(
      join(built, "node_modules", ".bin", name),
      `#!/bin/sh\nexec "${join(modules, ".bin", name)}" "$@"\n`,
      {
        mode: 0o755,
      },
    );
  const keel = join(app, "node_modules", ".bin", "keel");
  const out = await new Promise<string>((resolve, reject) =>
    execFile(keel, ["build"], { cwd: built, env: { ...process.env, KEEL_AGENT: "1" } }, (e, stdout) =>
      e === null ? resolve(String(stdout)) : reject(new Error(`keel build failed: ${String(stdout)}`)),
    ),
  );
  expect(out).toMatch(/^ok build/m);
}, fixedTime(120_000));

afterAll(async () => {
  for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
  if (dir !== "") await rm(dir, { recursive: true, force: true });
});

describe("dist/api/server.mjs on storage 'sqlite'", () => {
  it(
    "serves the board from a SQLite file, keeps it across a restart, and exits 0 on SIGTERM",
    async () => {
      const file = join(dir, "keel.sqlite");
      const url = pathToFileURL(file).href;
      const port = await freePort();
      const base = `http://127.0.0.1:${port}`;
      const first = serve(port, url);
      try {
        expect(await until(() => first.lines.some((l) => l.startsWith("ok listening")))).toBe(true);
        const posted = await call(`${base}/api/lists`, {
          method: "POST",
          headers: json,
          body: JSON.stringify({ name: "Home", write: { key: "w1", base: 0, owner: "" } }),
        });
        expect(posted.status).toBe(200);
        const lists = await (await call(`${base}/api/lists`, { headers: { accept: "application/json" } })).json();
        expect(lists.results["api.lists"].value.lists.map((l: { name: string }) => l.name)).toEqual(["Home"]);
      } finally {
        first.stop();
      }
      expect(await first.exited).toBe(0);
      expect(first.lines.join("\n")).not.toContain(url);

      // The file holds the board's snapshot under its storage key, as std.db's `keel_kv` table.
      const db = new DatabaseSync(file, { readOnly: true });
      const row = db.prepare("select value from keel_kv where key = ?").get(BOARD_KEY);
      const layout = db.prepare("select value from keel_meta where name = 'layout'").get();
      db.close();
      const stored = typeof row?.value === "string" ? row.value : "";
      expect(JSON.parse(stored).state.lists.map((l: { name: string }) => l.name)).toEqual(["Home"]);
      expect(layout?.value).toBe("1");

      const second = serve(port, url);
      try {
        expect(await until(() => second.lines.some((l) => l.startsWith("ok listening")))).toBe(true);
        const again = await (await call(`${base}/api/lists`, { headers: { accept: "application/json" } })).json();
        expect(again.results["api.lists"].value.lists.map((l: { name: string }) => l.name)).toEqual(["Home"]);
      } finally {
        second.stop();
      }
      expect(await second.exited).toBe(0);
    },
    fixedTime(60_000),
  );

  it(
    "exits 1 with one E2153 naming KEEL_DATABASE_URL and no part of it when the file cannot be opened",
    async () => {
      const url = pathToFileURL(join(dir, "missing", "folder", "keel.sqlite")).href;
      const p = serve(await freePort(), url);
      expect(await p.exited).toBe(1);
      const diags = p.lines.filter((l) => l.startsWith("E2153"));
      expect(diags).toHaveLength(1);
      expect(diags[0]).toContain("KEEL_DATABASE_URL");
      expect(p.lines.join("\n")).not.toContain("missing");
    },
    fixedTime(30_000),
  );
});
