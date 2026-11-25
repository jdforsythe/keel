// The worker preload (node-fetch.mjs) run for real: fetches to a peer that resets each connection fail as
// rejections, and none escapes as an uncaught `setTypeOfService EINVAL`.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { testTime } from "../test-time.ts";

const preload = path.join(import.meta.dirname, "..", "node-fetch.mjs");
const script = path.join(import.meta.dirname, "..", "fixtures", "fetch-reset", "reset.mjs");

it("turns a reset during the socket's setup into a rejected fetch, never an uncaught error", () => {
  const r = spawnSync(process.execPath, ["--import", preload, script], { encoding: "utf8", timeout: testTime(60_000) });
  expect(r.status).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({ uncaught: 0, rejected: 10_000 });
}, 90_000);
