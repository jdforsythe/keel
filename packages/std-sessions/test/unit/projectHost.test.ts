// `projectHost`: a group's project host worker, here loaded in the test's own thread over a stand-in port and a
// stand-in Vite. What it refuses, how it configures the dev server, when it says it is ready, and how each module
// request is answered, with an error as its name, message and stack.
// Seed 1337 (no random inputs)
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type Answer = { result: unknown } | { error: unknown };
interface HostState {
  port: unknown;
  data: unknown;
  created: unknown[];
  events: string[];
  invoked: unknown[];
  answer: (payload: unknown) => Promise<Answer>;
}
const state = vi.hoisted(
  (): HostState => ({
    port: null,
    data: undefined,
    created: [],
    events: [],
    invoked: [],
    answer: async () => ({ result: null }),
  }),
);

vi.mock("node:worker_threads", () => ({
  get parentPort() {
    return state.port;
  },
  get workerData() {
    return state.data;
  },
}));
vi.mock("vite", () => ({
  createServer: async (options: unknown) => {
    state.created.push(options);
    state.events.push("server");
    return {
      environments: {
        ssr: {
          hot: {
            handleInvoke: (payload: unknown) => {
              state.invoked.push(payload);
              return state.answer(payload);
            },
          },
        },
      },
    };
  },
}));

class FakePort extends EventEmitter {
  readonly posted: unknown[] = [];
  postMessage(m: unknown): void {
    this.posted.push(m);
    state.events.push("post");
  }
}
let port = new FakePort();
const run = async (): Promise<void> => {
  vi.resetModules();
  await import("../../src/group/internal/projectHost.ts");
};
const tick = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

beforeEach(() => {
  port = new FakePort();
  state.port = port;
  state.data = { root: "/project" };
  state.created.length = 0;
  state.events.length = 0;
  state.invoked.length = 0;
  state.answer = async () => ({ result: null });
});
afterEach(() => {
  vi.resetModules();
});

describe("projectHost: what it refuses", () => {
  test("a root that is not text, or a config that is neither absent nor text", async () => {
    for (const data of [undefined, {}, { root: 5 }, { root: "/p", config: 5 }, { root: "/p", config: null }, null]) {
      state.data = data;
      await expect(run()).rejects.toThrow(new TypeError("group: bad project host data"));
    }
    expect(state.created).toEqual([]);
  });

  test("no parent port", async () => {
    state.port = null;
    await expect(run()).rejects.toThrow(new TypeError("group: no parent port"));
    expect(state.created).toEqual([]);
  });
});

describe("projectHost: the dev server", () => {
  const options = (root: string, configFile: string | false) => ({
    root,
    configFile,
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  test("with no config, Vite's own transform rooted at root", async () => {
    await run();
    expect(state.created).toEqual([options("/project", false)]);
  });

  test("with a config, that file", async () => {
    state.data = { root: "/p", config: "/p/vite.config.ts" };
    await run();
    expect(state.created).toEqual([options("/p", "/p/vite.config.ts")]);
  });

  test("it says ready once, after the server is up, and answers messages from then on", async () => {
    await run();
    expect(port.posted).toEqual([{ ready: true }]);
    expect(state.events).toEqual(["server", "post"]);
    expect(port.listenerCount("message")).toBe(1);
  });
});

describe("projectHost: module requests", () => {
  const ask = async (id: unknown, data: unknown): Promise<void> => {
    port.emit("message", { id, data });
    await tick();
  };

  test("a request is a vite:invoke custom payload, answered with its result under the same id", async () => {
    await run();
    state.answer = async () => ({ result: { code: "x" } });
    await ask(5, { name: "fetchModule", data: ["a"] });
    expect(state.invoked).toEqual([
      { type: "custom", event: "vite:invoke", data: { name: "fetchModule", data: ["a"] } },
    ]);
    expect(port.posted.at(-1)).toStrictEqual({ id: 5, result: { code: "x" } });
  });

  test("an error answer is its name, message and stack", async () => {
    await run();
    const error = new TypeError("bad import");
    state.answer = async () => ({ error });
    await ask(6, null);
    expect(port.posted.at(-1)).toStrictEqual({
      id: 6,
      error: { name: "TypeError", message: "bad import", stack: error.stack },
    });
  });

  test("an error that is a plain object, one with fields that are not text, null, or text", async () => {
    await run();
    const cases: [unknown, { name: string; message: string; stack: string | undefined }][] = [
      [
        { name: "Custom", message: "m", stack: "at x" },
        { name: "Custom", message: "m", stack: "at x" },
      ],
      [
        { name: 4, message: 5, stack: 6 },
        { name: "Error", message: "[object Object]", stack: undefined },
      ],
      [{ message: "only" }, { name: "Error", message: "only", stack: undefined }],
      [null, { name: "Error", message: "null", stack: undefined }],
      ["boom", { name: "Error", message: "boom", stack: undefined }],
    ];
    for (const [error, plain] of cases) {
      state.answer = async () => ({ error });
      await ask(1, null);
      expect(port.posted.at(-1)).toStrictEqual({ id: 1, error: plain });
    }
  });

  test("a request the server throws on is answered as an error, whatever it threw", async () => {
    await run();
    state.answer = async () => {
      throw new RangeError("exploded");
    };
    await ask(7, null);
    expect(port.posted.at(-1)).toStrictEqual({
      id: 7,
      error: { name: "RangeError", message: "exploded", stack: expect.stringContaining("exploded") },
    });
    state.answer = async () => {
      throw "plain";
    };
    await ask(8, null);
    expect(port.posted.at(-1)).toStrictEqual({ id: 8, error: { name: "Error", message: "plain", stack: undefined } });
  });
});
