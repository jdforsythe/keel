// @vitest-environment happy-dom
// k.api Requests, "`accept: text/event-stream` on an entry that is not live: 406 after the guard and before `query`, so a denial is 403 first."
// Seed 1337 (fc.assert below).
import { guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, boot, get } from "./contract-support.ts";

const Query = s.object({ q: s.string() });
const Out = s.object({ n: s.int() });
const Denied = s.error("keel.denied", s.object({}));
const c = contract("a", { "a.find": { method: "GET", path: "/api/find", query: Query, output: Out } });
const calls = { loader: 0, guard: 0 };
const find = loader(c, "a.find", {}, async () => {
  calls.loader += 1;
  return ok({ n: 1 });
});
const allow = guard({}, async () => {
  calls.guard += 1;
  return ok(null);
});
const deny = guard({}, async () => {
  calls.guard += 1;
  return err(Denied.make({}));
});
const STREAM = { accept: "text/event-stream" };
const query = fc.oneof(fc.constant(""), fc.constant("?q=x"), fc.constant("?other=1"), fc.constant("?q"));

describe("k.api: an event-stream request to an entry that is not live", () => {
  it("with a denying guard, `accept: text/event-stream` answers 403, whatever the query, and runs no loader", async () => {
    const app = await boot(manifest(c, { "a.find": { loader: find, guard: deny } }), ["a"]);
    await fc.assert(
      fc.asyncProperty(query, async (qs) => {
        calls.loader = calls.guard = 0;
        const res = await app.fetch(get(`/api/find${qs}`, STREAM));
        expect(res.status, qs).toBe(403);
        expect(await res.text()).toContain("keel.denied");
        expect(calls.guard).toBe(1);
        expect(calls.loader).toBe(0);
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  it("with a guard that passes, `accept: text/event-stream` answers 406 before `query` is decoded: a missing `q` is 406, not 422, and no loader runs", async () => {
    const app = await boot(manifest(c, { "a.find": { loader: find, guard: allow } }), ["a"]);
    await fc.assert(
      fc.asyncProperty(query, async (qs) => {
        calls.loader = calls.guard = 0;
        const res = await app.fetch(get(`/api/find${qs}`, STREAM));
        expect(res.status, qs).toBe(406);
        expect(calls.guard).toBe(1);
        expect(calls.loader).toBe(0);
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  it("without `accept: text/event-stream`, the same missing `q` is 422 (the 406 is the stream request's alone)", async () => {
    const app = await boot(manifest(c, { "a.find": { loader: find, guard: allow } }), ["a"]);
    const res = await app.fetch(get("/api/find"));
    expect(res.status).toBe(422);
  });
});
