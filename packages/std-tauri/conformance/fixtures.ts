// Shared fixtures for the std.shells conformance files of `@keel/std-tauri` (not a test file).
// Assumptions (the spec does not say):
// - Tauri's `mockIPC` stands in for the native side: `plugin:store|*` and `plugin:http|*` commands are answered by `FakeShell`; both plugins run unmodified over it.
//   `mockIPC` hides the `invoke` options, which carry the plugin-http `client-config` header, so `installShell` wraps `invoke` to read it.
// - The store keeps an in-memory copy per loaded resource and a "disk" of bytes per file path; `save` writes the memory to the file as JSON text the way `fs::write` does
//   (the file is emptied, then written), and so does `set`/`delete`/`clear` when `load` is given `autoSave: 0`.
//   `restartApp()` drops every loaded resource (and with it the unsaved memory): the disk is what survives.
// - `load` ignores a file it cannot read or parse and opens an empty store, as the plugin does; `reload` rejects with a string, as a Tauri command does:
//   `Failed to deserialize store: ...` for a file that is not a JSON object, `No such file or directory (os error 2)` for a missing one.
// - `cutSave(path, bytes)` arms a kill inside the next `save` to `path`: the file keeps the first `bytes` bytes of what the save writes (all of it when `bytes` is at least its length),
//   the save rejects, and every later command rejects until `restartApp()`, as for a process that is gone.
// - A reply's `chunks` (an async iterable of text) is read one chunk per `fetch_read_body`, so the native side sends each chunk when the iterable yields it.
// - The native side owns the cookie jar (`jar`, by origin): it adds `cookie` to a request and keeps a `set-cookie` of a response, as the plugin's HTTP client does.
// - A page at `<origin>` is a stubbed global `location`; requests to the page use absolute URLs on it.
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { vi } from "vitest";

export const ORIGIN = new URL("https://golden-1.example");
export const OTHER = "https://other.example";
export const PAGES = ["tauri://localhost", "https://localhost"] as const;
export const STORE_FILE = "keel.json";
export const BACKUP_FILE = "keel.b.json";

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

interface Resource {
  readonly path: string;
  readonly data: Map<string, unknown>;
  readonly autoSave: boolean;
}
interface Pending {
  readonly wire: Wire;
  /** `maxRedirections` of the request's client config; absent means the plugin's default of 10. */
  readonly maxRedirections: number;
}
interface Body {
  readonly bytes: number[];
  readonly chunks: AsyncIterator<string> | undefined;
  sent: boolean;
}

export interface FakeShell {
  /** The bytes of each file the store has saved, by path. */
  readonly disk: Map<string, Buffer>;
  /** Paths `plugin:store|load` was asked for, in order. */
  readonly loads: string[];
  /** What reached the native HTTP client. */
  readonly wire: Wire[];
  readonly jar: Map<string, Map<string, string>>;
  backend: Backend;
  refuse: boolean;
  /** The saved file as text, for a substring check. */
  onDisk(path?: string): string;
  /** The plugin commands `fetch_cancel` and `fetch_cancel_body` that reached the native side, in order. */
  readonly cancelled: string[];
  /** The next `save` to `path` is killed after `bytes` bytes. */
  cutSave(path: string, bytes: number): void;
  /** Whether a kill ended a save (set by the kill, cleared by `restartApp`). */
  killed: boolean;
  /** Whether the kill cut the file short, not after its last byte. */
  cutShort: boolean;
  /** Drops loaded resources and unsaved memory; the disk stays. */
  restartApp(): void;
}

const ok: Backend = () => ({ status: 200, body: "ok" });

const field = (payload: unknown, key: string): unknown =>
  typeof payload === "object" && payload !== null && !ArrayBuffer.isView(payload)
    ? Reflect.get(payload, key)
    : undefined;
const text = (v: unknown): string => (typeof v === "string" ? v : "");
/** The entries of a store file, or `undefined` for bytes that are not a JSON object. */
const parseStore = (bytes: Buffer): Map<string, unknown> | undefined => {
  try {
    const v: unknown = JSON.parse(bytes.toString("utf8"));
    if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
    return new Map(Object.entries(v));
  } catch {
    return undefined;
  }
};
const num = (v: unknown): number => (typeof v === "number" ? v : -1);
const lowered = (h: Readonly<Record<string, string>> | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h ?? {})) out[k.toLowerCase()] = v;
  return out;
};

