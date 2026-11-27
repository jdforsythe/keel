import { createHmac, randomBytes } from "node:crypto";
import { appFrames } from "./appFrames.ts";
import { diagLine } from "./diagLine.ts";
import { envValue } from "./envValue.ts";
import { scrubbedDiag } from "./scrubbedDiag.ts";
import { serving } from "./serving.ts";
import { thrownForm } from "./thrownForm.ts";
import { thrownText } from "./thrownText.ts";

let installed = false;
/** Where the process keeps the removal of the installed listeners, so a later copy of this module finds it. */
const REMOVE = Symbol.for("keel.server.onUncaught.remove");

/**
 * Installs, once per process, the `uncaughtException` and `unhandledRejection` listeners of a served process (k.leave
 * Process): each writes one E1577 `diag`, `uncaught <exception|rejection> in work of route <id>: ` then the thrown
 * value's form (`thrownForm`, k.serverlog Thrown values, fingerprinted under `KEEL_SECRET`, else a key drawn at install),
 * `<id>` the route of the request whose async context the failing work ran in (`serving`), else `-`, with the error's
 * app `frames` read against `artifacts`; with `dev` the thrown text (`thrownText`) follows in that record, scrubbed of
 * that request's values and cut (k.serverlog). Then it
 * calls `then`. The production entry (`start`) and the `keel dev` module call it; `createApp` never does.
 *
 * `keel dev` can evaluate the server graph again in one process (a dev server restart, a linked package's edit): that
 * copy of this module removes the listeners of the copy before it and installs its own, which read its own `serving`,
 * so an uncaught error still writes one record, with the route of its request.
 */
export function onUncaught(
  log: { readonly format: "compact" | "json"; readonly write: (line: string) => void },
  artifacts: string,
  dev: boolean,
  then: () => void,
): void {
  if (installed) return;
  installed = true;
  const earlier: unknown = Reflect.get(globalThis, REMOVE);
  if (typeof earlier === "function") earlier();
  const frames = appFrames(artifacts, () => undefined);
  const secret = envValue("KEEL_SECRET");
  const key = secret !== undefined && secret !== "" ? secret : randomBytes(32);
  const fingerprint = (input: string): string => createHmac("sha256", key).update(input).digest("hex").slice(0, 8);
  const listen = (kind: "exception" | "rejection") => (e: unknown) => {
    const rq = serving.getStore();
    const lead = `uncaught ${kind} in work of route ${rq?.route ?? "-"}: `;
    const at = frames(e);
    const { head, site, tail } = thrownForm(e, at, fingerprint);
    const form = head + site + tail;
    const d = { code: "E1577", lead, message: dev ? `${lead}${form} ${thrownText(e)}` : lead + form, frames: at };
    log.write(diagLine(log.format, scrubbedDiag(d, rq ?? { pii: new Set(), secrets: new Set() })));
    then();
  };
  const [exception, rejection] = [listen("exception"), listen("rejection")];
  process.on("uncaughtException", exception);
  process.on("unhandledRejection", rejection);
  Reflect.set(globalThis, REMOVE, (): void => {
    process.off("uncaughtException", exception);
    process.off("unhandledRejection", rejection);
  });
}
