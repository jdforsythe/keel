import type { OutRecord } from "@keel/cli";
import { SessionRecord } from "./SessionRecord.ts";
import type { ActionIo } from "./internal/ActionIo.ts";
import type { OutputFlags } from "./internal/OutputFlags.ts";
import { actionFlags } from "./internal/actionFlags.ts";
import { actionText } from "./internal/actionText.ts";
import { clean } from "./internal/clean.ts";
import { issueApi } from "./internal/issueApi.ts";
import { issueBody } from "./internal/issueBody.ts";
import { issueFor } from "./internal/issueFor.ts";
import { recordsOf } from "./internal/recordsOf.ts";
import { sessionCompact } from "./internal/sessionCompact.ts";
import { sessionDiag } from "./internal/sessionDiag.ts";
import { sessionMarker } from "./internal/sessionMarker.ts";

const WINDOW_MS = 26 * 60 * 60 * 1000;
const LABEL = "keel-session";
const REPO = /^[\w.-]+\/[\w.-]+$/;
/** A file the ingest writes: `.keel/sessions/<fingerprint>-<n>.json`. Anything else is never passed to `keel`. */
const FILE = /^\.keel\/sessions\/([0-9a-f]{12})-\d{1,9}\.json$/;
/** The grammar a route id and an error code must match before either reaches a log line or an issue title. */
const ID = /^[A-Za-z0-9_.-]{1,128}$/;
const CODE = /^[EWIS]\d{4}$/;
const MARKER = "<!-- keel-session: not reproduced -->";
const NOT_REPRODUCED = `${MARKER}\nThe nightly replay of this fingerprint's sessions did not reproduce it.\n\n`;
const MAX_ISSUES_PER_RUN = 20;

type Ran = { readonly ok: boolean; readonly records: OutRecord[] };
type Got = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly why: string };

const sessionsOf = (records: readonly OutRecord[]): SessionRecord[] =>
  records.flatMap((r) => {
    const p = r.kind === "session" ? SessionRecord.parse(r) : undefined;
    return p?.ok === true ? [p.value] : [];
  });
/** The child's diagnostics whose code is a Keel code; anything else on its stdout is dropped. */
const diagsOf = (ran: Ran): OutRecord[] =>
  ran.records.filter((r) => r.kind === "diag" && typeof r.code === "string" && CODE.test(r.code));
/** Whether a failed step failed only by E2004 (fingerprint differs), an outcome rather than a broken run. */
const onlyE2004 = (ran: Ran): boolean => {
  const ds = diagsOf(ran);
  return ds.length > 0 && ds.every((d) => d.code === "E2004");
};

/**
 * The std.sessions Action (`keel-session-action`, `packages/std-sessions/action/action.yml`). It runs
 * `keel session ingest $KEEL_SESSIONS_URL --failing --since=<now - 26h>`, then replays each fingerprint's files newest
 * first until one reproduces. For a reproduced fingerprint it runs `minimize` and `to-test`, then updates the open
 * `keel-session` issue whose body carries `<!-- keel-session:<fingerprint> -->` (or, filed without it, whose title
 * starts `session <fingerprint>:`), or creates one titled `session <fingerprint>: <code> at <route>` with that marker
 * as the first body line (at most 20 creates a run; the rest count as `deferred`). The lookup lists the label's open issues
 * (at most 50 pages of 100, else E1056) and its closed issues newest first (at most 5 pages of 100; an older closed
 * issue is treated as absent). A fingerprint with no open match and a match closed as not planned
 * is skipped (counted `skipped`); one whose matches are all closed as completed gets a new issue. The body is the
 * compact `session` record and the emitted test, fenced. When no file reproduces (each E2004), the open issue gets
 * one comment carrying a marker line, unless its newest comment already carries it. A route id or code outside
 * `[A-Za-z0-9_.-]` skips the fingerprint with E2002. `keel` children never get `GITHUB_TOKEN`; only the ingest gets
 * `KEEL_SESSIONS_TOKEN`. Exit 1 when the ingest, a GitHub call (E1056) or a step fails with anything but E2004.
 */
