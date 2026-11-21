// @vitest-environment happy-dom
// Spec: k.contract, clause "A page action in its entry returning `ok(c.href('a.home'))` compiles unannotated; its document POST answers 303 to `/`."
// Seed 1337.
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, boot, form } from "./contract-support.ts";

const Edit = s.object({ note: s.string() });
const c = contract("a", {
  "a.home": { path: "/" },
  "a.new": { path: "/new" },
});
let seen = "";
// no annotation: `input` is typed from `decl`, the return from the entry; `c.href` needs no table
const create = action(c, "a.new", { input: Edit }, (input) => {
  seen = input.note;
  return ok(c.href("a.home"));
});
const page = (): Node => document.createElement("main");
const routes = manifest(c, { "a.home": { component: page }, "a.new": { component: page, POST: create } });

describe("k.contract page action over a document POST", () => {
  it("A page action in its entry returning `ok(c.href('a.home'))` answers a document POST with 303 to `/`", async () => {
    const app = await boot(routes, ["a"]);
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), async (note) => {
        const res = await app.fetch(form("/new", { note }, { accept: "text/html" }));
        expect(res.status).toBe(303);
        expect(new URL(res.headers.get("location") ?? "", "http://localhost").pathname).toBe("/");
        expect(seen).toBe(note);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("a runtime (JSON) POST to the page answers `ok` with the href `/`", async () => {
    const app = await boot(routes, ["a"]);
    const res = await app.fetch(form("/new", { note: "n" }, { accept: "application/json", "x-keel": "1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ ok: true, value: "/" }));
  });
});
