import { appFrames } from "./appFrames.ts";
import { diagLine } from "./diagLine.ts";
import { scrubbedDiag } from "./scrubbedDiag.ts";
import { serving } from "./serving.ts";
import { unexpectedOf } from "./unexpectedOf.ts";

let installed = false;

/**
 * Installs, once per process, the `uncaughtException` and `unhandledRejection` listeners of a served process (k.leave
 * Process): each writes one E1577 `diag`, `uncaught <exception|rejection> in work of route <id>`, the route of the
 * request whose async context the failing work ran in (`serving`), else `-`, with the error's app `frames` read against
 * `artifacts`; with `dev` the thrown text follows, scrubbed of that request's values and cut (k.serverlog). Then it
 * calls `then`. The production entry (`start`) and the `keel dev` module call it; `createApp` never does.
 */
export function onUncaught(
  log: { readonly format: "compact" | "json"; readonly write: (line: string) => void },
  artifacts: string,
  dev: boolean,
  then: () => void,
): void {
  if (installed) return;
  installed = true;
  const frames = appFrames(artifacts, () => undefined);
  for (const kind of ["exception", "rejection"] as const)
    process.on(kind === "exception" ? "uncaughtException" : "unhandledRejection", (e: unknown) => {
      const rq = serving.getStore();
      const lead = `uncaught ${kind} in work of route ${rq?.route ?? "-"}`;
      const message = dev ? `${lead}: ${unexpectedOf(e).data.cause}` : lead;
      const d = { code: "E1577", lead, message, frames: frames(e) };
      log.write(diagLine(log.format, scrubbedDiag(d, rq ?? { pii: new Set(), secrets: new Set() })));
      then();
    });
}
