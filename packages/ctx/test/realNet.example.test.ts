// A real ctx's `net` against a peer that resets each connection as it is set up, in a plain `node` with no test
// preload: every request fails as a rejected fetch, a `TypeError` as a refused connection's is, and no error escapes
// the fetch (on macOS, Node's own `setTypeOfService` throws EINVAL there).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { expect, test } from "vitest";

const script = path.join(import.meta.dirname, "fixtures", "resetPeer.ts");

test("a reset during the connection's setup rejects the fetch as a refused connection does, never escapes it", () => {
  const env = { ...process.env, NODE_OPTIONS: undefined };
  const r = spawnSync(process.execPath, [script, "ctx", "250"], { encoding: "utf8", timeout: testTime(60_000), env });
  expect(r.stderr).toBe("");
  expect(r.status).toBe(0);
  const out: unknown = JSON.parse(r.stdout);
  expect(out).toMatchObject({ uncaught: [], answered: 0, refused: "TypeError:ECONNREFUSED" });
  const rejected = typeof out === "object" && out !== null && "rejected" in out ? out.rejected : null;
  const counts = typeof rejected === "object" && rejected !== null ? Object.entries(rejected) : [];
  expect(counts.reduce((n, [, c]) => n + Number(c), 0)).toBe(10_000);
  for (const [name] of counts) expect(name).toMatch(/^TypeError:(ECONNRESET|EPIPE)$/);
}, 90_000);
