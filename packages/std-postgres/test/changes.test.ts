// Seed 1337. `changed` and `follow` beyond their conformance: two ctxs on one `pglite:` folder share delivery, a stopped
// follow gets nothing, the key is the canonical JSON of the params at any depth, and E2460 explains itself.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { explain } from "@keel/check/explain";
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { database } from "@keel/std-postgres/server";
import type { FollowEvent } from "@keel/std-postgres/server";
import "@keel/std-postgres/tools";
import fc from "fast-check";
import { afterEach, beforeEach, expect, test } from "vitest";
import { canonicalJson } from "../src/server/internal/canonicalJson.ts";

const board = { name: "t.board", params: s.object({ b: s.string() }) };
const notes = database("t.changesDb", { migrations: { "./migrations/0001-init.sql": "select 1" } });
const before = process.env.KEEL_POSTGRES_URL;
let dir = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "keel-changes-"));
  process.env.KEEL_POSTGRES_URL = `pglite:${dir}`;
});
afterEach(() => {
  if (before === undefined) Reflect.deleteProperty(process.env, "KEEL_POSTGRES_URL");
  else process.env.KEEL_POSTGRES_URL = before;
  rmSync(dir, { recursive: true, force: true });
});

test("two ctxs on one pglite: folder: a change committed on one reaches a follow on the other; a stopped one gets nothing", async () => {
  const a = notes(createCtx({ mode: "real", seed: 1337 }));
  const b = notes(createCtx({ mode: "real", seed: 1338 }));
  const got: FollowEvent[] = [];
  const gone: FollowEvent[] = [];
  const stop = await b.follow(board, canonicalJson({ b: "x" }), (e) => got.push(e));
  const stopped = await b.follow(board, canonicalJson({ b: "x" }), (e) => gone.push(e));
  stopped();
  const r = await a.transaction(async (t) => t.changed(board, { b: "x" }));
  expect(r.ok).toBe(true);
  expect(got).toEqual([{ kind: "changed" }]);
  expect(gone).toEqual([]);
  stop();
});

test("canonicalJson gives one text for any key order, at any depth", () => {
  fc.assert(
    fc.property(fc.dictionary(fc.string({ maxLength: 4 }), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 5 }), (o) => {
      const reversed = Object.fromEntries(Object.entries(o).reverse());
      expect(canonicalJson(reversed)).toBe(canonicalJson(o));
      expect(JSON.parse(canonicalJson(o))).toEqual(JSON.parse(JSON.stringify(o)));
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("keel explain E2460 names std.postgres-changes and a fix", () => {
  const text = explain("E2460");
  expect(text).toContain("see: std.postgres-changes");
  expect(text).toContain("Fix:");
  expect(text.length).toBeLessThan(440);
});
