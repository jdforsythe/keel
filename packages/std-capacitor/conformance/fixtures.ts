// Shared fixtures for the std.shells conformance files of `@keel/std-capacitor` (not a test file).
// Assumptions (the spec does not say):
// - Storage runs on Capacitor's own web `Preferences` over the jsdom-like `localStorage` (no stand-in); a "restart" is a fresh `capacitorDrivers` over the same `localStorage`.
// - `CapacitorHttp` from `@capacitor/core` is stood in for by `nativeHttp` (installed with `vi.mock` in each test file that uses the network), because
//   Capacitor's web `CapacitorHttp` calls the global `fetch`, which the last clause forbids. The driver may call `request` or the verb helpers; all reach one handler.
// - The native side owns the cookie jar (`native.jar`, by origin): it adds `cookie` to a request and keeps a `set-cookie` of a response, as the native HTTP client does.
// - A page at `<origin>` is a stubbed global `location` with `origin`, `protocol`, `host`, `hostname`, `href`; requests to the page use absolute URLs on it.
import type { HttpOptions, HttpResponse } from "@capacitor/core";
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
}
export type Backend = (req: Wire) => Reply;

export interface Native {
  readonly wire: Wire[];
  readonly jar: Map<string, Map<string, string>>;
  backend: Backend;
  refuse: boolean;
  reset(): void;
}

const ok: Backend = () => ({ status: 200, body: "ok" });

export const native: Native = {
  wire: [],
  jar: new Map(),
  backend: ok,
  refuse: false,
  reset() {
    this.wire.length = 0;
    this.jar.clear();
    this.backend = ok;
    this.refuse = false;
  },
};

const lower = (h: Readonly<Record<string, string>> | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h ?? {})) out[k.toLowerCase()] = v;
  return out;
};

const bodyOf = (o: HttpOptions): string | null => {
  const d: unknown = o.data;
  if (d === undefined || d === null) return null;
  if (typeof d === "string") return o.dataType === "file" ? Buffer.from(d, "base64").toString("utf8") : d;
  return JSON.stringify(d);
};

const urlOf = (o: HttpOptions): string => {
  const u = new URL(o.url);
  for (const [k, v] of Object.entries(o.params ?? {})) {
    for (const item of Array.isArray(v) ? v : [v]) u.searchParams.append(k, item);
  }
  return u.href;
};

const dataOf = (o: HttpOptions, reply: Reply): unknown => {
  const text = reply.body ?? "";
  const type = o.responseType;
  if (type === "arraybuffer" || type === "blob") return Buffer.from(text, "utf8").toString("base64");
  if (type === "text" || type === "document") return text;
  const ct = lower(reply.headers)["content-type"] ?? "";
  if (type === "json" || ct.includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
};

const request = async (o: HttpOptions): Promise<HttpResponse> => {
  const url = urlOf(o);
  const origin = new URL(url).origin;
  const headers = lower(o.headers);
  const jar = native.jar.get(origin);
  if (jar && jar.size > 0) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const wire: Wire = { url, method: (o.method ?? "GET").toUpperCase(), headers, body: bodyOf(o) };
  native.wire.push(wire);
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
  return { status: reply.status, headers: { ...(reply.headers ?? {}) }, url, data: dataOf(o, reply) };
};

const verb = (method: string) => (o: HttpOptions) => request({ ...o, method });

/** The stand-in for `CapacitorHttp`. */
export const nativeHttp = {
  request,
  get: verb("GET"),
  post: verb("POST"),
  put: verb("PUT"),
  patch: verb("PATCH"),
  delete: verb("DELETE"),
};

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
