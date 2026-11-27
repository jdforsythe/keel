// Spec: k.cli, clause "`keel dev` listens on 127.0.0.1 only, or on the Vite config's `server.host`."
// Seed: 1337 (no generated input: one `keel dev` per case).
// ASSUMPTIONS (spec names no fixture layout): the project is static-support's `staticTree` (a `static` deployable `site`), `keel dev --port <p>` on a free port from `freePort()` (the address `keel dev` binds, 127.0.0.1); the bound address is read by connecting, with no external program: a TCP connect to 127.0.0.1 on the port succeeds, and one to the machine's LAN address (a non-loopback IPv4 address) is refused when `keel dev` listens on 127.0.0.1 only and succeeds when it listens on every address. A `server.host` of `0.0.0.0` stands for the Vite config's host.
// The LAN half is skipped, with its reason stated, on a machine with no non-loopback IPv4 address.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { SLOW, connects, freePort, lanAddress, served, startDev, staticTree, stop, stopAll } from "./static-support.ts";

const dirs: string[] = [];
afterAll(async () => {
  await stopAll();
  for (const d of dirs) cleanup(d);
});
const viteWith = (server: string): string =>
  `import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()]${server} });\n`;
const lan = lanAddress();
const NO_LAN = "this machine has no non-loopback IPv4 address, so the LAN half cannot be asserted";
const reach = async (server: string): Promise<{ up: boolean; loopback: boolean; lan: boolean | undefined }> => {
  const dir = materialize({ ...staticTree("none"), ...(server === "" ? {} : { "vite.config.ts": viteWith(server) }) });
  dirs.push(dir);
  const port = await freePort();
  const dev = startDev(dir, port);
  try {
    const up = await served(dev, port);
    return {
      up,
      loopback: await connects("127.0.0.1", port),
      lan: lan === undefined ? undefined : await connects(lan, port),
    };
  } finally {
    await stop(dev);
  }
};

describe("k.cli: the address `keel dev` listens on", () => {
  it(
    "`keel dev` with no `server.host` listens on 127.0.0.1 only",
    async (ctx) => {
      const r = await reach("");
      expect(r.up).toBe(true);
      expect(r.loopback).toBe(true);
      if (r.lan === undefined) ctx.skip(NO_LAN);
      expect(r.lan).toBe(false);
    },
    fixedTime(SLOW),
  );

  it(
    "`keel dev` with `server.host` in the Vite config listens on that host: `0.0.0.0` is every address",
    async (ctx) => {
      const r = await reach(`, server: { host: "0.0.0.0" }`);
      expect(r.up).toBe(true);
      expect(r.loopback).toBe(true);
      if (r.lan === undefined) ctx.skip(NO_LAN);
      expect(r.lan).toBe(true);
    },
    fixedTime(SLOW),
  );

  it(
    "`server.host` `127.0.0.1` in the Vite config is the same as none: 127.0.0.1 only",
    async (ctx) => {
      const r = await reach(`, server: { host: "127.0.0.1" }`);
      expect(r.up).toBe(true);
      expect(r.loopback).toBe(true);
      if (r.lan === undefined) ctx.skip(NO_LAN);
      expect(r.lan).toBe(false);
    },
    fixedTime(SLOW),
  );
});
