import type { OutRecord } from "@keel/cli";
import { SessionRecord } from "./SessionRecord.ts";
import type { ActionIo } from "./internal/ActionIo.ts";
import { actionText } from "./internal/actionText.ts";
import { issueApi } from "./internal/issueApi.ts";
import { issueBody } from "./internal/issueBody.ts";
import { recordsOf } from "./internal/recordsOf.ts";
import { sessionCompact } from "./internal/sessionCompact.ts";
import { sessionDiag } from "./internal/sessionDiag.ts";

const WINDOW_MS = 26 * 60 * 60 * 1000;
const LABEL = "keel-session";
const REPO = /^[\w.-]+\/[\w.-]+$/;
const NOT_REPRODUCED = "The nightly replay of this fingerprint's newest session did not reproduce it.\n\n";

type Ran = { readonly ok: boolean; readonly records: OutRecord[] };
type Action = "created" | "updated" | "commented" | "none";
type Got = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly why: string };

const sessionsOf = (records: readonly OutRecord[]): SessionRecord[] =>
  records.flatMap((r) => {
    const p = r.kind === "session" ? SessionRecord.parse(r) : undefined;
    return p?.ok === true ? [p.value] : [];
  });
const diagsOf = (records: readonly OutRecord[]): OutRecord[] => records.filter((r) => r.kind === "diag");

/**
 * The std.sessions Action (`keel-session-action`, `packages/std-sessions/action/action.yml`). It runs
 * `keel session ingest $KEEL_SESSIONS_URL --failing --since=<now - 26h>`, then, per fingerprint, `replay` on its newest
 * file (the last the ingest wrote). A reproduced fingerprint gets `minimize` and `to-test`, then one open issue
 * labeled `keel-session` titled `session <fingerprint>: <code> at <route>` is created or updated (lookup: the title
 * prefix `session <fingerprint>:`); its body is the compact `session` record and the emitted test, fenced. A fingerprint
 * that does not reproduce (E2004) gets one comment on its open issue, if there is one. `GITHUB_TOKEN` never reaches
 * `keel`, and `KEEL_SESSIONS_TOKEN` reaches only the ingest. Records: relayed `diag`s, `session` and `session.issue`
 * per fingerprint, one `summary`; exit 1 when the ingest or a GitHub call fails, else 0.
 */
export async function runAction(
  io: ActionIo,
): Promise<{ readonly code: number; readonly records: OutRecord[]; readonly stdout: string }> {
  const records: OutRecord[] = [];
  const counts = { fingerprints: 0, created: 0, updated: 0, commented: 0 };
  const finish = (ok: boolean) => {
    records.push({ kind: "summary", ok, name: "session action", counts });
    return { code: ok ? 0 : 1, records, stdout: actionText(records) };
  };
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
    records.push(...diagsOf(ingest.records));
    return finish(false);
  }
  const newest = new Map<string, string>();
  for (const r of sessionsOf(ingest.records)) if (r.file !== null) newest.set(r.fingerprint, r.file);
  if (newest.size === 0) return finish(true);

  const gh = issueApi(io, api, repo, token);
  const open = await gh.open(LABEL);
  if (!open.ok) {
    records.push(sessionDiag("E1056", open.why));
    return finish(false);
  }
  let failed = false;
  for (const [fp, file] of [...newest].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    counts.fingerprints++;
    const issue = open.value.find((i) => i.title.startsWith(`session ${fp}:`));
    const replay = await keel(["replay", file]);
    const [seen] = sessionsOf(replay.records);
    if (seen !== undefined) records.push(seen);
    let result: { readonly action: Action; readonly issue: number | null } = { action: "none", issue: null };
    const filed = (r: Got, did: Exclude<Action, "none">, n?: number) => {
      if (r.ok) {
        counts[did]++;
        return { action: did, issue: n ?? r.value };
      }
      failed = true;
      records.push(sessionDiag("E1056", r.why));
      return result;
    };
    if (replay.ok) {
      const minimized = await keel(["minimize", file]);
      const emitted = minimized.ok ? await keel(["to-test", file]) : minimized;
      const [out] = sessionsOf(emitted.records);
      const test = emitted.ok && out !== undefined && out.file !== null ? io.read(out.file) : undefined;
      if (out === undefined || test === undefined) records.push(...diagsOf(emitted.records));
      else {
        const title = `session ${fp}: ${out.error ?? "ok"} at ${out.route}`;
        const body = issueBody(sessionCompact(out), test);
        if (issue === undefined) result = filed(await gh.create(LABEL, title, body), "created");
        else result = filed(await gh.update(issue.number, title, body), "updated", issue.number);
      }
    } else if (diagsOf(replay.records).some((d) => d.code === "E2004")) {
      if (issue !== undefined && seen !== undefined)
        result = filed(
          await gh.comment(issue.number, `${NOT_REPRODUCED}${issueBody(sessionCompact(seen))}`),
          "commented",
          issue.number,
        );
    } else records.push(...diagsOf(replay.records));
    records.push({ kind: "session.issue", fingerprint: fp, ...result });
  }
  return finish(!failed);
}
