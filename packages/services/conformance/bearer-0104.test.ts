// Spec: k.services, API "A client method takes `{ params?, query?, body?, signal?, bearer?, user? }` and `ctx`. `bearer`, a `Secret<string>`, is sent as `authorization: Bearer <token>`; a token outside k.api's Bearer form is `api.input` at `bearer`. Requests go through `ctx.net.fetch` (k.ctx), so tests run under sim."
// Spec: k.services, Conformance "With `bearer` a secret of `abc`, the request carries `authorization: Bearer abc`; with `a b`, the call is `api.input` with issue path `bearer` and sends no request."
// Spec: k.privacy, Rules "E1113 an `s.secret` in an `output`, thrown by `contract` or `loader` (k.routes; fix: none)."
// Seed: 1337.
// Sim net only. The call's contract service is `service({ contract })` over module `b`'s entries (k.contract).
// The `endpoints` case of the RFC list (an `output` holding `s.secret` is no E1113) is here and not in packages/router: this package depends on `@keel/services`.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import type { Secret } from "@keel/schema";
import { contract } from "@keel/router/contract";
import { endpoints, service } from "@keel/services";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const BASE = "https://api.example.com";
const MODULE = "http://b.keel.invalid";
const Item = s.string().nullable();
const schema = endpoints({
  show: { method: "GET", path: "/items/:id", params: s.object({ id: s.string() }), output: Item },
  save: {
    method: "POST",
    path: "/items/:id",
    params: s.object({ id: s.string() }),
    body: s.object({ note: s.string() }),
    output: Item,
  },
});
const bContract = contract("b", {
  "b.show": { method: "GET", path: "/items/:id", params: s.object({ id: s.string() }), output: Item },
  "b.save": {
    method: "POST",
    path: "/items/:id",
    params: s.object({ id: s.string() }),
    body: s.object({ note: s.string() }),
    output: Item,
  },
});
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~+/".split("");
const tokenArb = fc.array(fc.constantFrom(...ALPHA), { minLength: 1, maxLength: 120 }).map((cs) => cs.join(""));

function secret(text: string): Secret<string> {
  const parsed = s.secret(s.string()).parse(text);
  if (!parsed.ok) throw new Error("fixture: a string parses as a secret");
  return parsed.value;
}
const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const enc = new TextEncoder();
const stream = (): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(`data: ${JSON.stringify({ ok: true, value: "v" })}\n\n`));
        c.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );

interface Sent {
  readonly authorization: string | null;
  readonly method: string;
}
/** A sim ctx whose net records each request's `authorization` and answers `reply`. */
function rig(origin: string, reply: (req: Request) => Response) {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const sent: Sent[] = [];
  ctx.net.route(`${origin}/*`, (req) => {
    sent.push({ authorization: req.headers.get("authorization"), method: req.method });
    return reply(req);
  });
  return { ctx, sent };
}
const baseClient = () => service({ base: BASE, schema });
const moduleClient = () => service({ contract: bContract });
async function call(api: unknown, name: string, args: unknown, ctx: unknown): Promise<unknown> {
  const m: unknown = typeof api === "object" && api !== null ? Reflect.get(api, name) : undefined;
  if (typeof m !== "function") throw new Error(`client has no ${name}`);
  return Reflect.apply(m, api, [args, ctx]);
}
const answerOf = (req: Request): Response =>
  req.url.startsWith(MODULE) ? json({ id: "b.show", results: { "b.show": { ok: true, value: null } } }) : json(null);
const writeAnswer = (req: Request): Response =>
  req.url.startsWith(MODULE) ? json({ ok: true, value: null }) : json(null);
const isAsyncIterable = (v: unknown): v is AsyncIterable<unknown> =>
  typeof v === "object" && v !== null && Symbol.asyncIterator in v;
const pathsOf = (issues: unknown): unknown[][] =>
  Array.isArray(issues)
    ? issues.flatMap((i: unknown) => {
        const path = field(i, "path");
        return Array.isArray(path) ? [path] : [];
      })
    : [];
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

