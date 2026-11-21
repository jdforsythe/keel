import { matchUrl } from "@keel/router/internal";
import type { LogSink } from "../types/LogSink.ts";
import { CSP_MAX_BODY } from "./CSP_MAX_BODY.ts";
import type { Handled } from "./Handled.ts";
import type { Served } from "./Served.ts";
import { blockedOf } from "./blockedOf.ts";
import { cspLine } from "./cspLine.ts";
import { cspReports } from "./cspReports.ts";
import { payloadTooLarge } from "./payloadTooLarge.ts";
import { readCapped } from "./readCapped.ts";

const WINDOW_MS = 60_000;
const WINDOW_CAP = 100;
const SOURCE_CAP = 10;

const routeOf = (sv: Served, document: string): string => {
  try {
    return matchUrl(sv.table, new URL(document).pathname).route?.id ?? "-";
  } catch {
    return "-";
  }
};

/**
 * `POST /__keel/csp` (k.security Reports): no write proof, since it changes no state. Another method is 405; a body
 * over 16 KiB is 413 and logs nothing; a type other than `application/csp-report` or `application/reports+json` is 415.
 * Else 204, and each violation is one `csp` record `{ directive, blocked, route }` (`blockedOf`; `route` the id the
 * document URL's path matches, else `-`), never its path, query or sample. The first report opens a 60 s window of
 * `ctx.clock`; past 100 logged in it, or past 10 from one `source` (`reportSource`; none: the 100 only), the rest are
 * counted, and its end writes `{ dropped }` when any were. The source is never logged.
 */
export async function cspReport(
  raw: Request,
  sv: Served,
  log: LogSink | undefined,
  source: string | undefined,
): Promise<Handled> {
  const done = (response: Response): Handled => ({ response, route: undefined, diags: [] });
  if (raw.method.toUpperCase() !== "POST") return done(new Response(null, { status: 405, headers: { allow: "POST" } }));
  const type = (raw.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const bytes = await readCapped(raw, CSP_MAX_BODY);
  if (bytes === null) return done(payloadTooLarge(CSP_MAX_BODY));
  if (type !== "application/csp-report" && type !== "application/reports+json")
    return done(new Response(null, { status: 415 }));
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    body = null;
  }
  const w = sv.reports;
  for (const r of cspReports(body, type === "application/reports+json")) {
    if (!w.open) {
      Object.assign(w, { open: true, logged: 0, dropped: 0 });
      w.sources.clear();
      sv.ctx.clock.after(WINDOW_MS, sv.lifecycle.signal).then(
        () => {
          if (w.dropped > 0) log?.write(cspLine(log.format, { dropped: w.dropped }));
          w.open = false;
          w.sources.clear();
        },
        () => undefined,
      );
    }
    const from = source === undefined ? 0 : (w.sources.get(source) ?? 0);
    if (w.logged >= WINDOW_CAP || from >= SOURCE_CAP) {
      w.dropped++;
      continue;
    }
    w.logged++;
    if (source !== undefined) w.sources.set(source, from + 1);
    const line = { directive: r.directive, blocked: blockedOf(r.blocked), route: routeOf(sv, r.document) };
    log?.write(cspLine(log.format, line));
  }
  return done(new Response(null, { status: 204 }));
}