export async function runAction(
  io: ActionIo,
): Promise<{ readonly code: number; readonly records: OutRecord[]; readonly stdout: string }> {
  const records: OutRecord[] = [];
  const counts: Record<string, number> = { fingerprints: 0, created: 0, updated: 0, commented: 0 };
  const flags = actionFlags(io.args, io.env, io.tty);
  const shown: OutputFlags = flags.ok ? flags.value : { mode: "compact", quiet: false, limit: undefined };
  const finish = (ok: boolean) => {
    records.push({ kind: "summary", ok, name: "session action", counts });
    return { code: ok ? 0 : 1, records, stdout: actionText(records, shown) };
  };
  if (!flags.ok) {
    records.push(sessionDiag("E1052", `session action: ${flags.why}`));
    return finish(false);
  }
  const env = io.env;
  const url = env.KEEL_SESSIONS_URL ?? "";
  const repo = env.GITHUB_REPOSITORY ?? "";
  const token = env.GITHUB_TOKEN ?? "";
  const api = (env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/+$/, "");
  if (url === "" || !REPO.test(repo) || token === "") {
    records.push(sessionDiag("E1052", "session action needs KEEL_SESSIONS_URL, GITHUB_REPOSITORY and GITHUB_TOKEN"));
    return finish(false);
  }
  const keel = async (args: readonly string[]): Promise<Ran> => {
    const child: Record<string, string> = {};
    for (const [k, v] of Object.entries(env))
      if (k !== "GITHUB_TOKEN" && (k !== "KEEL_SESSIONS_TOKEN" || args[0] === "ingest")) child[k] = v;
    const r = await io.run(["session", ...args, "--format=json"], child);
    const out = recordsOf(r.stdout);
    const summary = out.filter((x) => x.kind === "summary").at(-1);
    return { ok: r.code === 0 && summary?.ok === true, records: out };
  };

  const ingest = await keel(["ingest", url, "--failing", `--since=${io.now() - WINDOW_MS}`]);
  if (!ingest.ok) {
    records.push(...diagsOf(ingest));
    return finish(false);
  }
  const files = new Map<string, string[]>();
  for (const r of sessionsOf(ingest.records)) {
    const fp = FILE.exec(r.file ?? "")?.[1];
    if (fp !== undefined && r.file !== null && fp === r.fingerprint) files.set(fp, [...(files.get(fp) ?? []), r.file]);
  }
  if (files.size === 0) return finish(true);

  const gh = issueApi(io, api, repo, token);
  const open = await gh.find(LABEL);
  if (!open.ok) {
    records.push(sessionDiag("E1056", open.why));
    return finish(false);
  }
  let failed = false;
  const report = (r: Got, did: "created" | "updated" | "commented", fp: string, rec: SessionRecord, n?: number) => {
    if (!r.ok) {
      failed = true;
      records.push(sessionDiag("E1056", r.why));
      return;
    }
    counts[did] = (counts[did] ?? 0) + 1;
    records.push(rec, { kind: "session.issue", fingerprint: fp, action: did, issue: n ?? r.value });
  };
  const broken = (ran: Ran): void => {
    records.push(...diagsOf(ran));
    if (!onlyE2004(ran)) failed = true;
  };
  /** A record safe to print and to title an issue with: this fingerprint, an id-grammar route and code. */
  const safe = (r: SessionRecord | undefined, fp: string, file: string): r is SessionRecord => {
    if (r === undefined) return false;
    if (r.fingerprint === fp && ID.test(r.route) && (r.error === null || ID.test(r.error))) return true;
    records.push(sessionDiag("E2002", "session route or error code is not an id; skipped", clean(file)));
    return false;
  };

  for (const [fp, list] of [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    counts.fingerprints = (counts.fingerprints ?? 0) + 1;
    const found = issueFor(open.value, fp);
    if (found.kind === "skip") {
      counts.skipped = (counts.skipped ?? 0) + 1;
      continue;
    }
    const issue = found.kind === "open" ? found.issue : undefined;
    const newest = list.at(-1) ?? "";
    let newestSeen: SessionRecord | undefined;
    let reproduced: string | undefined;
    let stop = false;
    for (const file of [...list].reverse()) {
      const replay = await keel(["replay", file]);
      newestSeen ??= sessionsOf(replay.records)[0];
      if (replay.ok) reproduced = file;
      else if (!onlyE2004(replay)) {
        broken(replay);
        stop = true;
      }
      if (reproduced !== undefined || stop) break;
    }
    if (stop) continue;
    if (reproduced === undefined) {
      if (issue === undefined || !safe(newestSeen, fp, newest)) continue;
      const last = await gh.lastComment(issue.number);
      if (!last.ok) {
        failed = true;
        records.push(sessionDiag("E1056", last.why));
        continue;
      }
      if (last.value?.includes(MARKER) === true) continue;
      const body = `${NOT_REPRODUCED}${issueBody(sessionCompact(newestSeen))}`;
      report(await gh.comment(issue.number, body), "commented", fp, newestSeen, issue.number);
      continue;
    }
    if (issue === undefined && (counts.created ?? 0) >= MAX_ISSUES_PER_RUN) {
      counts.deferred = (counts.deferred ?? 0) + 1;
      continue;
    }
    const minimized = await keel(["minimize", reproduced]);
    const emitted = minimized.ok ? await keel(["to-test", reproduced]) : minimized;
    if (!emitted.ok) {
      broken(emitted);
      continue;
    }
    const [out] = sessionsOf(emitted.records);
    if (!safe(out, fp, reproduced)) continue;
    const test =
      out.file === `modules/${out.route.split(".")[0]}/test/session-${fp}.test.ts` || out.file === `test/session-${fp}.test.ts`
        ? io.read(out.file)
        : undefined;
    if (test === undefined) continue;
    const title = clean(`session ${fp}: ${out.error ?? "ok"} at ${out.route}`, 256);
    const body = `${sessionMarker(fp)}\n${issueBody(sessionCompact(out), test)}`;
    if (issue === undefined) report(await gh.create(LABEL, title, body), "created", fp, out);
    else report(await gh.update(issue.number, title, body), "updated", fp, out, issue.number);
  }
  return finish(!failed);
}
