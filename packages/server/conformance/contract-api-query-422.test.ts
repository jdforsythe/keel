// @vitest-environment happy-dom
// Spec: k.api, clause "An API GET whose `query` requires `q`, sent without it, answers 422 `keel.fields` at `query.q` and runs no loader; with a denying guard, 403 and `query` unread."
// k.api Requests: "After the guard it decodes `query` (fail: 422 `keel.fields`, issue paths prefixed `query`; nothing runs)." RFC 0157 Proposal 6: "match, params (fail: 404), guard (deny: 403), then `query` and `body` (fail: 422 `keel.fields`, issue paths prefixed `query` or `body`, no loader or action runs)." Seed 1337.
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, bodyOf, boot, get, postJson } from "./contract-support.ts";

const Query = s.object({ q: s.string() });
const Out = s.object({ n: s.int() });
const Body = s.object({ note: s.string() });
const Id = s.object({ id: s.int({ min: 0, max: 9 }) });
const Denied = s.error("keel.denied", s.object({}));

const c = contract("a", {
  "a.find": { method: "GET", path: "/api/find", query: Query, output: Out },
  "a.item": { method: "GET", path: "/api/item/:id", params: Id, query: Query, output: Out },
  "a.add": { method: "POST", path: "/api/add", body: Body, output: Out },
});
const calls = { find: 0, item: 0, add: 0, guard: 0, seen: "" };
const find = loader(c, "a.find", {}, async ({ search }) => {
  calls.find += 1;
  calls.seen = search.q;
  return ok({ n: search.q.length });
});
const item = loader(c, "a.item", {}, async () => {
  calls.item += 1;
  return ok({ n: 1 });
});
const add = action(c, "a.add", {}, () => {
  calls.add += 1;
  return ok({ n: 1 });
});
const watch = guard({}, async () => {
  calls.guard += 1;
  return ok(null);
});
const deny = guard({}, async () => {
  calls.guard += 1;
  return err(Denied.make({}));
});
const fresh = () => {
  calls.find = calls.item = calls.add = calls.guard = 0;
};
const open = manifest(c, {
  "a.find": { loader: find, guard: watch },
  "a.item": { loader: item },
  "a.add": { action: add },
});
const closed = manifest(c, {
  "a.find": { loader: find, guard: deny },
  "a.item": { loader: item },
  "a.add": { action: add },
});

describe("k.api query step", () => {
  it("A GET to an API entry whose `query` requires `q`, sent without it, answers 422 `keel.fields` with an issue at `query.q` and runs no loader", async () => {
    fresh();
    const app = await boot(open, ["a"]);
    const res = await app.fetch(get("/api/find"));
    expect(res.status).toBe(422);
    const text = await bodyOf(res);
    expect(text).toContain("keel.fields");
    expect(text).toContain("query.q");
    expect(calls.find).toBe(0);
    expect(calls.guard).toBe(1);
  });

  it("with `q` present the loader runs and gets it decoded", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), async (q) => {
        fresh();
        const app = await boot(open, ["a"]);
        const res = await app.fetch(get(`/api/find?q=${q}`));
        expect(res.status).toBe(200);
        expect(calls.seen).toBe(q);
        expect(calls.find).toBe(1);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("with a denying guard the answer is 403 `keel.denied`, not 422: `query` is not read", async () => {
    fresh();
    const app = await boot(closed, ["a"]);
    const res = await app.fetch(get("/api/find"));
    expect(res.status).toBe(403);
    expect(await bodyOf(res)).toContain("keel.denied");
    expect(calls.find).toBe(0);
  });

  it("the order is params (404), guard, then query: bad params with a bad query answer 404 and run no guard", async () => {
    fresh();
    const app = await boot(open, ["a"]);
    const res = await app.fetch(get("/api/item/notanumber"));
    expect(res.status).toBe(404);
    expect(calls.item).toBe(0);
  });

  it("a POST whose `body` fails answers 422 `keel.fields` with an issue path prefixed `body` and runs no action", async () => {
    fresh();
    const app = await boot(open, ["a"]);
    const res = await app.fetch(postJson("/api/add", { note: 5 }));
    expect(res.status).toBe(422);
    const text = await bodyOf(res);
    expect(text).toContain("keel.fields");
    expect(text).toContain("body.note");
    expect(calls.add).toBe(0);
  });

  it("a valid `body` runs the action once and answers 200 `{ ok: true }`", async () => {
    fresh();
    const app = await boot(open, ["a"]);
    const res = await app.fetch(postJson("/api/add", { note: "hi" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ ok: true }));
    expect(calls.add).toBe(1);
  });
});
