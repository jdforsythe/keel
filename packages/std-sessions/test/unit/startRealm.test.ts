// `startRealm`: one group user's worker as the group drives it, here over a stand-in `Worker` in the test's own
// thread. What the worker is started with, when the realm resolves or rejects, how a call and its answer travel, how
// each failure ends the calls in flight and the calls after it, what a request, a cancel and an invoke from the worker
// do, and the order of what is posted back.
// Seed 1337 (no random inputs)
import { EventEmitter } from "node:events";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Outgoing } from "../../src/group/internal/Outgoing.ts";
import { running } from "../../src/group/internal/running.ts";
import { startRealm } from "../../src/group/internal/startRealm.ts";

const made = vi.hoisted(() => {
  const list: unknown[] = [];
  return { list };
});

vi.mock("node:worker_threads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:worker_threads")>();
  const { EventEmitter: Emitter } = await import("node:events");
  class FakeWorker extends Emitter {
    readonly posted: unknown[] = [];
    terminated = 0;
    constructor(
      readonly url: URL,
      readonly options: { execArgv?: string[]; workerData?: unknown },
    ) {
      super();
      made.list.push(this);
    }
    postMessage(m: unknown): void {
      this.posted.push(m);
    }
    async terminate(): Promise<number> {
      this.terminated++;
      setTimeout(() => this.emit("exit", 1), 0);
      return 1;
    }
  }
  return { ...actual, Worker: FakeWorker };
});

interface Fake extends EventEmitter {
  readonly url: URL;
  readonly options: { execArgv?: string[]; workerData?: unknown };
  readonly posted: unknown[];
  terminated: number;
  postMessage(m: unknown): void;
}
const isFake = (w: unknown): w is Fake => w instanceof EventEmitter && "posted" in w;
const lastWorker = (): Fake => {
  const w = made.list.at(-1);
  if (!isFake(w)) throw new Error("no worker was started");
  return w;
};
const tick = (): Promise<void> => new Promise((done) => setTimeout(done, 0));
const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

type Fetch = (req: Outgoing) => Promise<Response>;
interface Started {
  readonly w: Fake;
  readonly touched: () => number;
  readonly log: unknown[];
  readonly realm: Awaited<ReturnType<typeof startRealm>>;
  readonly invoked: unknown[];
}
async function start(
  options: {
    fetch?: Fetch;
    invoke?: (data: unknown) => Promise<{ result: unknown } | { error: unknown }>;
  } = {},
): Promise<Started> {
  const invoked: unknown[] = [];
  const log: unknown[] = [];
  let touches = 0;
  const pending = startRealm(
    "http://app.test",
    {
      invoke: (data) => {
        invoked.push(data);
        return (options.invoke ?? (async () => ({ result: "r" })))(data);
      },
    },
    options.fetch ?? (async () => new Response("")),
    () => {
      touches++;
      log.push("touch");
    },
  );
  const w = lastWorker();
  const post = w.postMessage.bind(w);
  Object.assign(w, {
    postMessage: (m: unknown) => {
      post(m);
      log.push(m);
    },
  });
  w.emit("message", { t: "ready" });
  const realm = await pending;
  return { w, touched: () => touches, log, realm, invoked };
}

afterEach(() => {
  made.list.length = 0;
  running.clear();
});

