// Spec: k.deploy, clause "`node dist/<name>/server.mjs` of a `keel build` fixture answers its routes on `PORT`; with `KEEL_SECRET` unset or short it exits 1 and prints one E1560 line naming `KEEL_SECRET` and no value."
// Seed 1337 (fc.assert below). Spawns the built `server.mjs` of a `keel build` fixture.
// The listening wait is a bounded retry of `fetch` (no timers); the port is one the OS just freed.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildNodeFixture, deployEnv } from "./topology-build-fixture.ts";

let fixture = "";
beforeAll(() => {
  fixture = buildNodeFixture();
}, 90_000);
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });

describe("k.deploy: server.mjs", () => {
  test("`node dist/<name>/server.mjs` of a `keel build` fixture answers its routes on `PORT`; with `KEEL_SECRET` unset or short it exits 1 and prints one E1560 line naming `KEEL_SECRET` and no value.", async () => {
    const entry = path.join(fixture, "dist", "web", "server.mjs");
    expect(fs.existsSync(entry)).toBe(true);

    const port = await freePort();
    const child = spawn(process.execPath, [entry], {
      cwd: fixture,
      env: deployEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32) }),
      stdio: "ignore",
    });
    try {
      let status = 0;
      for (let i = 0; i < 4000 && status === 0; i++) {
        status = await fetch(`http://127.0.0.1:${port}/`).then(
          (r) => r.status,
          () => 0,
        );
      }
      expect(status).toBe(200);
    } finally {
      child.kill("SIGTERM");
    }

    await fc.assert(
      fc.property(fc.option(fc.stringMatching(/^[a-zA-Z0-9]{1,31}$/), { nil: undefined }), (secret) => {
        const r = spawnSync(process.execPath, [entry], {
          cwd: fixture,
          encoding: "utf8",
          env: deployEnv(secret === undefined ? {} : { KEEL_SECRET: secret }),
        });
        expect(r.status).toBe(1);
        const lines = `${r.stdout}${r.stderr}`.split("\n").filter((l) => l.includes("E1560"));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("KEEL_SECRET");
        if (secret !== undefined) expect(`${r.stdout}${r.stderr}`).not.toContain(secret);
      }),
      { seed: 1337, numRuns: 5 },
    );
  }, 30_000);
});
