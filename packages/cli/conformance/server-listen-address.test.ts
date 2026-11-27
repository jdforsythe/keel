// Spec: k.deploy, clause "`node dist/<name>/server.mjs` of a `keel build` fixture listens on every address on `PORT`: its server's bound address is `::` or `0.0.0.0`."
// Seed: 1337 (no generated input: one `keel build`, one server).
// ASSUMPTIONS (spec names no fixture layout): static-support's `staticTree` with a `node` deployable `site`; `server.mjs` runs on a free port probed where it binds (`freePort("all")`, inside `withServer`) with `PORT` and a 32-byte `KEEL_SECRET`; the bound address is read from the machine's listening sockets with `lsof` (`listeningOn`), which names `::` and `0.0.0.0` alike `*`.
import { fixedTime } from "@keel/tooling/test-time";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, keel, materialize } from "./compat-support.ts";
import { SLOW, listeningOn, staticTree, withServer } from "./static-support.ts";

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
    async () => {
      expect(built).toBe(0);
      let at: string[] = [];
      await withServer(dir, "site", async (port) => {
        at = listeningOn(port);
      });
      expect(at).toEqual(["*"]);
    },
    fixedTime(SLOW),
  );
});
