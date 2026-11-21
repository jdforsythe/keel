// Serving helpers for the k.claim packaged-component suite (not a test file). Public API only.
// Each page is TSX compiled at run time; `createApp` serves it and `resumeDocument` resumes it in a module graph of its own.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import type { RouteProps } from "@keel/router";
import { createApp, topology } from "@keel/server";

export const SEED = 1337;

export type Page = (props: RouteProps, ctx: Ctx) => Node;

/** Compiles `source` as the default export of `<name>.tsx` and returns it as a route component; `modules` are the packages it imports beyond the kernel's. */
export function compilePage(name: string, source: string, modules: Record<string, unknown> = {}): Page {
  const r = compile([{ path: `${name}.tsx`, source }]);
  if (r.diagnostics.length > 0) throw new Error(`fixture: ${name} does not compile: ${JSON.stringify(r.diagnostics)}`);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code, modules);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props, ctx) => {
    const node: unknown = fn(props, ctx);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

export type Served = { readonly status: number; readonly text: string; readonly lines: readonly string[] };

/** Serves `path` of `routes` (one node deployable holding `modules`) over `requests` GETs; the log is every line written. */
export async function serve(
  routes: NonNullable<Parameters<typeof createApp>[0]["routes"]>,
  modules: readonly string[],
  path: string,
  options: { readonly mode?: "dev" | "production"; readonly requests?: number } = {},
): Promise<Served> {
  const lines: string[] = [];
  const app = await createApp({
    topology: topology({ web: { modules: [...modules], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: options.mode ?? "production",
    log: { format: "compact", write: (line: string) => void lines.push(line) },
  });
  let last = { status: 0, text: "" };
  for (let i = 0; i < (options.requests ?? 1); i++) {
    const res = await app.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }));
    last = { status: res.status, text: await res.text() };
  }
  return { ...last, lines };
}

/** The log lines naming E1257. */
export const e1257 = (served: Served): string[] => served.lines.filter((l) => l.includes("E1257"));
