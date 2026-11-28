// `userWorker`: the entry a group user's worker runs, here loaded in the test's own thread over a stand-in port and
// stand-ins for the DOM and the project loader. What it refuses, the order it sets up in, what it hands the realm, and
// when it says it is ready.
// Seed 1337 (no random inputs)
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

interface Port {
  postMessage(m: unknown): void;
}
interface WorkerState {
  port: Port | null;
  data: unknown;
  events: unknown[];
  module: unknown;
}
const state = vi.hoisted((): WorkerState => ({ port: null, data: undefined, events: [], module: undefined }));

vi.mock("node:worker_threads", () => ({
  get parentPort() {
    return state.port;
  },
  get workerData() {
    return state.data;
  },
}));
vi.mock("../../src/group/internal/installDom.ts", () => ({
  installDom: async (origin: string) => {
    state.events.push(["dom", origin]);
  },
}));
vi.mock("../../src/group/internal/projectLoader.ts", () => ({
  projectLoader: (port: unknown) => {
    state.events.push(["loader", port]);
    return async (url: string) => {
      state.events.push(["load", url]);
      return state.module;
    };
  },
}));

const posted: unknown[] = [];
const port: Port = {
  postMessage: (m) => {
    posted.push(m);
    state.events.push(["post", m]);
  },
};
const run = async (): Promise<void> => {
  vi.resetModules();
  await import("../../src/group/internal/userWorker.ts");
};

beforeEach(() => {
  state.port = port;
  state.data = { origin: "http://app.test" };
  state.events.length = 0;
  state.module = undefined;
  posted.length = 0;
});
afterEach(() => {
  vi.resetModules();
});

describe("userWorker: what it refuses", () => {
  test("worker data without a string origin", async () => {
    for (const data of [undefined, {}, { origin: 5 }, null]) {
      state.data = data;
      await expect(run()).rejects.toThrow(new TypeError("group: bad worker data"));
    }
    expect(state.events).toEqual([]);
  });

  test("no parent port", async () => {
    state.port = null;
    await expect(run()).rejects.toThrow(new TypeError("group: no parent port"));
    expect(state.events).toEqual([]);
  });

  test("a project whose userRealm is not a function, which is not announced ready", async () => {
    for (const module of [undefined, {}, { userRealm: "no" }]) {
      state.module = module;
      await expect(run()).rejects.toThrow(new TypeError("group: userRealm did not load"));
    }
    expect(posted).toEqual([]);
  });
});

describe("userWorker: starting", () => {
  test("the DOM first, then the loader on the port, then the realm module, then the realm, then ready", async () => {
    const calls: unknown[][] = [];
    const self: unknown[] = [];
    state.module = {
      userRealm: function (this: unknown, ...args: unknown[]) {
        self.push(this);
        calls.push(args);
        state.events.push(["realm"]);
      },
    };
    await run();
    const [first, second, third, fourth, fifth] = state.events;
    expect(first).toEqual(["dom", "http://app.test"]);
    expect(second).toEqual(["loader", port]);
    expect(Array.isArray(third) && third[0]).toBe("load");
    const url = Array.isArray(third) ? String(third[1]) : "";
    expect(url.startsWith("file:")).toBe(true);
    expect(url.endsWith("/group/internal/userRealm.ts")).toBe(true);
    expect(fourth).toEqual(["realm"]);
    expect(fifth).toEqual(["post", { t: "ready" }]);
    expect(state.events).toHaveLength(5);
    expect(self).toEqual([undefined]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(port);
    expect(typeof calls[0]?.[1]).toBe("function");
    const load = calls[0]?.[1];
    expect(typeof load === "function" && (await load("file:///x.ts"))).toBe(state.module);
  });
});
