// @vitest-environment happy-dom
// Red-team leaks in recorded sessions (backlog 0206-0210, 0213; rfc:0070). Seed 1337
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { createRouter, manifest } from "@keel/router";
import type { RouterHistory } from "@keel/router";
import { s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { Box, Button, Input } from "@keel/ui";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { Session, record, redactSession, replay, session } from "../src/index.ts";
import { redactionOf } from "../src/internal/redactionOf.ts";

const typed: { value: string } = { value: "" };
const routes = manifest({
  "pay.show": {
    path: "/pay",
    search: s.object({ token: s.secret(s.string()).optional(), q: s.string().optional() }),
    component(): Node {
      return Box({
        as: "main",
        id: "pay.page",
        children: [
          Input({
            id: "pay.card",
            label: "Card",
            onInput: (v) => {
              typed.value = v;
            },
          }),
          Input({ id: "pay.pw", label: "Password", type: "password" }),
          Button({
            id: "pay.crash",
            children: "Pay",
            onClick: () => {
              throw new Error(`card ${typed.value} declined`);
            },
          }),
        ],
      });
    },
  },
});

const text = (out: Session): string => JSON.stringify(Session.encode(out));

async function open(ctx: Ctx, redact: readonly string[] = []) {
  bindStd(ctx, { "@keel/std-sessions": { pay: { redact: [...redact] } } });
  typed.value = "";
  return renderRoute("pay.show", { routes, ctx });
}

describe("red-team 0206-0210, 0213", () => {
  test("0206: an el: value entry masks one-character keydown keys as well as input values", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[0-9]{6,10}$/), async (digits) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const h = await open(ctx, ["el:pay.card#value"]);
        const rec = record(ctx);
        for (const key of digits) await h.fire("pay.card", { type: "keydown", key });
        await h.fire("pay.card", { type: "keydown", key: "Enter" });
        await h.fire("pay.card", { type: "input", value: digits });
        const out = rec.stop();
        h.dispose();
        expect(text(out)).not.toContain(digits);
        const keys = out.events.flatMap((e) => (e.kind === "fire" && e.event.type === "keydown" ? [e.event.key] : []));
        expect(keys).toEqual([...[...digits].map(() => "x"), "Enter"]);
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  test("0207: a field that once reported a masked value stays redacted after it stops being a password", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const h = await open(ctx);
    const rec = record(ctx);
    await h.fire("pay.pw", { type: "input", value: "first-secret" });
    const pw = document.getElementById("pay.pw");
    if (pw instanceof HTMLInputElement) pw.type = "text";
    await h.fire("pay.pw", { type: "input", value: "hunter2-shown" });
    await h.fire("pay.pw", { type: "keydown", key: "z" });
    const out = rec.stop();
    h.dispose();
    expect(text(out)).not.toContain("hunter2-shown");
    expect(text(out)).not.toContain('"key":"z"');
  });

  test("0207: the recorder keeps masking an element once it reported a masked value, whatever observe sends next", () => {
    const r = redactionOf([], 1337);
    const fire = (value: string) => r.fire({ at: 0, kind: "fire", id: "pay.pw", event: { type: "input", value } });
    expect(fire("plain").event).toEqual({ type: "input", value: "plain" });
    expect(fire("xxxxxxx").event).toEqual({ type: "input", value: "xxxxxxx" });
    expect(fire("hunter2").event).toEqual({ type: "input", value: "xxxxxxx" });
    expect(r.fire({ at: 0, kind: "fire", id: "pay.pw", event: { type: "keydown", key: "q" } }).event).toEqual({
      type: "keydown",
      key: "x",
    });
  });

  test("0208: an s.secret search value never reaches a nav href, with no redact entry", async () => {
    let pop: (url: string) => void = () => undefined;
    const urls: string[] = ["/pay"];
    const history: RouterHistory = {
      push: (url) => void urls.push(url),
      replace: (url) => void urls.push(url),
      current: () => urls[urls.length - 1] ?? "/pay",
      onPop: (fn) => {
        pop = (url) => {
          urls.push(url);
          fn(url);
        };
      },
    };
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const rec = record(ctx);
    const router = createRouter(routes, { ctx, history });
    await Promise.resolve();
    pop("/pay?token=SECRET-TOKEN-1337&q=visible");
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const out = rec.stop();
    router.dispose();
    expect(out.events.some((e) => e.kind === "nav")).toBe(true);
    expect(text(out)).not.toContain("SECRET-TOKEN-1337");
    expect(text(out)).toContain("visible");
  });

  test("0209: a value a redact entry matched is masked in later error messages", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[0-9]{8,12}$/), async (card) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const h = await open(ctx, ["el:pay.card#value"]);
        const rec = record(ctx);
        await h.fire("pay.card", { type: "input", value: card });
        await h.fire("pay.crash", { type: "click" }).catch(() => undefined);
        const out = rec.stop();
        h.dispose();
        expect(rec.errors()[0]?.message).toContain(card);
        expect(out.error?.message).toBe(`card ${"x".repeat(card.length)} declined`);
        expect(text(out)).not.toContain(card);
        const written = redactSession(out, { routes, expose: [] });
        expect(written.error?.message).toBe("x".repeat(out.error?.message.length ?? 0));
      }),
      { seed: 1337, numRuns: 10 },
    );
  });

  test("0210: the error that overflows the buffer is kept, so the upload names it", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const h = await open(ctx);
    const upload = new URL("https://example.test/sessions");
    const rec = record(ctx, { limit: 1, upload });
    await h.fire("pay.crash", { type: "click" }).catch(() => undefined);
    const out = rec.stop();
    h.dispose();
    const put = session(ctx).taken()[0]?.session;
    expect(put?.error?.code).toBe("keel.unexpected");
    expect(put?.fingerprint).toBe(out.fingerprint);
    expect(out.error?.code).toBe("keel.unexpected");
    expect(out.events.length).toBeLessThanOrEqual(1);
  });

  test("0213: a real ctx (unseeded random) records no seed and deterministic: false; a seeded one records both", async () => {
    const loose = createCtx({ mode: "real" });
    const h = await open(loose);
    const rec = record(loose);
    const out = rec.stop();
    h.dispose();
    expect(out.seed).toBeUndefined();
    expect(out.deterministic).toBe(false);
    expect(Session.parse(Session.encode(out)).ok).toBe(true);
    expect((await replay(out, { routes })).unapplied).toBeNull();
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const h2 = await open(ctx);
    const seeded = record(ctx).stop();
    h2.dispose();
    expect(seeded.seed).toBe(1337);
    expect(seeded.deterministic).toBe(true);
  });
});
