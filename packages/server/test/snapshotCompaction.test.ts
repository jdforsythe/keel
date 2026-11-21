// k.server Server state with k.store Log limit (RFC 0054, backlog 0131): a stored snapshot is parsed once per stored
// version, not per request; a pre-0054 snapshot (any log length, a raw token in `meta.caller`) still loads, is left
// byte-identical until a save, and that save keeps the latest 256 entries with the older ones folded into `initial`.
import { s } from "@keel/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KEY, counterApp, fakeStorage, storedN, viewOf } from "./saveFixture.ts";

const Stored = s.object({
  state: s.object({ n: s.number() }),
  initial: s.object({ n: s.number() }),
  log: s.array(s.object({ id: s.number() })),
});

/** A pre-0054 snapshot of `test.count` after `n` increments, every entry carrying a raw caller token. */
function legacy(n: number): string {
  const log = Array.from({ length: n }, (_, i) => ({
    name: "test.inc",
    payload: {},
    at: i + 1,
    id: i + 1,
    meta: { caller: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  }));
  return JSON.stringify({ state: { n }, log, initial: { n: 0 } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stored snapshots (RFC 0054)", () => {
  it("parses a stored snapshot once per version, however many requests restore it", async () => {
    const fake = fakeStorage();
    const raw = legacy(3);
    fake.data.set(KEY, raw);
    const parse = vi.spyOn(JSON, "parse");
    const app = counterApp(fake.storage);
    for (let i = 0; i < 4; i += 1) expect(await app.view()).toMatchObject(viewOf(3));
    expect(parse.mock.calls.filter(([text]) => text === raw)).toHaveLength(1);
    expect((await app.inc()).status).toBe(200);
    const saved = fake.data.get(KEY);
    for (let i = 0; i < 3; i += 1) expect(await app.view()).toMatchObject(viewOf(4));
    expect(parse.mock.calls.filter(([text]) => text === saved)).toHaveLength(1);
  });

  it("a pre-0054 snapshot of 300 entries loads unchanged; the next save keeps 256 and folds the rest", async () => {
    const fake = fakeStorage();
    const raw = legacy(300);
    fake.data.set(KEY, raw);
    const app = counterApp(fake.storage);
    expect(await app.view()).toMatchObject(viewOf(300));
    expect(fake.data.get(KEY)).toBe(raw);
    expect((await app.inc()).status).toBe(200);
    expect(storedN(fake.data)).toBe(301);
    const stored = Stored.parse(JSON.parse(fake.data.get(KEY) ?? "null"));
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value.log.map((e) => e.id)).toEqual(Array.from({ length: 256 }, (_, i) => i + 46));
    expect(stored.value.initial).toEqual({ n: 45 });
    expect(await app.view()).toMatchObject(viewOf(301));
  });
});
