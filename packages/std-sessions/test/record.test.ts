import { inspectors } from "@keel/compiler/inspect/inspectors";
// @vitest-environment happy-dom
// `record` (std.sessions; rfc:0070 §4): one per ctx, stop() idempotent, upload on the first error only, redaction of
// each subject, and the `sessions.live` inspect section. Seed 1337
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button, Input } from "@keel/ui";
import { describe, expect, test } from "vitest";
import { Session, record, session } from "../src/index.ts";

function build() {
  const memo = store(s.object({ note: s.string() }), { note: "" }, { id: "memo" });
  const save = transaction(memo, "memo.save", s.object({ note: s.string(), pin: s.string() }), (st, p) => ({
    ...st,
    note: p.note,
  }));
  const routes = manifest({
    "memo.show": {
      path: "/memo/:id",
      params: s.object({ id: s.string() }),
      search: s.object({ q: s.string().optional() }),
      component(): Node {
        return Box({
          as: "main",
          id: "memo.page",
          children: [
            Input({ id: "memo.note", label: "Note", onInput: (v) => void tx(save, { note: v, pin: "1234" }) }),
            Button({
              id: "memo.crash",
              children: "Crash",
              onClick: () => {
                throw new Error("crash");
              },
            }),
          ],
        });
      },
    },
  });
  return { memo, save, routes };
}
let made: ReturnType<typeof build> | undefined;
const fixture = (): ReturnType<typeof build> => {
  if (made !== undefined) return made;
  const out: ReturnType<typeof build>[] = [];
  scope(() => void out.push(build()));
  const [first] = out;
  if (first === undefined) throw new Error("fixture");
  made = first;
  return first;
};

async function run(redact: readonly string[], upload?: URL) {
  const { memo, routes } = fixture();
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  bindStd(ctx, { "@keel/std-sessions": { memo: { redact: [...redact] } } });
  const rec = record(ctx, upload === undefined ? {} : { upload });
  const h = await renderRoute("memo.show", {
    routes,
    params: { id: "m-42" },
    search: { q: "needle" },
    state: [[memo, { note: "hidden-base" }]],
    ctx,
  });
  return { ctx, rec, h };
}

describe("record", () => {
  test("a second record(ctx) returns the active recorder; after stop() a new one starts; stop() is idempotent", async () => {
    const { ctx, rec, h } = await run([]);
    expect(record(ctx, { limit: 1 })).toBe(rec);
    const a = rec.stop();
    expect(rec.stop()).toBe(a);
    expect(record(ctx)).not.toBe(rec);
    h.dispose();
  });

  test("the base is the first navigation: route id, encoded params and search, and every store's state", async () => {
    const { rec, h } = await run([]);
    const out = rec.stop();
    expect(out.route).toEqual({ id: "memo.show", params: { id: "m-42" }, search: { q: "needle" } });
    expect(out.state.memo).toEqual({ note: "hidden-base" });
    expect(Session.parse(Session.encode(out)).ok).toBe(true);
    h.dispose();
  });

  test("tx:, store:, route: and el: entries redact", async () => {
    const redact = [
      "tx:memo.save#note",
      "tx:memo.save#pin",
      "store:memo#note",
      "route:memo.show#params.id",
      "route:memo.show#search.q",
    ];
    const { rec, h } = await run([...redact, "el:memo.note#value"]);
    await h.fire("memo.note", { type: "input", value: "typed-secret" });
    const out = rec.stop();
    const text = JSON.stringify(Session.encode(out));
    for (const v of ["typed-secret", "hidden-base", "m-42", "needle", "1234", "[secret]"])
      expect(text).not.toContain(v);
    const save = out.events.find((e) => e.kind === "tx");
    expect(save?.kind === "tx" && fixture().save.schema.parse(save.payload).ok).toBe(true);
    const fire = out.events.find((e) => e.kind === "fire");
    expect(fire?.kind === "fire" && fire.event).toEqual({ type: "input", value: "x".repeat("typed-secret".length) });
    h.dispose();
  });

  test("without entries values are kept (recording is on by default)", async () => {
    const { rec, h } = await run([]);
    await h.fire("memo.note", { type: "input", value: "plain" });
    const text = JSON.stringify(Session.encode(rec.stop()));
    expect(text).toContain("plain");
    expect(text).toContain("1234");
    h.dispose();
  });

  test("an error is recorded and fingerprinted unredacted; error: entries mask its data; upload puts the session so far", async () => {
    const upload = new URL("https://example.test/sessions");
    const { ctx, rec, h } = await run(["error:keel.unexpected#data.at"], upload);
    await h.fire("memo.crash", { type: "click" }).catch(() => undefined);
    expect(rec.errors().map((e) => e.code)).toEqual(["keel.unexpected"]);
    expect(rec.errors()[0]?.data).toMatchObject({ at: "memo.crash" });
    const out = rec.stop();
    expect(out.error?.code).toBe("keel.unexpected");
    expect(JSON.stringify(out.error)).not.toContain("memo.crash");
    expect(session(ctx).taken()).toHaveLength(1);
    expect(session(ctx).taken()[0]?.url).toBe(upload);
    expect(session(ctx).taken()[0]?.session.error?.code).toBe("keel.unexpected");
    expect(out.fingerprint).toMatch(/^[0-9a-f]{12}$/);
    h.dispose();
  });

  test("the sessions.live section reads the session so far, null once stopped", async () => {
    const { ctx, rec, h } = await run([]);
    const live = inspectors.get("sessions.live");
    expect(live).toBeDefined();
    const now = live?.read(ctx);
    expect(Session.parse(now).ok).toBe(true);
    rec.stop();
    expect(live?.read(ctx)).toBeNull();
    h.dispose();
  });

  test("past limit the buffer holds at most limit events", async () => {
    const { ctx, h } = await run([]);
    const rec = record(ctx);
    rec.stop();
    const small = record(ctx, { limit: 2 });
    for (const v of ["a", "b", "c", "d"]) await h.fire("memo.note", { type: "input", value: v });
    expect(small.events().length).toBeLessThanOrEqual(2);
    small.stop();
    h.dispose();
  });
});
