// @vitest-environment happy-dom
// k.server, Request flow "GET with `accept: text/event-stream` to a live loader's route: guard denial 403 `keel.denied`; past `createApp({ maxStreams })` (default 1,000) open streams 503 `keel.busy` (`data: { limit }`); else a `data:` line per yield (its `Result` JSON), a `:` line per 15 s of `ctx.clock`, until `fn` returns or `signal` aborts (request abort, `close()`). An event over 1,048,576 bytes of UTF-8 as written (`data: `, the JSON and its two line feeds) is not written: the stream writes the `keel.unexpected` `err` line a throw of `fn` gives, logs one `diag` `keel.unexpected` `loader <id> event over 1048576 bytes`, and ends, returning `fn`'s iterator. Other routes: 406."
// Spec: k.server, clause "A live loader of `output` `s.string()` yielding `ok` of 1,048,546 `a` (its event `data: {\"ok\":true,\"value\":\"<s>\"}` and two line feeds, 1,048,576 bytes), then of 1,048,547 `a`, then `ok('b')` gives the first event, then one `data:` line holding a `keel.unexpected` `err`, then the end; `b` is never written, and one `diag` `loader <id> event over 1048576 bytes` is logged."
// Seed 1337 (no random input: each case is a fixed large event, built once per case). No wall time.
// An event is `data: `, the `Result` JSON and two line feeds; the cap counts its UTF-8 bytes.
import { fixedTime } from "@keel/tooling/test-time";
import { contract } from "@keel/router/contract";
import { manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { createAppLoose, liveLoader, simCtx } from "./topology-fixtures.ts";

const T = () => topology({ web: { modules: ["app"], adapter: "node" } });
const sse = { accept: "text/event-stream" };
const LIMIT = 1_048_576;
const OVERHEAD = Buffer.byteLength('data: {"ok":true,"value":""}\n\n');

type Mode = "dev" | "production";
async function stream(mode: Mode, yields: readonly string[]) {
  const lines: string[] = [];
  const events = { reachedAfter: false, returned: false };
  const appContract = contract("app", {
    "app.live": { method: "GET", path: "/api/live", events: true, output: s.string() },
  });
  const live = liveLoader(appContract, "app.live", async function* () {
    try {
      for (const v of yields) yield ok(v);
      events.reachedAfter = true;
    } finally {
      events.returned = true;
    }
  });
  const routes = manifest(appContract, { "app.live": { loader: live } });
  const app = await createAppLoose({
    topology: T(),
    routes,
    ctx: simCtx(),
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  const res = await app.fetch(new Request("http://localhost/api/live", { headers: sse }));
  const text = await res.text();
  const data = text
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5));
  const diags = lines.flatMap((l) => {
    const rec: unknown = JSON.parse(l);
    return typeof rec === "object" && rec !== null && Reflect.get(rec, "kind") === "diag" ? [l] : [];
  });
  return { text, data, diags, events };
}
const messageOf = (line: string): unknown => {
  const rec: unknown = JSON.parse(line);
  return typeof rec === "object" && rec !== null ? Reflect.get(rec, "message") : undefined;
};
const okOf = (data: string): unknown => {
  const v: unknown = JSON.parse(data);
  return typeof v === "object" && v !== null ? Reflect.get(v, "ok") : undefined;
};
const codeOf = (data: string): unknown => {
  const v: unknown = JSON.parse(data);
  const e = typeof v === "object" && v !== null ? Reflect.get(v, "error") : undefined;
  return typeof e === "object" && e !== null ? Reflect.get(e, "code") : undefined;
};

for (const mode of ["dev", "production"] as const)
  describe(`k.server: one event is capped at 1,048,576 bytes as written, in ${mode}`, () => {
    it(
      'A live loader of `output` `s.string()` yielding `ok` of 1,048,546 `a` (its event `data: {"ok":true,"value":"<s>"}` and two line feeds, 1,048,576 bytes), then of 1,048,547 `a`, then `ok(\'b\')` gives the first event, then one `data:` line holding a `keel.unexpected` `err`, then the end; `b` is never written, and one `diag` `loader <id> event over 1048576 bytes` is logged.',
      async () => {
        expect(OVERHEAD).toBe(30);
        const edge = "a".repeat(LIMIT - OVERHEAD);
        const out = await stream(mode, [edge, `${edge}a`, "b"]);
        expect(out.data).toHaveLength(2);
        expect(JSON.parse(out.data[0] ?? "null")).toEqual({ ok: true, value: edge });
        expect(codeOf(out.data[1] ?? "null")).toBe("keel.unexpected");
        expect(out.text).not.toContain('"b"');
        expect(Buffer.byteLength(`data:${out.data[0] ?? ""}\n\n`)).toBe(LIMIT);
        const over = out.diags.filter((l) => messageOf(l) === "loader app.live event over 1048576 bytes");
        expect(over).toHaveLength(1);
        expect(over[0]).toContain("keel.unexpected");
        expect(out.diags).toHaveLength(1);
        expect(out.events.reachedAfter).toBe(false);
        expect(out.events.returned).toBe(true);
      },
      fixedTime(30_000),
    );

    it(
      "An event of exactly 1,048,576 bytes as written is written whole, and the stream goes on: no `err`, no `diag`, the next yield is the second event.",
      async () => {
        const edge = "a".repeat(LIMIT - OVERHEAD);
        const out = await stream(mode, [edge, "b"]);
        expect(out.data.map(okOf)).toEqual([true, true]);
        expect(out.diags).toHaveLength(0);
        expect(out.events.reachedAfter).toBe(true);
      },
      fixedTime(30_000),
    );

    it(
      "The cap counts UTF-8 bytes as written, not characters: 524,273 `é` (30 + 1,048,546 bytes) is written, and 524,274 is not.",
      async () => {
        const within = "é".repeat(524_273);
        const pass = await stream(mode, [within, "b"]);
        expect(pass.data).toHaveLength(2);
        expect(JSON.parse(pass.data[0] ?? "null")).toEqual({ ok: true, value: within });
        expect(pass.diags).toHaveLength(0);
        const refused = await stream(mode, [`${within}é`, "b"]);
        expect(refused.data).toHaveLength(1);
        expect(codeOf(refused.data[0] ?? "null")).toBe("keel.unexpected");
        expect(refused.diags).toHaveLength(1);
        expect(refused.events.reachedAfter).toBe(false);
      },
      fixedTime(30_000),
    );

    it(
      "The first event over the cap is refused with nothing written before the `err`: a stream whose first yield is 1,048,547 `a` is one `data:` line holding the `keel.unexpected` `err`, then the end.",
      async () => {
        const out = await stream(mode, ["a".repeat(LIMIT - OVERHEAD + 1)]);
        expect(out.data).toHaveLength(1);
        expect(codeOf(out.data[0] ?? "null")).toBe("keel.unexpected");
        expect(out.text).not.toContain("aaaaaaaa");
        expect(out.diags).toHaveLength(1);
      },
      fixedTime(30_000),
    );
  });
