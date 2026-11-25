// Support for the k.privacy scrub files (not a test file): an app whose one action reveals a secret and throws a message,
// the readers of its log, and the encoders the spec names. Seed for every property: 1337.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { reveal, s } from "@keel/schema";
import { topology } from "@keel/server";
import { SEED, createApp } from "./fixtures.ts";
import { made } from "./privacy-secret-reach-helper.ts";

export type Mode = "dev" | "production";
export const modes: readonly Mode[] = ["dev", "production"];

const view = (): Node => document.createElement("main");
const appContract = contract("app", { "app.a": { path: "/a" } });

export interface Logged {
  readonly messages: string[];
  readonly frames: string[];
  readonly path: string | undefined;
}
const parse = (line: string): ReadonlyMap<string, unknown> => {
  const v: unknown = JSON.parse(line);
  return new Map(typeof v === "object" && v !== null ? Object.entries(v) : []);
};
/** The `diag` messages and frames and the `req` path of json log lines. */
export function readLog(lines: readonly string[]): Logged {
  const messages: string[] = [];
  const frames: string[] = [];
  let path: string | undefined;
  for (const line of lines) {
    const rec = parse(line);
    const kind = rec.get("kind");
    const message = rec.get("message");
    if (kind === "diag" && typeof message === "string") messages.push(message);
    const f = rec.get("frames");
    if (kind === "diag" && Array.isArray(f)) for (const x of f) if (typeof x === "string") frames.push(x);
    const p = rec.get("path");
    if (kind === "req" && typeof p === "string") path = p;
  }
  return { messages, frames, path };
}

/** An app of one action that parses `current.secret` as an `s.secret`, reveals it and throws `current.message`. */
export async function thrower(mode: Mode) {
  const current = { secret: "", message: "" };
  const lines: string[] = [];
  const act = action(appContract, "app.a", { input: s.object({}) }, async () => {
    await Promise.resolve();
    const key = made(s.secret(s.string()).parse(current.secret));
    void reveal(key);
    throw new Error(current.message);
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest(appContract, { "app.a": { component: view, POST: act } }),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    log: { format: "json", write: (l: string) => void lines.push(l) },
  });
  return {
    async run(secret: string, message: string): Promise<Logged> {
      current.secret = secret;
      current.message = message;
      lines.length = 0;
      const body = new FormData();
      const res = await app.fetch(
        new Request("http://localhost/a", { method: "POST", body, headers: { accept: "application/json" } }),
      );
      await res.text();
      return readLog(lines);
    },
  };
}

/** The thrown text of a `diag` message: what follows the server's own prefix. */
export function afterPrefix(message: string): string {
  const m = /^action app\.a threw: (?:Error: )?/.exec(message);
  if (m === null) throw new Error(`not an action diag message: ${message}`);
  return message.slice(m[0].length);
}

/** The message, after the server's prefix, is a head of `p`, one `[secret]`, then a tail of `q`. Returns the mark count. */
export function holdsHeadMarkTail(message: string, p: string, q: string): boolean {
  const rest = afterPrefix(message);
  const i = rest.indexOf("[secret]");
  if (i < 0 || rest.indexOf("[secret]", i + 1) >= 0) return false;
  return p.startsWith(rest.slice(0, i)) && q.endsWith(rest.slice(i + "[secret]".length));
}

// ---- encoders of the spec's list ----
export const utf8 = (v: string): Uint8Array => new TextEncoder().encode(v);
export const b64Of = (bytes: Uint8Array): string => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
export const hexOf = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const unpad = (x: string): string => x.replace(/=+$/, "");
const url64 = (x: string): string => x.replaceAll("+", "-").replaceAll("/", "_");
const hex4 = (c: string): string => c.charCodeAt(0).toString(16).padStart(4, "0");
const jsonInner = (v: string): string => JSON.stringify(v).slice(1, -1);

export const jsonAsIs = jsonInner;
export const jsonU = (v: string): string => jsonInner(v).replace(/[\u0080-￿]/g, (c) => `\\u${hex4(c)}`);
export const jsonSlash = (v: string): string => jsonInner(v).replaceAll("/", "\\/");
export const jsonSafe = (v: string): string => jsonInner(v).replace(/[<>&']/g, (c) => `\\u${hex4(c)}`);
export const htmlNamed = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
export const htmlDecimal = (v: string): string => Array.from(v, (c) => `&#${String(c.codePointAt(0))};`).join("");
export const htmlHex = (v: string): string =>
  Array.from(v, (c) => `&#x${(c.codePointAt(0) ?? 0).toString(16)};`).join("");
export const qs = (v: string): string =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export const formEncoded = (v: string): string => new URLSearchParams({ k: v }).toString().slice(2);

/** Each encoding E of the k.privacy conformance bullet. */
export const ENCODINGS: ReadonlyArray<readonly [string, (v: string) => string]> = [
  ["the value", (v) => v],
  ["its NFC", (v) => v.normalize("NFC")],
  ["its NFD", (v) => v.normalize("NFD")],
  ["encodeURIComponent once", (v) => encodeURIComponent(v)],
  ["encodeURIComponent twice", (v) => encodeURIComponent(encodeURIComponent(v))],
  ["encodeURI", (v) => encodeURI(v)],
  ["form-encoded", formEncoded],
  ["encodeURIComponent with !'()* escaped", qs],
  ["JSON as is", jsonAsIs],
  ["JSON with \\u", jsonU],
  ["JSON with \\/", jsonSlash],
  ["HTML-safe JSON", jsonSafe],
  ["JSON twice", (v) => jsonInner(jsonInner(v))],
  ["HTML named entities", htmlNamed],
  ["HTML decimal entities", htmlDecimal],
  ["HTML hex entities", htmlHex],
  ["encodeURIComponent of its JSON.stringify", (v) => encodeURIComponent(JSON.stringify(v))],
  ["hex lower case", (v) => hexOf(utf8(v))],
  ["hex upper case", (v) => hexOf(utf8(v)).toUpperCase()],
  ["base64 padded", (v) => b64Of(utf8(v))],
  ["base64 unpadded", (v) => unpad(b64Of(utf8(v)))],
  ["base64url padded", (v) => url64(b64Of(utf8(v)))],
  ["base64url unpadded", (v) => unpad(url64(b64Of(utf8(v))))],
];

/** Escapings that write one text the views read, for the pairs. */
export const ESCAPERS: ReadonlyArray<readonly [string, (v: string) => string]> = [
  ["encodeURIComponent", (v) => encodeURIComponent(v)],
  ["encodeURI", (v) => encodeURI(v)],
  ["qs", qs],
  ["form", formEncoded],
  ["JSON", jsonAsIs],
  ["JSON with \\u", jsonU],
  ["JSON with \\/", jsonSlash],
  ["HTML-safe JSON", jsonSafe],
  ["HTML named", htmlNamed],
  ["HTML decimal", htmlDecimal],
  ["HTML hex", htmlHex],
];
