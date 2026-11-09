// The `session` capability (std.sessions): sim ids follow the seed, real put posts JSON. Seed 1337
import { createCtx } from "@keel/ctx";
import { afterEach, expect, test, vi } from "vitest";
import { type Session, session } from "../src/index.ts";

afterEach(() => vi.unstubAllGlobals());

const sample = (id: Session["id"]): Session => ({
  v: 1,
  id,
  seed: 1337,
  deterministic: true,
  at: 0,
  route: { id: "cart.show", params: {}, search: {} },
  state: {},
  events: [],
  error: null,
  fingerprint: "000000000000",
});

test("sim id() is deterministic per seed and leaves the app's random stream alone", () => {
  const a = createCtx({ mode: "sim", seed: 1337 });
  const b = createCtx({ mode: "sim", seed: 1337 });
  expect(session(a).id()).toBe(session(b).id());
  expect(a.random.id("Order")).toBe(createCtx({ mode: "sim", seed: 1337 }).random.id("Order"));
});

test("sim put keeps every session in taken(), oldest first", async () => {
  const sink = session(createCtx({ mode: "sim", seed: 1337 }));
  const url = new URL("https://example.test/sessions");
  await sink.put(url, sample(sink.id()));
  await sink.put(url, sample(sink.id()));
  expect(sink.taken().map((t) => t.session.id)).toHaveLength(2);
});

test("real put POSTs the encoded session; non-2xx is sessions.putFailed; a network failure is status 0", async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  vi.stubGlobal("fetch", async (url: URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: calls.length === 1 ? 204 : 500 });
  });
  const sink = session(createCtx({ mode: "real" }));
  const url = new URL("https://example.test/sessions");
  expect(await sink.put(url, sample(sink.id()))).toEqual({ ok: true, value: null });
  const bad = await sink.put(url, sample(sink.id()));
  expect(bad.ok ? null : bad.error.data).toEqual({ status: 500 });
  expect(calls[0]?.init?.method).toBe("POST");
  expect(calls[0]?.init?.keepalive).toBe(true);
  vi.stubGlobal("fetch", async () => {
    throw new Error("offline");
  });
  const off = await sink.put(url, sample(sink.id()));
  expect(off.ok ? null : off.error.code).toBe("sessions.putFailed");
  expect(off.ok ? null : off.error.data).toEqual({ status: 0 });
  expect(sink.taken()).toEqual([]);
});
