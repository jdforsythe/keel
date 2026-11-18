// Shared fixtures for the std.shells conformance files of `@keel/std-capacitor` (not a test file).
// Assumptions (the spec does not say):
// - Storage runs on Capacitor's own web `Preferences` over the jsdom-like `localStorage` (no stand-in); a "restart" is a fresh `capacitorDrivers` over the same `localStorage`.
// - The package's native plugin `KeelHttp` is stood in for by `keelHttp`, which the package reaches through `registerPlugin('KeelHttp')` from `@capacitor/core`
//   (installed with `vi.mock` in each test file that uses the network; `registerPlugin` of any other name is left as it is). Its call shape follows the plugin's description:
//   - `request({ id, url, method, headers, data })`: `id` is a string the page chooses, `headers` a record, `data` the body as text and absent for no body;
//     it resolves when the response headers arrive with `{ status, headers }`, the headers without `set-cookie` (the native cookie store keeps it), and rejects for a failure before the headers.
//   - The body follows as events delivered to listeners added with `addListener(name, callback)` (which resolves to a handle with `remove()`):
//     `chunk` `{ id, data }` with `data` base64 of at most 16 KiB, then `end` `{ id }` or `fail` `{ id, message }`.
//     An event waits until a listener of its name exists, so a listener added after `request` resolves still gets the body.
//   - `cancel({ id })` disconnects the native request: nothing more is delivered for `id`, and `id` is recorded in `native.cancelled`.
// - The native side owns the cookie jar (`native.jar`, by origin): it adds `cookie` to a request and keeps a `set-cookie` of a response, as the native HTTP client does.
// - A page at `<origin>` is a stubbed global `location` with `origin`, `protocol`, `host`, `hostname`, `href`; requests to the page use absolute URLs on it.
import { vi } from "vitest";

export const ORIGIN = new URL("https://golden-1.example");
export const OTHER = "https://other.example";
export const PAGES = ["capacitor://localhost", "https://localhost"] as const;

/** What reached the native HTTP client: the final URL, method, lower-cased headers and the body text. */
export interface Wire {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
}
export interface Reply {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /** The body as chunks the native side sends one by one, each when the iterator yields it; used in place of `body`. */
  readonly chunks?: AsyncIterable<string>;
}
export type Backend = (req: Wire) => Reply;

export interface Native {
  readonly wire: Wire[];
  /** The `id` of each request, in the order of `wire`. */
  readonly ids: string[];
  /** The `id` of each `cancel` call. */
  readonly cancelled: string[];
  readonly jar: Map<string, Map<string, string>>;
  backend: Backend;
  refuse: boolean;
  reset(): void;
}

const ok: Backend = () => ({ status: 200, body: "ok" });

export const native: Native = {
  wire: [],
  ids: [],
  cancelled: [],
  jar: new Map(),
  backend: ok,
  refuse: false,
  reset() {
    this.wire.length = 0;
    this.ids.length = 0;
    this.cancelled.length = 0;
    this.jar.clear();
    this.backend = ok;
    this.refuse = false;
    queue.length = 0;
  },
};

const lower = (h: Readonly<Record<string, string>> | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h ?? {})) out[k.toLowerCase()] = v;
  return out;
};

const field = (o: unknown, key: string): unknown =>
  typeof o === "object" && o !== null ? Reflect.get(o, key) : undefined;
const text = (v: unknown): string => (typeof v === "string" ? v : "");

type EventName = "chunk" | "end" | "fail";
interface NativeEvent {
  readonly id: string;
  readonly name: EventName;
  readonly payload: Readonly<Record<string, string>>;
}
const queue: NativeEvent[] = [];
const listeners = new Map<string, Set<(payload: unknown) => void>>();
const gone = new Set<string>();

/** Delivers queued events in order while a listener of the head event's name exists. */
const flush = (): void => {
  for (;;) {
    const head = queue[0];
    if (head === undefined) return;
    const mine = listeners.get(head.name);
    if (mine === undefined || mine.size === 0) return;
    queue.shift();
    for (const listener of [...mine]) listener(head.payload);
  }
};
const emit = (event: NativeEvent): void => {
  if (gone.has(event.id)) return;
  queue.push(event);
  flush();
};

const CHUNK = 16 * 1024;
const send = async (id: string, reply: Reply): Promise<void> => {
  try {
    const parts: AsyncIterable<string> | Iterable<string> = reply.chunks ?? [reply.body ?? ""];
    for await (const part of parts) {
      const bytes = Buffer.from(part, "utf8");
      for (let at = 0; at < bytes.length; at += CHUNK) {
        if (gone.has(id)) return;
        emit({ id, name: "chunk", payload: { id, data: bytes.subarray(at, at + CHUNK).toString("base64") } });
      }
      if (gone.has(id)) return;
    }
    emit({ id, name: "end", payload: { id } });
  } catch (error) {
    emit({ id, name: "fail", payload: { id, message: String(error) } });
  }
};

