// Shared fixtures for the std.shells conformance files of `@keel/std-tauri` (not a test file).
// Assumptions (the spec does not say):
// - Tauri's `mockIPC` stands in for the native side: `plugin:store|*` and `plugin:http|*` commands are answered by `FakeShell`; both plugins run unmodified over it.
//   `mockIPC` hides the `invoke` options, which carry the plugin-http `client-config` header, so `installShell` wraps `invoke` to read it.
// - The store keeps an in-memory copy per loaded resource and a "disk" per file path; `save` copies memory to disk, and so does `set`/`delete`/`clear` when `load` is given `autoSave: 0`.
//   `restartApp()` drops every loaded resource (and with it the unsaved memory): the disk is what survives.
// - The native side owns the cookie jar (`jar`, by origin): it adds `cookie` to a request and keeps a `set-cookie` of a response, as the plugin's HTTP client does.
// - A page at `<origin>` is a stubbed global `location`; requests to the page use absolute URLs on it.
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { vi } from "vitest";

export const ORIGIN = new URL("https://golden-1.example");
export const OTHER = "https://other.example";
export const PAGES = ["tauri://localhost", "https://localhost"] as const;
export const STORE_FILE = "keel.json";

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
}
export type Backend = (req: Wire) => Reply;

interface Resource {
  readonly path: string;
  readonly data: Map<string, unknown>;
  readonly autoSave: boolean;
}
interface Pending {
  readonly wire: Wire;
}
interface Body {
  readonly bytes: number[];
  sent: boolean;
}

export interface FakeShell {
  /** Files the store has saved: path to key/value entries. */
  readonly disk: Map<string, Map<string, unknown>>;
  /** Paths `plugin:store|load` was asked for, in order. */
  readonly loads: string[];
  /** What reached the native HTTP client. */
  readonly wire: Wire[];
  readonly jar: Map<string, Map<string, string>>;
  backend: Backend;
  refuse: boolean;
  /** The saved file as text, for a substring check. */
  onDisk(path?: string): string;
  /** Drops loaded resources and unsaved memory; the disk stays. */
  restartApp(): void;
}

const ok: Backend = () => ({ status: 200, body: "ok" });

const field = (payload: unknown, key: string): unknown =>
  typeof payload === "object" && payload !== null && !ArrayBuffer.isView(payload)
    ? Reflect.get(payload, key)
    : undefined;
const text = (v: unknown): string => (typeof v === "string" ? v : "");
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
  const disk = new Map<string, Map<string, unknown>>();
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
    onDisk: (path = STORE_FILE) => JSON.stringify([...(disk.get(path) ?? [])]),
    restartApp: () => {
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
    disk.set(r.path, new Map(r.data));
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
        resources.set(rid, { path, data: new Map(disk.get(path) ?? []), autoSave: auto });
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
        r.data.clear();
        for (const [k, v] of disk.get(r.path) ?? []) r.data.set(k, v);
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
        pending.set(rid, {
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
        const origin = new URL(p.wire.url).origin;
        const headers = { ...p.wire.headers };
        const cookies = jar.get(origin);
        if (cookies && cookies.size > 0) headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
        const seen: Wire = { ...p.wire, headers };
        wire.push(seen);
        if (shell.refuse) throw `error sending request for url (${p.wire.url}): connection refused`;
        const reply = shell.backend(seen);
        const cookie = lowered(reply.headers)["set-cookie"];
        if (cookie !== undefined) {
          const pair = cookie.split(";")[0] ?? "";
          const at = pair.indexOf("=");
          const mine = jar.get(origin) ?? new Map<string, string>();
          mine.set(pair.slice(0, at), pair.slice(at + 1));
          jar.set(origin, mine);
        }
        const bodyRid = next++;
        bodies.set(bodyRid, { bytes: [...new TextEncoder().encode(reply.body ?? "")], sent: false });
        return {
          status: reply.status,
          statusText: "",
          url: p.wire.url,
          headers: Object.entries(reply.headers ?? {}),
          rid: bodyRid,
        };
      }
      case "fetch_read_body": {
        const b = bodies.get(num(field(payload, "rid")));
        if (b === undefined) throw new Error("body id invalid");
        if (b.sent) return [1];
        b.sent = true;
        return [...b.bytes, 0];
      }
      case "fetch_cancel":
      case "fetch_cancel_body":
        return null;
      default:
        throw new Error(`unknown command plugin:http|${cmd}`);
    }
  };

  mockIPC((cmd, payload) => {
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

/** The native side as the test files see it; the same shape in `@keel/std-capacitor`'s fixtures. */
export interface World {
  readonly wire: Wire[];
  readonly jar: Map<string, Map<string, string>>;
  backend(b: Backend): void;
  refuse(on: boolean): void;
  /** An app restart: loaded store resources and their unsaved memory are dropped; the saved file stays. */
  restart(): void;
  /** Empties the saved file and drops loaded resources between property runs. */
  wipe(): void;
  /** The saved `keel.json` as JSON text. */
  saved(): string;
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
      shell.restartApp();
    },
    saved: () => shell.onDisk(),
  };
}

export function end(): void {
  removeShell();
}