describe("startRealm: starting the worker", () => {
  test("the worker is the userWorker entry, run with tsx, given the origin; it is tracked until it exits", async () => {
    const { w } = await start();
    expect(w.url.href.endsWith("/group/internal/userWorker.ts")).toBe(true);
    expect(w.options.execArgv).toEqual(["--import", expect.stringMatching(/^file:.*\/tsx\//)]);
    expect(w.options.execArgv?.[1]).toBe(
      pathToFileURL((await import("node:module")).createRequire(import.meta.url).resolve("tsx")).href,
    );
    expect(w.options.workerData).toEqual({ origin: "http://app.test" });
    expect(running.size).toBe(1);
    w.emit("exit", 0);
    expect(running.size).toBe(0);
  });

  test("it resolves only once the worker says ready, and ignores other messages meanwhile", async () => {
    let done = false;
    const pending = startRealm(
      "o",
      { invoke: async () => ({ result: 1 }) },
      async () => new Response(""),
      () => {},
    );
    void pending.then(() => {
      done = true;
    });
    const w = lastWorker();
    w.emit("message", { t: "other" });
    w.emit("message", null);
    await tick();
    expect(done).toBe(false);
    w.emit("message", { t: "ready" });
    await pending;
    expect(done).toBe(true);
  });

  test("a worker that errors before it is ready rejects with the error and is terminated", async () => {
    const pending = startRealm(
      "o",
      { invoke: async () => ({ result: 1 }) },
      async () => new Response(""),
      () => {},
    );
    const w = lastWorker();
    const error = new Error("no tsx");
    w.emit("error", error);
    await expect(pending).rejects.toBe(error);
    expect(w.terminated).toBe(1);
  });

  test("a worker that exits before it is ready rejects with its exit code", async () => {
    const pending = startRealm(
      "o",
      { invoke: async () => ({ result: 1 }) },
      async () => new Response(""),
      () => {},
    );
    const w = lastWorker();
    w.emit("exit", 3);
    await expect(pending).rejects.toThrow("group: user worker exited (3)");
    expect(running.size).toBe(0);
  });

  test("a thrown value that is not an Error is wrapped in one", async () => {
    const pending = startRealm(
      "o",
      { invoke: async () => ({ result: 1 }) },
      async () => new Response(""),
      () => {},
    );
    lastWorker().emit("error", "plain text");
    await expect(pending).rejects.toBe("plain text");
  });
});

describe("startRealm: calls", () => {
  test("a call posts its op and argument under the next id, and an ok answer resolves with its value", async () => {
    const { w, realm } = await start();
    const first = realm.call("open", { a: 1 });
    const second = realm.call("state", null);
    expect(w.posted).toEqual([
      { t: "call", id: 0, op: "open", arg: { a: 1 } },
      { t: "call", id: 1, op: "state", arg: null },
    ]);
    w.emit("message", { t: "ret", id: 1, ok: true, value: "two" });
    w.emit("message", { t: "ret", id: 0, ok: true, value: { n: 1 } });
    expect(await first).toEqual({ n: 1 });
    expect(await second).toBe("two");
  });

  test("a failed answer rejects with its message and code, or a default message and no code", async () => {
    const { w, realm } = await start();
    const coded = realm.call("a", null);
    const bare = realm.call("b", null);
    w.emit("message", { t: "ret", id: 0, ok: false, value: null, message: "nope", code: "E1" });
    w.emit("message", { t: "ret", id: 1, ok: false, value: null });
    const e1 = await coded.catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(Error);
    expect(e1).toMatchObject({ message: "nope", code: "E1" });
    const e2 = await bare.catch((e: unknown) => e);
    expect(e2).toBeInstanceOf(Error);
    expect(e2).toMatchObject({ message: "group: call failed" });
    expect(Object.keys(e2 ?? {})).not.toContain("code");
  });

  test("an answer that does not parse rejects its call as a bad answer, and one without an id rejects none", async () => {
    const { w, realm } = await start();
    const zero = realm.call("a", null);
    const one = realm.call("b", null);
    const two = realm.call("c", null);
    w.emit("message", { t: "ret", id: "1", ok: true, value: 1 });
    w.emit("message", { t: "ret", ok: true, value: 1 });
    w.emit("message", { t: "ret", id: 0, ok: "yes", value: 1 });
    const bad = await zero.catch((e: unknown) => e);
    expect(bad).toBeInstanceOf(TypeError);
    expect(String(bad)).toMatch(/^TypeError: group: bad answer: .+/);
    w.emit("message", { t: "ret", id: 1, ok: true, value: "still waiting" });
    w.emit("message", { t: "ret", id: 2, ok: true, value: "also" });
    expect(await one).toBe("still waiting");
    expect(await two).toBe("also");
  });

  test("an answer for a call that is not waiting is ignored, and a second answer does not change the first", async () => {
    const { w, realm } = await start();
    const call = realm.call("a", null);
    w.emit("message", { t: "ret", id: 9, ok: true, value: 1 });
    w.emit("message", { t: "ret", id: 0, ok: true, value: "first" });
    w.emit("message", { t: "ret", id: 0, ok: true, value: "second" });
    expect(await call).toBe("first");
  });

  test("a worker error rejects the calls in flight, and every later call, with it, posting nothing", async () => {
    const { w, realm } = await start();
    const flying = realm.call("a", null);
    const error = new Error("boom");
    w.emit("error", error);
    await expect(flying).rejects.toBe(error);
    const posted = w.posted.length;
    await expect(realm.call("b", null)).rejects.toBe(error);
    expect(w.posted.length).toBe(posted);
    w.emit("error", new Error("second"));
    await expect(realm.call("c", null)).rejects.toBe(error);
  });

  test("an error that is not an Error rejects the calls as an Error of its text", async () => {
    const { w, realm } = await start();
    const flying = realm.call("a", null);
    w.emit("error", 42);
    const e = await flying.catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).toMatchObject({ message: "42" });
  });

  test("an exit rejects the calls in flight with the code, once, and the calls after it too", async () => {
    const { w, realm } = await start();
    const flying = realm.call("a", null);
    w.emit("exit", 2);
    await expect(flying).rejects.toThrow("group: user worker exited (2)");
    await expect(realm.call("b", null)).rejects.toThrow("group: user worker exited (2)");
    expect(running.size).toBe(0);
  });

  test("a call answered before the worker failed is not rejected by it", async () => {
    const { w, realm } = await start();
    const call = realm.call("a", null);
    w.emit("message", { t: "ret", id: 0, ok: true, value: "done" });
    w.emit("error", new Error("late"));
    expect(await call).toBe("done");
  });

  test("terminate ends the worker, and calls after it reject as stopped", async () => {
    const { w, realm } = await start();
    const flying = realm.call("a", null);
    const ended = flying.catch((e: unknown) => e);
    await realm.terminate();
    expect(w.terminated).toBe(1);
    await tick();
    expect(await ended).toMatchObject({ message: "group: user worker exited (1)" });
    await expect(realm.call("b", null)).rejects.toThrow("group: stopped");
  });
});

describe("startRealm: requests from the worker", () => {
  test("a request reaches fetch with its method, url, headers and a copy of its body; the answer comes back head, chunks, end", async () => {
    const seen: Outgoing[] = [];
    const { w, log } = await start({
      fetch: async (req) => {
        seen.push(req);
        const body = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(bytes("ab"));
            c.enqueue(bytes("cd"));
            c.close();
          },
        });
        const headers = new Headers({ "Content-Type": "text/plain", "X-A": "1" });
        headers.append("Set-Cookie", "s=1");
        headers.append("SET-COOKIE", "t=2");
        return new Response(body, { status: 201, statusText: "Made", headers });
      },
    });
    const sent = bytes("payload");
    w.emit("message", {
      t: "req",
      rid: 4,
      method: "POST",
      url: "http://app.test/x?y=1",
      headers: [["a", "1"], ["b"], [], ["a", "2"]],
      body: sent,
    });
    await tick();
    expect(seen).toHaveLength(1);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.url).toBe("http://app.test/x?y=1");
    expect([...(seen[0]?.headers ?? [])]).toEqual([["a", "1, 2"]]);
    expect(seen[0]?.body).toEqual(sent);
    expect(seen[0]?.body).not.toBe(sent);
    expect(log).toStrictEqual([
      "touch",
      "touch",
      {
        t: "head",
        rid: 4,
        status: 201,
        statusText: "Made",
        headers: [
          ["content-type", "text/plain"],
          ["x-a", "1"],
        ],
      },
      "touch",
      { t: "chunk", rid: 4, data: bytes("ab") },
      "touch",
      { t: "chunk", rid: 4, data: bytes("cd") },
      "touch",
      { t: "end", rid: 4 },
    ]);
  });

  test("a request with no body, or a body that is not bytes, reaches fetch with a null body", async () => {
    const seen: Outgoing[] = [];
    const { w } = await start({
      fetch: async (req) => {
        seen.push(req);
        return new Response("");
      },
    });
    w.emit("message", { t: "req", rid: 1, method: "GET", url: "http://app.test/", headers: [] });
    w.emit("message", { t: "req", rid: 2, method: "GET", url: "http://app.test/", headers: [], body: "text" });
    await tick();
    expect(seen.map((r) => r.body)).toEqual([null, null]);
  });

  test("a response with no body is a head and an end", async () => {
    const { w, log } = await start({ fetch: async () => new Response(null, { status: 204 }) });
    w.emit("message", { t: "req", rid: 1, method: "GET", url: "http://app.test/", headers: [] });
    await tick();
    expect(log).toStrictEqual([
      "touch",
      "touch",
      { t: "head", rid: 1, status: 204, statusText: "", headers: [] },
      "touch",
      { t: "end", rid: 1 },
    ]);
  });

  test("a fetch that throws ends the request with its message, as text for a value that is not an Error", async () => {
    let n = 0;
    const { w, log } = await start({
      fetch: async () => {
        n++;
        if (n === 1) throw new Error("server down");
        throw "plain";
      },
    });
    w.emit("message", { t: "req", rid: 1, method: "GET", url: "http://app.test/", headers: [] });
    w.emit("message", { t: "req", rid: 2, method: "GET", url: "http://app.test/", headers: [] });
    await tick();
    expect(log).toStrictEqual([
      "touch",
      "touch",
      "touch",
      { t: "end", rid: 1, error: "server down" },
      "touch",
      { t: "end", rid: 2, error: "plain" },
    ]);
  });

  test("a body that breaks off ends the request with the error, after the chunks it gave", async () => {
    let step = 0;
    const { w, log } = await start({
      fetch: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(c) {
              step++;
              if (step === 1) c.enqueue(bytes("a"));
              else if (step === 2) c.error(new Error("cut"));
              else c.error("odd");
            },
          }),
        ),
    });
    w.emit("message", { t: "req", rid: 1, method: "GET", url: "http://app.test/", headers: [] });
    await tick();
    expect(log.filter((m) => typeof m === "object")).toStrictEqual([
      { t: "head", rid: 1, status: 200, statusText: "", headers: [] },
      { t: "chunk", rid: 1, data: bytes("a") },
      { t: "end", rid: 1, error: "cut" },
    ]);
    expect(log.filter((m) => m === "touch")).toHaveLength(4);
  });

  test("a body that breaks off with a value that is not an Error ends with its text", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.error("odd");
      },
    });
    const { w, log } = await start({ fetch: async () => new Response(stream) });
    w.emit("message", { t: "req", rid: 1, method: "GET", url: "http://app.test/", headers: [] });
    await tick();
    expect(log.at(-1)).toStrictEqual({ t: "end", rid: 1, error: "odd" });
  });

  test("a request that does not parse is not fetched and not heard", async () => {
    const fetched: Outgoing[] = [];
    const { w, touched } = await start({
      fetch: async (req) => {
        fetched.push(req);
        return new Response("");
      },
    });
    w.emit("message", { t: "req", rid: 1, method: "GET" });
    w.emit("message", { t: "req", rid: "1", method: "GET", url: "http://app.test/", headers: [] });
    await tick();
    expect(fetched).toEqual([]);
    expect(touched()).toBe(0);
  });
});