function isInvoker(x: unknown): x is { invoke: (cmd: string, args?: unknown, options?: unknown) => Promise<unknown> } {
  return typeof x === "object" && x !== null && typeof Reflect.get(x, "invoke") === "function";
}

/** Installs the fake native side for the rest of the test; call `removeShell` in `afterEach`. */
export function installShell(): FakeShell {
  const disk = new Map<string, Buffer>();
  const cancelled: string[] = [];
  let cut: { readonly path: string; readonly bytes: number } | undefined;
  const resources = new Map<number, Resource>();
  const pending = new Map<number, Pending>();
  const bodies = new Map<number, Body>();
  const wire: Wire[] = [];
  const loads: string[] = [];
  const jar = new Map<string, Map<string, string>>();
  let next = 1;
  let options: unknown;

  const shell: FakeShell = {
    disk,
    loads,
    wire,
    jar,
    backend: ok,
    refuse: false,
    onDisk: (path = STORE_FILE) => disk.get(path)?.toString("utf8") ?? "",
    cancelled,
    cutSave: (path, bytes) => {
      cut = { path, bytes };
    },
    killed: false,
    cutShort: false,
    restartApp: () => {
      shell.killed = false;
      cut = undefined;
      resources.clear();
      pending.clear();
      bodies.clear();
    },
  };

  const res = (payload: unknown): Resource => {
    const r = resources.get(num(field(payload, "rid")));
    if (r === undefined) throw new Error("resource id invalid");
    return r;
  };
  const save = (r: Resource): void => {
    const whole = Buffer.from(JSON.stringify(Object.fromEntries(r.data)), "utf8");
    if (cut !== undefined && cut.path === r.path) {
      const kept = cut.bytes;
      cut = undefined;
      disk.set(r.path, Buffer.alloc(0));
      disk.set(r.path, whole.subarray(0, kept));
      shell.cutShort = kept < whole.length;
      shell.killed = true;
      throw "the process was killed inside the save";
    }
    disk.set(r.path, whole);
  };
  const touched = (r: Resource): void => {
    if (r.autoSave) save(r);
  };

  const store = (cmd: string, payload: unknown): unknown => {
    switch (cmd) {
      case "load": {
        const path = text(field(payload, "path"));
        loads.push(path);
        const existing = [...resources].find(([, r]) => r.path === path);
        if (existing) return existing[0];
        const rid = next++;
        const auto = field(field(payload, "options"), "autoSave") === 0;
        const bytes = disk.get(path);
        resources.set(rid, { path, data: (bytes && parseStore(bytes)) ?? new Map(), autoSave: auto });
        return rid;
      }
      case "get_store": {
        const path = text(field(payload, "path"));
        return [...resources].find(([, r]) => r.path === path)?.[0] ?? null;
      }
      case "set": {
        const r = res(payload);
        r.data.set(text(field(payload, "key")), field(payload, "value"));
        touched(r);
        return null;
      }
      case "get": {
        const r = res(payload);
        const key = text(field(payload, "key"));
        return [r.data.get(key) ?? null, r.data.has(key)];
      }
      case "has":
        return res(payload).data.has(text(field(payload, "key")));
      case "delete": {
        const r = res(payload);
        const had = r.data.delete(text(field(payload, "key")));
        touched(r);
        return had;
      }
      case "clear":
      case "reset": {
        const r = res(payload);
        r.data.clear();
        touched(r);
        return null;
      }
      case "keys":
        return [...res(payload).data.keys()];
      case "values":
        return [...res(payload).data.values()];
      case "entries":
        return [...res(payload).data];
      case "length":
        return res(payload).data.size;
      case "reload": {
        const r = res(payload);
        const bytes = disk.get(r.path);
        if (bytes === undefined) throw "No such file or directory (os error 2)";
        const entries = parseStore(bytes);
        if (entries === undefined) throw "Failed to deserialize store: expected a JSON object";
        r.data.clear();
        for (const [k, v] of entries) r.data.set(k, v);
        return null;
      }
      case "save":
        save(res(payload));
        return null;
      default:
        throw new Error(`unknown command plugin:store|${cmd}`);
    }
  };

  const http = (cmd: string, payload: unknown): unknown => {
    switch (cmd) {
      case "fetch": {
        const header = field(options, "headers");
        const raw: unknown = JSON.parse(decodeURIComponent(text(field(header, "client-config"))));
        const headers: Record<string, string> = {};
        const pairs = field(raw, "headers");
        if (Array.isArray(pairs)) {
          for (const pair of pairs) {
            if (Array.isArray(pair)) headers[text(pair[0]).toLowerCase()] = text(pair[1]);
          }
        }
        const bytes = payload instanceof Uint8Array ? payload : new Uint8Array();
        const rid = next++;
        const maxRaw = field(raw, "maxRedirections");
        pending.set(rid, {
          maxRedirections: typeof maxRaw === "number" ? maxRaw : 10,
          wire: {
            url: text(field(raw, "url")),
            method: text(field(raw, "method")).toUpperCase(),
            headers,
            body: bytes.byteLength > 0 ? new TextDecoder().decode(bytes) : null,
          },
        });
        return rid;
      }
      case "fetch_send": {
        const p = pending.get(num(field(payload, "rid")));
        if (p === undefined) throw new Error("request id invalid");
        // The native client follows a 3xx with a `location` as GET, at most `maxRedirections` times, storing each response's `set-cookie` (RFC 0142: `maxRedirections: 0` is manual).
        let at: Wire = p.wire;
        let reply: Reply = ok(at);
        let finalUrl = p.wire.url;
        for (let hops = 0; ; hops++) {
          const origin = new URL(at.url).origin;
          const headers = { ...at.headers };
          const cookies = jar.get(origin);
          if (cookies && cookies.size > 0) headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
          const seen: Wire = { ...at, headers };
          wire.push(seen);
          if (shell.refuse) throw `error sending request for url (${at.url}): connection refused`;
          reply = shell.backend(seen);
          finalUrl = at.url;
          const cookie = lowered(reply.headers)["set-cookie"];
          if (cookie !== undefined) {
            const pair = cookie.split(";")[0] ?? "";
            const eq = pair.indexOf("=");
            const mine = jar.get(origin) ?? new Map<string, string>();
            mine.set(pair.slice(0, eq), pair.slice(eq + 1));
            jar.set(origin, mine);
          }
          const to = lowered(reply.headers).location;
          if (reply.status < 300 || reply.status > 399 || to === undefined || hops >= p.maxRedirections) break;
          at = { url: new URL(to, at.url).href, method: "GET", headers: {}, body: null };
        }
        const bodyRid = next++;
        bodies.set(bodyRid, {
          bytes: [...new TextEncoder().encode(reply.body ?? "")],
          chunks: reply.chunks?.[Symbol.asyncIterator](),
          sent: false,
        });
        return {
          status: reply.status,
          statusText: "",
          url: finalUrl,
          headers: Object.entries(reply.headers ?? {}),
          rid: bodyRid,
        };
      }
      case "fetch_read_body": {
        const b = bodies.get(num(field(payload, "rid")));
        if (b === undefined) throw new Error("body id invalid");
        if (b.chunks !== undefined) {
          return b.chunks.next().then((n) => (n.done === true ? [1] : [...new TextEncoder().encode(n.value), 0]));
        }
        if (b.sent) return [1];
        b.sent = true;
        return [...b.bytes, 0];
      }
      case "fetch_cancel":
      case "fetch_cancel_body":
        cancelled.push(cmd);
        return null;
      default:
        throw new Error(`unknown command plugin:http|${cmd}`);
    }
  };

  mockIPC((cmd, payload) => {
    if (shell.killed) throw "the process is gone";
    if (cmd.startsWith("plugin:store|")) return store(cmd.slice("plugin:store|".length), payload);
    if (cmd.startsWith("plugin:http|")) return http(cmd.slice("plugin:http|".length), payload);
    if (cmd === "plugin:resources|close") return null;
    throw new Error(`unknown command ${cmd}`);
  });
  const internals: unknown = Reflect.get(window, "__TAURI_INTERNALS__");
  if (!isInvoker(internals)) throw new Error("mockIPC did not install __TAURI_INTERNALS__");
  const inner = internals.invoke.bind(internals);
  internals.invoke = (cmd, args, opts) => {
    options = opts;
    return inner(cmd, args, opts);
  };
  return shell;
}

