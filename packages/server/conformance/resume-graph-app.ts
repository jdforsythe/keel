// Serving helpers for the k.resume store suites (not a test file). Public API only.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import type { ServedDocument } from "./resume-app.ts";

export type Routes = NonNullable<Parameters<typeof createApp>[0]["routes"]>;

export type Lines = { readonly lines: string[] };

export type AppOptions = {
  readonly mode?: "dev" | "production";
  readonly log?: Lines;
  readonly runners?: Parameters<typeof createApp>[0]["runners"];
};

/** An app serving `routes` from one node deployable holding `modules`. */
export function appOf(routes: Routes, modules: readonly string[], options: AppOptions = {}) {
  const log = options.log;
  return createApp({
    topology: topology({ web: { modules: [...modules], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: options.mode ?? "production",
    ...(log === undefined ? {} : { log: { format: "compact", write: (line: string) => void log.lines.push(line) } }),
    ...(options.runners === undefined ? {} : { runners: options.runners }),
  });
}

/** Serves one GET of `path` from `routes`. */
export async function serveRoutes(
  routes: Routes,
  modules: readonly string[],
  path: string,
  options: AppOptions = {},
): Promise<ServedDocument> {
  const app = await appOf(routes, modules, options);
  const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
  const text = await res.text();
  const body = new DOMParser().parseFromString(text, "text/html").body.innerHTML;
  return { status: res.status, text, body };
}