describe("startRealm: a body the worker cancels", () => {
  test("is cancelled at the server, and the cancel is heard", async () => {
    const cancelled: unknown[] = [];
    const { w, touched } = await start({
      fetch: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull: () => new Promise(() => undefined),
            cancel: (reason) => {
              cancelled.push(reason);
            },
          }),
        ),
    });
    w.emit("message", { t: "req", rid: 7, method: "GET", url: "http://app.test/", headers: [] });
    await tick();
    const before = touched();
    w.emit("message", { t: "cancel", rid: 8 });
    await tick();
    expect(cancelled).toEqual([]);
    expect(touched()).toBe(before + 1);
    w.emit("message", { t: "cancel", rid: 7 });
    await tick();
    expect(cancelled).toHaveLength(1);
    // The cancel is heard, and the body's end after it.
    expect(touched()).toBe(before + 3);
  });

  test("a cancel that does not parse is neither heard nor acted on", async () => {
    const { w, touched } = await start();
    w.emit("message", { t: "cancel" });
    w.emit("message", { t: "cancel", rid: "1" });
    await tick();
    expect(touched()).toBe(0);
  });

  test("a body that finished is no longer held: a cancel for it cancels nothing", async () => {
    const cancelled: unknown[] = [];
    const { w } = await start({
      fetch: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(bytes("x"));
              c.close();
            },
            cancel: (reason) => {
              cancelled.push(reason);
            },
          }),
        ),
    });
    w.emit("message", { t: "req", rid: 1, method: "GET", url: "http://app.test/", headers: [] });
    await tick();
    w.emit("message", { t: "cancel", rid: 1 });
    await tick();
    expect(cancelled).toEqual([]);
  });
});