export function removeShell(): void {
  clearMocks();
  vi.unstubAllGlobals();
}

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

/** The native side as the test files see it; `@keel/std-capacitor`'s fixtures have the same shape without the file methods. */
export interface World {
  readonly wire: Wire[];
  readonly jar: Map<string, Map<string, string>>;
  backend(b: Backend): void;
  refuse(on: boolean): void;
  /** An app restart: loaded store resources and their unsaved memory are dropped; the saved file stays. */
  restart(): void;
  /** Empties the saved file and drops loaded resources between property runs. */
  wipe(): void;
  /** The saved `keel.json` and `keel.b.json` as text, one after the other. */
  saved(): string;
  /** The saved file at `path` as text; `undefined` when there is none. */
  read(path: string): string | undefined;
  /** Puts `text` in the saved file at `path`, as if an earlier run had left it. */
  write(path: string, text: string): void;
  /** Removes the saved file at `path`. */
  remove(path: string): void;
  /** The next `save` to `path` is killed after `bytes` bytes (see the assumptions). */
  cutSave(path: string, bytes: number): void;
  /** Whether the last kill cut a file short, not after its last byte. */
  cutShort(): boolean;
  /** The `fetch_cancel` and `fetch_cancel_body` commands that reached the native side. */
  readonly cancelled: string[];
}

