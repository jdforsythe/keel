// Spec: k.deploy, clause "`node dist/<name>/server.mjs` of a `keel build` fixture listens on every address on `PORT`: its server's bound address is `::` or `0.0.0.0`."
// Seed: 1337 (no generated input: one `keel build`, one server).
// ASSUMPTIONS (spec names no fixture layout): static-support's `staticTree` with a `node` deployable `site`; `server.mjs` runs on a free port probed where it binds (`freePort("all")`, inside `withServer`) with `PORT` and a 32-byte `KEEL_SECRET`; the bound address is read by connecting, with no external program: a TCP connect to 127.0.0.1 on `PORT` succeeds and so does one to the machine's LAN address (a non-loopback IPv4 address), which only a server bound to every address answers. The LAN half is skipped, with its reason stated, on a machine with no non-loopback IPv4 address.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, keel, materialize } from "./compat-support.ts";
import { SLOW, connects, lanAddress, staticTree, withServer } from "./static-support.ts";

let dir = "";
let built: number | null = null;
beforeAll(() => {
  dir = materialize(staticTree("none", undefined, "node"));
  built = keel(dir, ["build"]).status;
}, SLOW);
afterAll(() => {
  if (dir !== "") cleanup(dir);
});

describe("k.deploy: the address `server.mjs` listens on", () => {
  it(
    "`node dist/<name>/server.mjs` of a `keel build` fixture listens on every address on `PORT`: its server's bound address is `::` or `0.0.0.0`",
    async (ctx) => {
      expect(built).toBe(0);
      const lan = lanAddress();
      let loopback = false;
      let other: boolean | undefined;
      await withServer(dir, "site", async (port) => {
        loopback = await connects("127.0.0.1", port);
        other = lan === undefined ? undefined : await connects(lan, port);
      });
      expect(loopback).toBe(true);
      if (other === undefined)
        ctx.skip("this machine has no non-loopback IPv4 address, so the LAN half cannot be asserted");
      expect(other).toBe(true);
    },
    fixedTime(SLOW),
  );
});
