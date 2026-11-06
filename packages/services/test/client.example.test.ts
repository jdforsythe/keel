// Examples: wire format, input errors, error bodies, the real-clock timer path, construction errors.
import { type Ctx, createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { afterEach, describe, expect, test, vi } from "vitest";
import { endpoints } from "../src/endpoints.ts";
import { service } from "../src/service.ts";

const BASE = "https://api.test/v1/";
const Note = s.object({ text: s.string({ min: 1 }) });
const api = service({
  base: BASE,
  schema: endpoints({
    add: {
      method: "POST",
      path: "/orders/:id/notes",
      params: s.object({ id: s.string() }),
      query: s.object({ tags: s.array(s.string()), page: s.object({ n: s.int() }), q: s.string().nullable() }),
      body: Note,
      output: Note.nullable(),
      errors: { 409: s.object({ reason: s.string() }) },
    },
    list: { method: "GET", path: "/notes", output: s.array(Note) },
  }),
});
const input = { params: { id: "a b" }, query: { tags: ["x", "y"], page: { n: 2 }, q: null }, body: { text: "hi" } };

describe("wire format", () => {
  test("joins base and path, encodes query and sends a JSON body", async () => {
    const ctx = createCtx({ mode: "sim" });
    let sent: Request | undefined;
    ctx.net.route("https://api.test/*", (req) => {
      sent = req;
      return new Response(JSON.stringify({ text: "ok" }), { status: 201 });
    });
    expect(await api.add(input, ctx)).toEqual({ ok: true, value: { text: "ok" } });
    expect(sent?.url).toBe("https://api.test/v1/orders/a%20b/notes?tags=x&tags=y&page.n=2");
    expect(sent?.method).toBe("POST");
    expect(sent?.headers.get("content-type")).toBe("application/json");
    expect(sent?.headers.get("accept")).toBe("application/json");
    expect(sent?.headers.get("x-keel")).toBe("1");
    expect(await sent?.json()).toEqual({ text: "hi" });
  });

  test("an empty 2xx body decodes as null", async () => {
    const ctx = createCtx({ mode: "sim" });
    ctx.net.route("https://api.test/*", () => new Response("", { status: 200 }));
    expect(await api.add(input, ctx)).toEqual({ ok: true, value: null });
  });

  test("a 2xx body that is not JSON is api.decode at the root", async () => {
    const ctx = createCtx({ mode: "sim" });
    ctx.net.route("https://api.test/*", () => new Response("<html>", { status: 200 }));
    const r = await api.list({}, ctx);
    expect(!r.ok && r.error).toMatchObject({ code: "api.decode", data: { issues: [{ path: [], rule: "type" }] } });
  });
});

describe("errors", () => {
  test("invalid input is api.input with the part as path prefix; nothing is sent", async () => {
    const ctx = createCtx({ mode: "sim" });
    let calls = 0;
    ctx.net.route("https://api.test/*", () => {
      calls++;
      return new Response("{}");
    });
    const r = await api.add({ ...input, body: { text: "" } }, ctx);
    expect(!r.ok && r.error).toMatchObject({ code: "api.input", data: { issues: [{ path: ["body", "text"] }] } });
    expect(calls).toBe(0);
  });

  test("a param encodeURIComponent rejects (lone surrogate) is api.input at params.<name>", async () => {
    const r = await api.add({ ...input, params: { id: "\uD800" } }, createCtx({ mode: "sim" }));
    expect(!r.ok && r.error.data.issues).toEqual([{ path: ["params", "id"], rule: "type" }]);
  });

  test("a declared status whose body fails its schema has body null", async () => {
    const ctx = createCtx({ mode: "sim" });
    ctx.net.route("https://api.test/*", () => new Response('{"reason":1}', { status: 409 }));
    const r = await api.add(input, ctx);
    expect(!r.ok && r.error.data).toEqual({ status: 409, body: null });
  });

  test("a body the platform reader rejects is api.network", async () => {
    const ctx = createCtx({ mode: "sim" });
    const stream = new ReadableStream({ start: (c) => c.error(new Error("reset")) });
    ctx.net.route("https://api.test/*", () => new Response(stream, { status: 200 }));
    const r = await api.list({}, ctx);
    expect(!r.ok && r.error.code).toBe("api.network");
  });

  test("a broken ctx is api.network, not a throw", async () => {
    const broken: Ctx = {
      ...createCtx({ mode: "sim" }),
      clock: {
        now: () => {
          throw new Error("no clock");
        },
        after: () => {
          throw new Error("no clock");
        },
      },
    };
    const r = await api.list({}, broken);
    expect(!r.ok && r.error.code).toBe("api.network");
  });
});

describe("real clock path", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("a real clock times out through a platform timer", async () => {
    vi.useFakeTimers();
    const sim = createCtx({ mode: "sim" });
    const ctx: Ctx = { ...sim, clock: createCtx({ mode: "real" }).clock };
    let aborted = false;
    sim.net.route("https://api.test/*", (req) => {
      req.signal.addEventListener("abort", () => {
        aborted = true;
      });
      return new Promise<Response>(() => {});
    });
    const pending = api.list({}, ctx);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: false, error: expect.objectContaining({ code: "api.timeout" }) });
    expect(aborted).toBe(true);
  });
});

describe("construction", () => {
  const decl = endpoints({ get: { method: "GET", path: "/", output: s.object({}) } });

  test("endpoints returns its declarations frozen", () => {
    expect(Object.isFrozen(decl)).toBe(true);
    expect(Object.keys(service({ base: "https://a.test", schema: decl }))).toEqual(["get"]);
  });

  test("a relative base or a non-positive timeout throws at construction", () => {
    expect(() => service({ base: "/api", schema: decl })).toThrow(/absolute URL/);
    for (const timeout of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => service({ base: "https://a.test", schema: decl, timeout })).toThrow(RangeError);
    const bad = endpoints({ get: { method: "GET", path: "/", output: s.object({}), timeout: -5 } });
    expect(() => service({ base: "https://a.test", schema: bad })).toThrow(/get timeout/);
  });
});