/** A fresh install with the page at `page`. Call `end` in `afterEach`. */
export function begin(page: string): World {
  const shell = installShell();
  pageAt(page);
  return {
    wire: shell.wire,
    jar: shell.jar,
    backend: (b) => {
      shell.backend = b;
    },
    refuse: (on) => {
      shell.refuse = on;
    },
    restart: () => shell.restartApp(),
    wipe: () => {
      shell.disk.clear();
      shell.cancelled.length = 0;
      shell.cutShort = false;
      shell.restartApp();
    },
    saved: () => shell.onDisk(STORE_FILE) + shell.onDisk(BACKUP_FILE),
    read: (path) => shell.disk.get(path)?.toString("utf8"),
    write: (path, text) => {
      shell.disk.set(path, Buffer.from(text, "utf8"));
    },
    remove: (path) => {
      shell.disk.delete(path);
    },
    cutSave: (path, bytes) => shell.cutSave(path, bytes),
    cutShort: () => shell.cutShort,
    cancelled: shell.cancelled,
  };
}

export function end(): void {
  removeShell();
}

/** `"rejected"` when `p` rejects (with anything), `"resolved"` when it resolves. */
export const settled = (p: Promise<unknown>): Promise<"resolved" | "rejected"> =>
  p.then(
    () => "resolved" as const,
    () => "rejected" as const,
  );

/**
 * A store file's text with its one document (the value of the file's one key, a copy `{ gen, sum, data }`) changed by `change`.
 * Assumption: the file holds one key whose value is that object, as the spec's "each a whole copy `{ gen, sum, data }`" says.
 */
export function editCopy(
  text: string | undefined,
  change: (copy: Record<string, unknown>) => Record<string, unknown>,
): string {
  const file: unknown = JSON.parse(text ?? "null");
  if (typeof file !== "object" || file === null) throw new Error("the saved file is not a JSON object");
  const out: Record<string, unknown> = {};
  for (const [key, copy] of Object.entries(file)) {
    if (typeof copy !== "object" || copy === null) throw new Error("the saved copy is not an object");
    out[key] = change({ ...copy });
  }
  return JSON.stringify(out);
}

/** The copy with a `sum` that does not match its `gen` and `data`. */
export const wrongSum = (copy: Record<string, unknown>): Record<string, unknown> => ({
  ...copy,
  sum: typeof copy.sum === "number" ? copy.sum + 1 : `${String(copy.sum)}0`,
});

/** The copy with `data` still JSON text of the same keys but not what `sum` covers. */
export const wrongData = (copy: Record<string, unknown>): Record<string, unknown> => ({
  ...copy,
  data: `${String(copy.data)} `,
});
