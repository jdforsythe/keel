// The type of service made best effort on the sockets the platform fetch connects: one subscription to the process's
// `undici:client:connected` channel, a socket whose `setTypeOfService` leaves the type of service unset on EINVAL, and
// nothing where the runtime has no such channel.
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
});

interface Sub {
  readonly name: unknown;
  readonly listener: unknown;
  readonly self: unknown;
}

/** Runs a fresh copy of the module twice with `host` as the global `process`. */
async function install(host: unknown): Promise<void> {
  vi.resetModules();
  const mod = await import("../src/internal/typeOfServiceBestEffort.ts");
  vi.stubGlobal("process", host);
  try {
    mod.typeOfServiceBestEffort();
    mod.typeOfServiceBestEffort();
  } finally {
    vi.unstubAllGlobals();
  }
}

/** A `process` whose `node:diagnostics_channel` records each subscription. */
function node(): { host: object; channels: object; subs: Sub[]; asked: unknown[] } {
  const subs: Sub[] = [];
  const asked: unknown[] = [];
  const channels = {
    subscribe(this: unknown, name: unknown, listener: unknown): void {
      subs.push({ name, listener, self: this });
    },
  };
  const host = {
    getBuiltinModule(this: unknown, id: unknown): unknown {
      asked.push([this === host, id]);
      return channels;
    },
  };
  return { host, channels, subs, asked };
}

/** Installs on a recording `process` and returns the way to publish one message on the channel. */
async function channel(): Promise<(message: unknown) => void> {
  const n = node();
  await install(n.host);
  const listener = n.subs[0]?.listener;
  if (typeof listener !== "function") throw new Error("no subscription");
  return (message) => {
    Reflect.apply(listener, undefined, [message]);
  };
}

class Socket {
  readonly calls: unknown[] = [];
  constructor(private readonly fail?: unknown) {}
  setTypeOfService(tos: number): unknown {
    this.calls.push(tos);
    if (this.fail !== undefined) throw this.fail;
    return "set";
  }
}

const coded = (code: string): Error => Object.assign(new Error(`setTypeOfService ${code}`), { code });

describe("typeOfServiceBestEffort", () => {
  test("subscribes once to undici:client:connected on the process's diagnostics_channel module", async () => {
    const n = node();
    await install(n.host);
    expect(n.asked).toEqual([[true, "node:diagnostics_channel"]]);
    expect(n.subs).toHaveLength(1);
    expect(n.subs[0]?.name).toBe("undici:client:connected");
    expect(n.subs[0]?.self).toBe(n.channels);
    expect(typeof n.subs[0]?.listener).toBe("function");
  });

  test.each<[string, unknown]>([
    ["no process", undefined],
    ["a null process", null],
    ["a process that is a string", "process"],
    ["a process that is a number", 7],
    ["a process without getBuiltinModule", {}],
    ["a getBuiltinModule that is no function", { getBuiltinModule: "node" }],
    ["no diagnostics_channel module", { getBuiltinModule: () => undefined }],
    ["a null module", { getBuiltinModule: () => null }],
    ["a module that is a string", { getBuiltinModule: () => "channels" }],
    ["a module without subscribe", { getBuiltinModule: () => ({}) }],
    ["a subscribe that is no function", { getBuiltinModule: () => ({ subscribe: 1 }) }],
  ])("does nothing with %s", async (_, host) => {
    await expect(install(host)).resolves.toBeUndefined();
  });

  test.each<[string, unknown]>([
    ["undefined", undefined],
    ["null", null],
    ["a string", "connected"],
    ["a number", 3],
    ["an object without a socket", {}],
    ["an undefined socket", { socket: undefined }],
    ["a null socket", { socket: null }],
    ["a socket that is a string", { socket: "socket" }],
    ["a socket without setTypeOfService", { socket: {} }],
  ])("ignores a message that is %s", async (_, message) => {
    const publish = await channel();
    expect(() => publish(message)).not.toThrow();
  });

  test("leaves a setTypeOfService that is no function as it is", async () => {
    const publish = await channel();
    const socket = { setTypeOfService: "unset" };
    publish({ socket });
    expect(socket.setTypeOfService).toBe("unset");
  });

  test("the socket's setTypeOfService still sets the type of service and returns what the platform's returns", async () => {
    const publish = await channel();
    const socket = new Socket();
    publish({ socket });
    expect(socket.setTypeOfService(8)).toBe("set");
    expect(socket.calls).toEqual([8]);
  });

  test("an EINVAL leaves the type of service unset and returns the socket", async () => {
    const publish = await channel();
    const socket = new Socket(coded("EINVAL"));
    publish({ socket });
    expect(socket.setTypeOfService(8)).toBe(socket);
    expect(socket.calls).toEqual([8]);
  });

  test.each<[string, unknown]>([
    ["an error with another code", coded("EBADF")],
    ["an error without a code", new Error("plain")],
    ["a thrown value that is no Error", { code: "EINVAL" }],
  ])("%s is thrown on", async (_, thrown) => {
    const publish = await channel();
    const socket = new Socket(thrown);
    publish({ socket });
    let caught: unknown;
    try {
      socket.setTypeOfService(8);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBe(thrown);
  });

  test("only that socket changes, and its method can be set or removed again", async () => {
    const publish = await channel();
    const original = Socket.prototype.setTypeOfService;
    const socket = new Socket(coded("EINVAL"));
    const other = new Socket(coded("EINVAL"));
    publish({ socket });
    expect(Socket.prototype.setTypeOfService).toBe(original);
    expect(() => other.setTypeOfService(8)).toThrow("EINVAL");
    const replacement = (): string => "replaced";
    expect(Reflect.set(socket, "setTypeOfService", replacement)).toBe(true);
    expect(Reflect.get(socket, "setTypeOfService")).toBe(replacement);
    expect(Reflect.deleteProperty(socket, "setTypeOfService")).toBe(true);
    expect(socket.setTypeOfService).toBe(original);
  });
});
