// Spec: k.cli, clause "`keel dev` listens on 127.0.0.1 only, or on the Vite config's `server.host`."
// Seed: 1337 (no generated input: one `keel dev` per case).
// ASSUMPTIONS (spec names no fixture layout): the project is static-support's `staticTree` (a `static` deployable `site`), `keel dev --port <p>` on a free port from `freePort()` (the address `keel dev` binds, 127.0.0.1); the bound address is read from the machine's listening sockets with `lsof` (`listeningOn`, static-support.ts), which names the wildcard `*`. A `server.host` of `0.0.0.0` stands for the Vite config's host; "127.0.0.1 only" is read as every listener on the port being bound to 127.0.0.1.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { SLOW, freePort, listeningOn, served, startDev, staticTree, stop, stopAll } from "./static-support.ts";

const dirs: string[] = [];
afterAll(async () => {
  await stopAll();
  for (const d of dirs) cleanup(d);
});
const viteWith = (server: string): string =>
  `import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()]${server} });\n`;
const addressesOf = async (server: string): Promise<{ up: boolean; at: string[] }> => {
  const dir = materialize({ ...staticTree("none"), ...(server === "" ? {} : { "vite.config.ts": viteWith(server) }) });
  dirs.push(dir);
  const port = await freePort();
  const dev = startDev(dir, port);
  try {
    const up = await served(dev, port);
    return { up, at: listeningOn(port) };
  } finally {
    await stop(dev);
  }
};

describe("k.cli: the address `keel dev` listens on", () => {
  it(
    "`keel dev` with no `server.host` listens on 127.0.0.1 only",
    async () => {
      const r = await addressesOf("");
      expect(r.up).toBe(true);
      expect(r.at).toEqual(["127.0.0.1"]);
    },
    fixedTime(SLOW),
  );

  it(
    "`keel dev` with `server.host` in the Vite config listens on that host: `0.0.0.0` is every address",
    async () => {
      const r = await addressesOf(`, server: { host: "0.0.0.0" }`);
      expect(r.up).toBe(true);
      expect(r.at).toEqual(["*"]);
    },
    fixedTime(SLOW),
  );

  it(
    "`server.host` `127.0.0.1` in the Vite config is the same as none: 127.0.0.1 only",
    async () => {
      const r = await addressesOf(`, server: { host: "127.0.0.1" }`);
      expect(r.up).toBe(true);
      expect(r.at).toEqual(["127.0.0.1"]);
    },
    fixedTime(SLOW),
  );
});