const request = async (o: unknown): Promise<{ status: number; headers: Record<string, string> }> => {
  const id = text(field(o, "id"));
  const url = new URL(text(field(o, "url"))).href;
  const origin = new URL(url).origin;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(Object(field(o, "headers")))) headers[k.toLowerCase()] = text(v);
  const jar = native.jar.get(origin);
  if (jar && jar.size > 0) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const data = field(o, "data");
  const wire: Wire = {
    url,
    method: (text(field(o, "method")) || "GET").toUpperCase(),
    headers,
    body: typeof data === "string" ? data : null,
  };
  native.wire.push(wire);
  native.ids.push(id);
  if (native.refuse) throw new Error(`Connection refused: ${origin}`);
  const reply = native.backend(wire);
  const cookie = lower(reply.headers)["set-cookie"];
  if (cookie !== undefined) {
    const pair = cookie.split(";")[0] ?? "";
    const at = pair.indexOf("=");
    const jarOf = native.jar.get(origin) ?? new Map<string, string>();
    jarOf.set(pair.slice(0, at), pair.slice(at + 1));
    native.jar.set(origin, jarOf);
  }
  gone.delete(id);
  queueMicrotask(() => {
    void send(id, reply);
  });
  const shown: Record<string, string> = {};
  for (const [k, v] of Object.entries(reply.headers ?? {})) if (k.toLowerCase() !== "set-cookie") shown[k] = v;
  return { status: reply.status, headers: shown };
};

/** The stand-in for the package's `KeelHttp` plugin. */
export const keelHttp = {
  request,
  async cancel(o: unknown): Promise<void> {
    const id = text(field(o, "id"));
    native.cancelled.push(id);
    gone.add(id);
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i]?.id === id) queue.splice(i, 1);
  },
  async addListener(name: string, callback: (payload: unknown) => void): Promise<{ remove(): Promise<void> }> {
    const mine = listeners.get(name) ?? new Set<(payload: unknown) => void>();
    mine.add(callback);
    listeners.set(name, mine);
    queueMicrotask(flush);
    return {
      async remove() {
        mine.delete(callback);
      },
    };
  },
  async removeAllListeners(): Promise<void> {
    listeners.clear();
  },
};

/** `registerPlugin` of `@capacitor/core` with `KeelHttp` stood in for; `real` is the original. */
export const registerPlugin =
  (real: unknown) =>
  (name: string, implementations?: unknown): unknown =>
    name === "KeelHttp" ? keelHttp : Reflect.apply(Object(real), undefined, [name, implementations]);

/** The stand-in for `CapacitorCookies`, over the same native jar. */
export const nativeCookies = {
  async getCookies(o?: { url?: string }) {
    const out: Record<string, string> = {};
    for (const [k, v] of native.jar.get(new URL(o?.url ?? ORIGIN.href).origin) ?? []) out[k] = v;
    return out;
  },
  async setCookie(o: { url?: string; key: string; value: string }) {
    const origin = new URL(o.url ?? ORIGIN.href).origin;
    const jar = native.jar.get(origin) ?? new Map<string, string>();
    jar.set(o.key, o.value);
    native.jar.set(origin, jar);
  },
  async deleteCookie(o: { url?: string; key: string }) {
    native.jar.get(new URL(o.url ?? ORIGIN.href).origin)?.delete(o.key);
  },
  async clearCookies(o?: { url?: string }) {
    native.jar.delete(new URL(o?.url ?? ORIGIN.href).origin);
  },
  async clearAllCookies() {
    native.jar.clear();
  },
};

/** Puts the page at `origin` (the shell's own origin) for the rest of the test. */
export function pageAt(origin: string): void {
  const u = new URL(`${origin}/`);
  vi.stubGlobal("location", {
    href: u.href,
    origin,
    protocol: u.protocol,
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    pathname: "/",
    search: "",
    hash: "",
  });
}

/** `localStorage` is the Preferences store of the web implementation; an empty one is a fresh install. */
export function freshInstall(): void {
  localStorage.clear();
  native.reset();
}

/** The native side as the test files see it; the same shape in `@keel/std-tauri`'s fixtures. */
export interface World {
  readonly wire: Wire[];
  readonly jar: Map<string, Map<string, string>>;
  backend(b: Backend): void;
  refuse(on: boolean): void;
  /** The `id` of each request, in the order of `wire`. */
  readonly ids: string[];
  /** The `id` of each `cancel` call the native plugin got. */
  readonly cancelled: string[];
  /** An app restart: what the native store keeps survives, the rest is dropped (nothing to drop here: `localStorage` is the store). */
  restart(): void;
  /** Empties the native store between property runs. */
  wipe(): void;
}

/** A fresh install with the page at `page`. Call `end` in `afterEach`. */
export function begin(page: string): World {
  freshInstall();
  pageAt(page);
  return {
    wire: native.wire,
    jar: native.jar,
    ids: native.ids,
    cancelled: native.cancelled,
    backend: (b) => {
      native.backend = b;
    },
    refuse: (on) => {
      native.refuse = on;
    },
    restart: () => {},
    wipe: () => localStorage.clear(),
  };
}

export function end(): void {
  vi.unstubAllGlobals();
  native.reset();
}
