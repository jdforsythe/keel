// Spec: k.topology, clause "`keel dev` accepts a connection on `127.0.0.1` and refuses one on the machine's other addresses; with `server.host: true` in the Vite config it prints one E1560 line naming `server.host`, listens on no port and exits 1."
// Spec: k.topology, clause "`keel dev --host 0.0.0.0` accepts a page request on the machine's LAN address and prints one W1569 line naming the addresses it listens on; `GET /__keel/inspect` from the LAN address answers 403 `keel.denied` with `Host: localhost:<port>` too, and from `127.0.0.1` answers the inspect document."
// Spec: k.topology, clause "`keel dev --host nope` prints one E1560 line naming `--host`, listens on no port and exits 1; `keel dev` without `--host` prints no W1569."
// Seed: n/a (no generated input). Method: the real `keel dev` as a child process over a temp project (boundary-support.ts's `nodeTree`) on a free port, its output in json (one record a line).
// The cases that connect to the machine's other addresses use `os.networkInterfaces()`'s first non-loopback IPv4 address (bind-support.ts `LAN`): on a machine with none they do not run, and say so below (`LAN === undefined`); the loopback and diagnostic halves run everywhere.
// ASSUMED: (1) the W1569 line names the addresses by holding the LAN address (or `0.0.0.0` and `127.0.0.1`); (2) a "page request" is `GET /` answered with any HTTP status (the fixture has no page at `/`); (3) a request from "the LAN address" is a connection made to that address, whose remote address the server sees is the machine's own non-loopback one;
// (4) "refuses one" is a failed TCP connection; (5) the inspect document is read at `127.0.0.1` with `Host: localhost:<port>` and is JSON holding `graph`.
import { realpathSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { write } from "./compat-support.ts";
import { cleanup, materialize, nodeTree } from "./boundary-support.ts";
import { BIN, LAN, accepts, exitCode, get, start, stopAll, up } from "./bind-support.ts";

let plain = "";
let wide = "";
beforeAll(() => {
  plain = realpathSync(materialize({ ...nodeTree("node") }));
  wide = realpathSync(materialize({ ...nodeTree("node") }));
  write(wide, {
    "vite.config.ts":
      'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ server: { host: true }, plugins: [keel()] });\n',
  });
});
afterAll(() => {
  cleanup(plain);
  cleanup(wide);
});
afterEach(stopAll);

const dev = (cwd: string, extra: string[] = []) =>
  start((port) => [BIN, "dev", "--port", String(port), ...extra, "--format=json"], cwd);
const lines = (out: string, code: string): string[] => out.split("\n").filter((l) => l.includes(code));

describe("k.topology dev listens on loopback", () => {
  it("`keel dev` accepts a connection on `127.0.0.1` and refuses one on the machine's other addresses; with `server.host: true` in the Vite config it prints one E1560 line naming `server.host`, listens on no port and exits 1.", async () => {
    const p = await dev(plain);
    await up(p);
    expect(await accepts("127.0.0.1", p.port)).toBe(true);
    if (LAN !== undefined) expect(await accepts(LAN, p.port), `connect ${LAN}`).toBe(false);
    expect(lines(p.out(), "W1569")).toEqual([]);
    const w = await dev(wide);
    expect(await exitCode(w), w.out()).toBe(1);
    const e = lines(w.out(), "E1560");
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("server.host");
    expect(await accepts("127.0.0.1", w.port)).toBe(false);
    if (LAN !== undefined) expect(await accepts(LAN, w.port)).toBe(false);
  }, 600_000);

  it.skipIf(LAN === undefined)(
    "`keel dev --host 0.0.0.0` accepts a page request on the machine's LAN address and prints one W1569 line naming the addresses it listens on; `GET /__keel/inspect` from the LAN address answers 403 `keel.denied` with `Host: localhost:<port>` too, and from `127.0.0.1` answers the inspect document.",
    async () => {
      const lan = LAN ?? "";
      const p = await dev(plain, ["--host", "0.0.0.0"]);
      await up(p, lan);
      const page = await get(lan, p.port, "/");
      expect(page, p.out()).toBeDefined();
      const warn = lines(p.out(), "W1569");
      expect(warn, p.out()).toHaveLength(1);
      expect(warn[0]).toMatch(new RegExp(`${lan.replaceAll(".", "\\.")}|0\\.0\\.0\\.0`));
      const headers = { host: `localhost:${p.port}`, accept: "application/json" };
      const viaLan = await get(lan, p.port, "/__keel/inspect", headers);
      expect(viaLan?.status).toBe(403);
      expect(viaLan?.body).toContain("keel.denied");
      const viaLoopback = await get("127.0.0.1", p.port, "/__keel/inspect", headers);
      expect(viaLoopback?.status).toBe(200);
      expect(viaLoopback?.body).toContain("graph");
    },
    600_000,
  );

  it("`keel dev --host nope` prints one E1560 line naming `--host`, listens on no port and exits 1; `keel dev` without `--host` prints no W1569.", async () => {
    const p = await dev(plain, ["--host", "nope"]);
    expect(await exitCode(p), p.out()).toBe(1);
    const e = lines(p.out(), "E1560");
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("--host");
    expect(await accepts("127.0.0.1", p.port)).toBe(false);
    const plainRun = await dev(plain);
    await up(plainRun);
    expect(lines(plainRun.out(), "W1569")).toEqual([]);
  }, 600_000);
});
