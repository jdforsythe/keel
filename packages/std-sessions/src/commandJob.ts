import { writeFileSync } from "node:fs";
import { routeTable } from "@keel/router";
import { matchHref } from "@keel/router/match";
import type { CommandJobInput } from "./CommandJobInput.ts";
import { Session } from "./Session.schema.ts";
import { JobResult } from "./internal/JobResult.ts";
import { jsonOf } from "./internal/jsonOf.ts";
import { objectOf } from "./internal/objectOf.ts";
import { pageOf } from "./internal/pageOf.ts";
import { replayRun } from "./internal/replayRun.ts";
import { minimize } from "./minimize.ts";
import { redactSession } from "./redactSession.ts";

/**
 * Run one `keel session replay|minimize|to-test` job inside the project's `keel test` run (std.sessions D1: app code
 * runs only where `keel test` runs it) and write a `JobResult` as JSON to `job.result`. `@keel/std-sessions/tools`
 * writes the calling test file under `.keel/sessions/`, runs it with `keel test`, reads the result and removes both.
 * `replay` replays; `minimize` runs `minimize`; `to-test` replays, rewrites the session with `redactSession` (D3,
 * `expose`), replays that, and returns it with each `nav`'s route match. A session that does not reproduce returns
 * `reproduced: false` and no session.
 */
export async function commandJob(job: CommandJobInput): Promise<void> {
  const write = (r: JobResult): void => writeFileSync(job.result, JSON.stringify(JobResult.encode(r)));
  const parsed = Session.parse(job.session);
  if (!parsed.ok) throw new Error("keel session job: the session does not parse");
  const session = parsed.value;
  const routes = routeTable(...job.routes);
  const none = { session: null, navs: [], runs: 0, minimal: false };
  const redact = job.redact ?? [];
  const opts = {
    routes,
    redact,
    ...(job.serve === undefined ? {} : { serve: job.serve }),
    ...(job.user === undefined ? {} : { user: job.user }),
    ...(job.mount === undefined ? {} : { mount: job.mount }),
  };
  const first = await replayRun(session, opts);
  const seen = {
    reproduced: first.result.reproduced,
    fingerprint: first.recorded.fingerprint,
    error: first.result.error?.code ?? null,
    unapplied: first.result.unapplied,
    redirectedTo: first.redirectedTo,
  };
  if (job.op === "replay" || !seen.reproduced) return write({ ...seen, ...none, runs: 1 });
  if (job.op === "minimize") {
    const m = await minimize(session, {
      ...opts,
      ...(job.maxRuns === undefined ? {} : { maxRuns: job.maxRuns }),
    });
    if (!m.ok) return write({ ...seen, ...none, reproduced: false, fingerprint: m.error.data.fingerprint });
    return write({ ...seen, session: m.value.session, navs: [], runs: m.value.runs, minimal: m.value.minimal });
  }
  const redacted = redactSession(session, { routes, expose: job.expose ?? [] });
  const again = await replayRun(redacted, opts);
  const out = { ...seen, fingerprint: again.recorded.fingerprint, runs: 2, minimal: false };
  if (!again.result.reproduced) return write({ ...out, ...none, runs: 2, reproduced: false });
  const navs: JobResult["navs"] = [];
  for (const [index, e] of redacted.events.entries()) {
    if (e.kind !== "nav") continue;
    const m = matchHref(routes, e.href);
    const def = m === null ? undefined : pageOf(routes, m.id);
    if (m === null || def === undefined) continue;
    const params = objectOf(jsonOf(m.params, def.params));
    navs.push({ index, id: m.id, params, search: objectOf(jsonOf(m.search, def.search)) });
  }
  return write({ ...out, session: redacted, navs });
}
