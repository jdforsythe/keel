// Fixtures for the k.topology and live-loader conformance files (not a test file). Seed for every property: 1337.
// RFC 0080 options (`peers`, `runners`, `origin`, `deployable`) and async-generator loaders are not in today's types, so
// they are passed through loose helpers; every call sits inside a test body.
// ASSUMPTION: `artifacts` is a directory holding `routes.json` as `{ data, hash }`, `data` being router's `routesArtifact(manifest)`.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { routesArtifact } from "@keel/router";
import type { Manifest, RouteDef } from "@keel/router";
import * as server from "@keel/server";

export const SEED = 1337;
export const BASE = "http://localhost";

export type Fetcher = { fetch(req: Request): Promise<Response>; close?: () => Promise<void> };

function isFetcher(v: unknown): v is Fetcher {
  return typeof v === "object" && v !== null && "fetch" in v && typeof v.fetch === "function";
}

/** `createApp` with options typed loosely (RFC 0080 options are not yet in `AppOptions`). */
export async function createAppLoose(o: Record<string, unknown>): Promise<Fetcher> {
  const f: unknown = Reflect.get(server, "createApp");
  if (typeof f !== "function") throw new Error("@keel/server does not export createApp");
  const app: unknown = await Reflect.apply(f, undefined, [o]);
  if (!isFetcher(app)) throw new Error("createApp did not return an app with fetch");
  return app;
}

/** Microtask turns for sim code to settle; no timers. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

/** Write `routes.json` for a manifest into a fresh directory and return it (ASSUMPTION above). */
export function writeArtifacts(m: Manifest<Readonly<Record<string, RouteDef>>>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-artifacts-"));
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data: routesArtifact(m), hash: "" }));
  return dir;
}

/** Header setter for happy-dom, whose Request drops forbidden headers (Origin). */
export function withHeaders(req: Request, extra: Record<string, string>): Request {
  const h = new Headers(req.headers);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  Object.defineProperty(req, "headers", { value: h });
  return req;
}

/** Read up to `n` text chunks of a streaming response body. */
export async function readChunks(res: Response, n: number): Promise<string[]> {
  const reader = res.body?.getReader();
  if (reader === undefined) throw new Error("response has no body");
  const dec = new TextDecoder();
  const out: string[] = [];
  while (out.length < n) {
    const r = await reader.read();
    if (r.done) break;
    out.push(dec.decode(r.value));
  }
  reader.releaseLock();
  return out;
}

import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";

const Page = s.object({ title: s.string() });

/** A manifest with one GET route `<module>.show` at `path` whose loader answers `{ title }`. */
export function pageManifest(module: string, routePath: string, title: string) {
  const l = loader({ output: Page }, () => Promise.resolve(ok({ title })));
  return manifest({
    [`${module}.show`]: { path: routePath, loader: l, component: () => document.createElement("main") },
  });
}

/** A sim ctx of the suite seed. */
export const simCtx = () => createCtx({ mode: "sim", seed: SEED });

/** A loader whose `fn` is an async generator (live, RFC 0080); typed loosely because `loader`'s `fn` returns a Promise today. */
export function liveLoader(
  output: Parameters<typeof loader>[0]["output"],
  fn: (...a: never[]) => AsyncGenerator<unknown>,
) {
  return Reflect.apply(loader, undefined, [{ output }, fn]);
}