describe("k.services bearer", () => {
  it("With `bearer` a secret of `abc`, the request carries `authorization: Bearer abc`; with `a b`, the call is `api.input` with issue path `bearer` and sends no request.", async () => {
    const abc = rig(BASE, answerOf);
    await baseClient().show({ params: { id: "1" }, bearer: secret("abc") }, abc.ctx);
    expect(abc.sent).toEqual([{ authorization: "Bearer abc", method: "GET" }]);

    const bad = rig(BASE, answerOf);
    const r = await baseClient().show({ params: { id: "1" }, bearer: secret("a b") }, bad.ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("api.input");
      const issues = field(r.error.data, "issues");
      expect(pathsOf(issues).some((p) => p[0] === "bearer")).toBe(true);
    }
    expect(bad.sent).toHaveLength(0);
  });

  it("A client method takes `{ params?, query?, body?, signal?, bearer?, user? }` and `ctx`. `bearer`, a `Secret<string>`, is sent as `authorization: Bearer <token>`; a token outside k.api's Bearer form is `api.input` at `bearer`. Requests go through `ctx.net.fetch` (k.ctx), so tests run under sim.", async () => {
    await fc.assert(
      fc.asyncProperty(tokenArb, fc.integer({ min: 0, max: 3 }), async (token, eqs) => {
        const text = token + "=".repeat(eqs);
        for (const [origin, api] of [
          [BASE, baseClient()],
          [MODULE, moduleClient()],
        ] as const) {
          const get = rig(origin, answerOf);
          await call(api, "show", { params: { id: "1" }, bearer: secret(text) }, get.ctx);
          expect(get.sent).toEqual([{ authorization: `Bearer ${text}`, method: "GET" }]);
          const put = rig(origin, writeAnswer);
          await call(api, "save", { params: { id: "1" }, body: { note: "n" }, bearer: secret(text) }, put.ctx);
          expect(put.sent).toEqual([{ authorization: `Bearer ${text}`, method: "POST" }]);
        }
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("A client method takes `user?` (k.user): on a ctx no `createApp` with a secret bound, `user` is `api.input` at `user` and nothing is sent.", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 40 }), async (id) => {
        const r = rig(MODULE, answerOf);
        const res = await call(moduleClient(), "show", { params: { id: "1" }, user: id }, r.ctx);
        expect(field(res, "ok")).toBe(false);
        expect(field(field(res, "error"), "code")).toBe("api.input");
        const issues = field(field(field(res, "error"), "data"), "issues");
        expect(pathsOf(issues).some((p) => p[0] === "user")).toBe(true);
        expect(r.sent).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("A call without `bearer` sends no `authorization`.", async () => {
    for (const [origin, api] of [
      [BASE, baseClient()],
      [MODULE, moduleClient()],
    ] as const) {
      const r = rig(origin, answerOf);
      await call(api, "show", { params: { id: "1" } }, r.ctx);
      expect(r.sent).toEqual([{ authorization: null, method: "GET" }]);
    }
  });

  it("A GET endpoint with `events: true` sends `authorization: Bearer <token>` on its GET.", async () => {
    const def = { watch: { method: "GET", path: "/watch", output: Item, events: true } };
    const api: unknown = Reflect.apply(service, undefined, [
      { base: BASE, schema: Reflect.apply(endpoints, undefined, [def]) },
    ]);
    await fc.assert(
      fc.asyncProperty(tokenArb, async (token) => {
        const r = rig(BASE, stream);
        const it: unknown = await call(api, "watch", { bearer: secret(token) }, r.ctx);
        if (!isAsyncIterable(it)) throw new Error("not async iterable");
        for await (const _ of it) void _;
        expect(r.sent).toEqual([{ authorization: `Bearer ${token}`, method: "GET" }]);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("A token outside k.api's Bearer form (a space, a comma or a tab inside, empty, or 4,097 or more characters) is `api.input` with issue path `bearer`, and no request is sent.", async () => {
    const inside = fc.tuple(tokenArb, fc.constantFrom(" ", ",", "\t"), tokenArb).map(([a, sep, b]) => a + sep + b);
    const long = fc.integer({ min: 4097, max: 4200 }).map((n) => "a".repeat(n));
    await fc.assert(
      fc.asyncProperty(fc.oneof(inside, fc.constant(""), fc.constant("a b"), long), async (text) => {
        for (const [origin, api] of [
          [BASE, baseClient()],
          [MODULE, moduleClient()],
        ] as const) {
          const r = rig(origin, answerOf);
          const out = await call(api, "show", { params: { id: "1" }, bearer: secret(text) }, r.ctx);
          expect(field(out, "ok")).toBe(false);
          expect(field(field(out, "error"), "code")).toBe("api.input");
          const issues = field(field(field(out, "error"), "data"), "issues");
          expect(pathsOf(issues).some((p) => p[0] === "bearer")).toBe(true);
          expect(r.sent).toHaveLength(0);
        }
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it('The call\'s input object passed through `JSON.stringify` holds `"[secret]"`, not the token.', () => {
    fc.assert(
      fc.property(tokenArb, (token) => {
        const input = { params: { id: "1" }, bearer: secret(token) };
        const text = JSON.stringify(input);
        expect(text).toContain('"[secret]"');
        expect(text).not.toContain(token);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1113 is for `loader` and `action` outputs only: `endpoints` with an `output` holding `s.secret` does not throw.", () => {
    expect(() =>
      endpoints({ x: { method: "GET", path: "/x", output: s.object({ t: s.secret(s.string()) }) } }),
    ).not.toThrow();
  });
});
