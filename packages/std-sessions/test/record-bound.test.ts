// @vitest-environment happy-dom
// `record` bounds: the session JSON stays within 192 KiB however long the inputs, `errors()` keeps the
// first and last 32, and a rejected upload is recorded as its `sessions.putFailed` error. Seed 1337
import { inspectors } from "@keel/compiler/inspect/inspectors";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button, TextArea } from "@keel/ui";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Session, record } from "../src/index.ts";
import { utf8Length } from "../src/internal/utf8Length.ts";

function build() {
  const memo = store(s.object({ note: s.string() }), { note: "" }, { id: "memo" });
  const save = transaction(memo, "memo.save", s.object({ note: s.string() }), (st, p) => ({ ...st, note: p.note }));
  const routes = manifest(contract("memo", { "memo.edit": { path: "/memo" } }), {
    "memo.edit": {
      component(): Node {
        return Box({
          as: "main",
          id: "memo.page",
          children: [
            TextArea({ id: "memo.body", label: "Body", onInput: (v) => void tx(save, { note: v }) }),
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
  return { memo, routes };
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

async function open(ctx: Ctx, upload?: URL) {
  const { memo, routes } = fixture();
  const rec = record(ctx, upload === undefined ? {} : { upload });
  const h = await renderRoute("memo.edit", { routes, state: [[memo, { note: "" }]], ctx });
  return { rec, h };
}

const MAX_SESSION_BYTES = 192 * 1024;
const bytes = (session: Session): number => utf8Length(JSON.stringify(Session.encode(session)));

afterEach(() => void vi.unstubAllGlobals());

describe("record bounds", () => {
  // 2,000 inputs through the rendered page, each recorded with the whole value typed so far: about 2.3 ms an input
  // here, so 50 ms an input.
  test("typing a 2,000-character textarea keeps the session JSON within 192 KiB", async () => {
    const { rec, h } = await open(createCtx({ mode: "sim", seed: 1337 }));
    let text = "";
    for (let i = 0; i < 2000; i++) {
      text += String.fromCharCode(97 + (i % 26));
      await h.fire("memo.body", { type: "input", value: text });
    }
    const out = rec.stop();
    expect(bytes(out)).toBeLessThanOrEqual(MAX_SESSION_BYTES);
    expect(Session.parse(Session.encode(out)).ok).toBe(true);
    // The newest input survives the cuts with the full value.
    const last = out.events.filter((e) => e.kind === "fire").at(-1);
    expect(last?.kind === "fire" && last.event).toEqual({ type: "input", value: text });
    h.dispose();
  }, 2000 * 50);

  test("property (seed 1337): the serialized session never exceeds the byte bound", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 60_000 }), { minLength: 1, maxLength: 12 }), async (lens) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const { rec, h } = await open(ctx);
        for (const n of lens) {
          await h.fire("memo.body", { type: "input", value: "é".repeat(n) });
          const now = Session.parse(inspectors.get("sessions.live")?.read(ctx));
          expect(now.ok).toBe(true);
          if (now.ok) expect(bytes(now.value)).toBeLessThanOrEqual(MAX_SESSION_BYTES);
        }
        expect(bytes(rec.stop())).toBeLessThanOrEqual(MAX_SESSION_BYTES);
        h.dispose();
      }),
      { seed: 1337, numRuns: 25 },
    );
  }, 60_000);

  test("errors() keeps the first 32 and the last 32 errors, in order", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const { rec, h } = await open(ctx);
    for (let i = 0; i < 100; i++)
      report(ctx, { kind: "error", error: { code: "memo.failed", message: `e${i}`, data: null } });
    const want = [...Array(32).keys(), ...Array.from({ length: 32 }, (_, i) => 68 + i)].map((i) => `e${i}`);
    expect(rec.errors().map((e) => e.message)).toEqual(want);
    rec.stop();
    h.dispose();
  });

  test("a rejected upload (413) is recorded as a sessions.putFailed error, not dropped", async () => {
    const seen: number[] = [];
    vi.stubGlobal("fetch", async (_url: URL, init: RequestInit) => {
      seen.push(typeof init.body === "string" ? init.body.length : -1);
      return new Response(null, { status: 413 });
    });
    const { rec, h } = await open(createCtx({ mode: "real" }), new URL("/sessions", location.origin));
    await h.fire("memo.crash", { type: "click" }).catch(() => undefined);
    await vi.waitFor(() => expect(rec.errors().map((e) => e.code)).toContain("sessions.putFailed"));
    expect(seen).toHaveLength(1);
    expect(rec.errors().map((e) => e.code)).toEqual(["keel.unexpected", "sessions.putFailed"]);
    expect(rec.errors()[1]?.data).toEqual({ status: 413 });
    const out = rec.stop();
    expect(out.error?.code).toBe("keel.unexpected");
    expect(out.events.filter((e) => e.kind === "error").map((e) => e.kind === "error" && e.error.code)).toEqual([
      "keel.unexpected",
      "sessions.putFailed",
    ]);
    h.dispose();
  });
});
