import { createCtx } from "@keel/ctx";
import { compileRoutes } from "@keel/router/internal";
import { createApp } from "@keel/server";
import type { PrerenderOptions } from "../types/PrerenderOptions.ts";
import type { Prerendered } from "../types/Prerendered.ts";
import { moduleOf } from "./moduleOf.ts";

/** A path no route declares (a dot segment), so its answer is the not-found document. */
const NOT_FOUND = "/.keel-not-found";

/**
 * Render a `static` deployable at build (`@keel/server/internal/prerender`, k.hosting Static; only the generated build
 * entry calls it): one `createApp` in production with a real `ctx` (memory storage), the client build in `dir` as
 * its assets and `std` bound, then a cookieless document GET (caller `''`) of each page route's one path, in table order, and of a
 * path no route declares (`id` undefined), which is the not-found document. Each answer is returned with its status;
 * the app is closed before it returns.
 */
export async function prerender(o: PrerenderOptions): Promise<readonly Prerendered[]> {
  const app = await createApp({
    topology: o.topology,
    origins: o.origins ?? {},
    deployable: o.deployable,
    routes: o.routes,
    ctx: createCtx({ mode: "real" }),
    mode: "production",
    assets: o.dir,
    identity: o.identity,
    log: { format: "compact", write: () => undefined },
    ...(o.std === undefined ? {} : { std: o.std }),
  });
  const modules = o.topology[o.deployable]?.modules ?? [];
  const pages = compileRoutes(o.routes).located.filter(
    (r) => r.def.kind === "page" && modules.includes(moduleOf(r.id)),
  );
  const get = async (id: string | undefined, path: string): Promise<Prerendered> => {
    const res = await app.fetch(new Request(`http://keel.invalid${path}`, { headers: { accept: "text/html" } }));
    return { id, path, status: res.status, html: await res.text() };
  };
  try {
    const out: Prerendered[] = [];
    for (const r of pages) {
      const path = `/${r.segments.map((s) => (s.kind === "static" ? s.text : `:${s.name}`)).join("/")}`;
      out.push(await get(r.id, path));
    }
    out.push(await get(undefined, NOT_FOUND));
    return out;
  } finally {
    await app.close();
  }
}