describe("startRealm: module requests from the worker", () => {
  test("an invoke asks the project and the answer is posted back under the same id", async () => {
    const { w, invoked } = await start({
      invoke: async (data) =>
        data === "bad" ? { error: { name: "E", message: "m", stack: undefined } } : { result: [1] },
    });
    w.emit("message", { t: "invoke", id: 3, data: { file: "a" } });
    w.emit("message", { t: "invoke", id: 4, data: "bad" });
    await tick();
    expect(invoked).toEqual([{ file: "a" }, "bad"]);
    expect(w.posted).toEqual([
      { t: "invoked", id: 3, result: [1] },
      { t: "invoked", id: 4, error: { name: "E", message: "m" } },
    ]);
  });

  test("a project that throws is answered as an error of its message, or of its text", async () => {
    let n = 0;
    const { w } = await start({
      invoke: async () => {
        n++;
        if (n === 1) throw new Error("clone failed");
        throw "plain";
      },
    });
    w.emit("message", { t: "invoke", id: 1, data: null });
    w.emit("message", { t: "invoke", id: 2, data: null });
    await tick();
    expect(w.posted).toEqual([
      { t: "invoked", id: 1, error: { name: "Error", message: "clone failed" } },
      { t: "invoked", id: 2, error: { name: "Error", message: "plain" } },
    ]);
  });

  test("an invoke without a numeric id, and a message of another kind with one, asks nothing", async () => {
    const { w, invoked } = await start();
    w.emit("message", { t: "invoke", id: "1", data: null });
    w.emit("message", { t: "invoke", data: null });
    w.emit("message", { t: "other", id: 1, data: null });
    await tick();
    expect(invoked).toEqual([]);
    expect(w.posted).toEqual([]);
  });

  test("an answer that arrives after the worker failed is not posted", async () => {
    const releases: (() => void)[] = [];
    const { w } = await start({
      invoke: (data) =>
        new Promise((resolve, reject) => {
          releases.push(() => (data === "throw" ? reject(new Error("late")) : resolve({ result: 1 })));
        }),
    });
    w.emit("message", { t: "invoke", id: 1, data: "ok" });
    w.emit("message", { t: "invoke", id: 2, data: "throw" });
    w.emit("error", new Error("gone"));
    for (const release of releases) release();
    await tick();
    expect(w.posted).toEqual([]);
  });
});
