import type { Io, OutRecord, Outcome } from "@keel/cli";
import { INSPECT_PATH } from "@keel/compiler/inspect/INSPECT_PATH";
import { s } from "@keel/schema";
import { Session } from "../Session.schema.ts";
import { fileOf } from "./fileOf.ts";
import { safeUrl } from "./safeUrl.ts";
import { sessionDiag } from "./sessionDiag.ts";
import { sessionOut } from "./sessionOut.ts";
import { sessionText } from "./sessionText.ts";

const DEFAULT_URL = "http://localhost:5173";
const clip = (url: string): string => (url.length > 48 ? `${url.slice(0, 45)}...` : url);
/** The parts of an inspect document `capture` reads (open objects: the rest is ignored). */
const Inspect = s.object({ sections: s.record(s.object({ value: s.json().optional() })) });
/** A runtime response of `sessions.list`: `results["sessions.list"]` is `ok(Listing)` (open objects). */
const Listed = s.object({
  results: s.object({
    "sessions.list": s.object({ ok: s.literal(true), value: s.record(s.object({ sessions: s.array(s.json()) })) }),
  }),
});

/** Fetch `url` as JSON through `io.fetch`; E1056 (unreachable, non-2xx, not JSON) as a reason string. */
async function getJson(io: Io & { fetch: NonNullable<Io["fetch"]> }, url: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await io.fetch(url, init);
  } catch {
    return { ok: false as const, why: "target unreachable" };
  }
  if (!res.ok) return { ok: false as const, why: `target answered ${res.status}` };
  try {
    const body: unknown = await res.json();
    return { ok: true as const, body };
  } catch {
    return { ok: false as const, why: "not JSON" };
  }
}

/**
 * `keel session capture [url]` and `keel session ingest <url> [--failing] [--since t]` (std.sessions Commands).
 * `capture` fetches `<url>/__keel/inspect` (default `http://localhost:5173`) and writes section
 * `sessions.live`'s value to `.keel/sessions/<fingerprint>-<index>.json`; a `null` value (no recorder) writes nothing.
 * `ingest` sends `GET <url>/sessions/list?failing=1&since=<t>` (`accept: application/json`; with
 * `KEEL_SESSIONS_TOKEN` in `io.env`, the caller cookie `__Host-keel-caller` on https, else `keel-caller`) and writes
 * each archived session the same way. Unreachable, non-2xx, or a body without the section or the `sessions.list`
 * result (a reader the guard redirects) is E1056; without `io.fetch`, I1055.
 */
export async function commandFetch(
  op: "capture" | "ingest",
  input: {
    readonly target?: string | undefined;
    readonly failing?: boolean | undefined;
    readonly since?: string | undefined;
  },
  io: Io,
): Promise<Outcome> {
  const done = (records: OutRecord[], writes: Outcome["writes"] = []): Outcome => {
    const ok = !records.some((r) => r.kind === "diag" && String(r.code).startsWith("E"));
    return {
      records: [...records, { kind: "summary", ok, name: `session ${op}`, counts: { sessions: writes.length } }],
      writes,
    };
  };
  const fetch = io.fetch;
  if (fetch === undefined) return done([sessionDiag("I1055", `session ${op} needs a network (io.fetch)`)]);
  const net = { ...io, fetch };
  const base = (input.target ?? (op === "capture" ? DEFAULT_URL : "")).replace(/\/+$/, "");
  if (base === "") return done([sessionDiag("E1052", "session ingest needs the ingest service url")]);
  const fail = (why: string): Outcome => done([sessionDiag("E1056", `session ${op} ${why}: ${clip(base)}`)]);
  const write = (list: readonly Session[]): Outcome =>
    done(
      list.map((x, i) => sessionOut(x, x.error?.code ?? null, fileOf(x, i))),
      list.map((x, i) => ({ path: fileOf(x, i), content: sessionText(x), readonly: false })),
    );
  if (op === "capture") {
    const got = await getJson(net, `${base}${INSPECT_PATH}`);
    if (!got.ok) return fail(got.why);
    const doc = Inspect.parse(got.body);
    const section = doc.ok ? doc.value.sections["sessions.live"] : undefined;
    if (section === undefined) return fail("has no sessions.live section");
    if (section.value === null || section.value === undefined) return done([]);
    const live = Session.parse(section.value);
    return live.ok ? write([live.value]) : fail("sessions.live is not a session");
  }
  if (!safeUrl(base)) return fail("needs https");
  const query = new URLSearchParams();
  if (input.failing === true) query.set("failing", "1");
  if (input.since !== undefined) query.set("since", input.since);
  const token = io.env?.KEEL_SESSIONS_TOKEN;
  const cookie = base.startsWith("https:") ? "__Host-keel-caller" : "keel-caller";
  const headers: Record<string, string> = { accept: "application/json" };
  if (token !== undefined && token !== "") headers.cookie = `${cookie}=${token}`;
  const q = query.toString();
  const got = await getJson(net, `${base}/sessions/list${q === "" ? "" : `?${q}`}`, { headers });
  if (!got.ok) return fail(got.why);
  const answer = Listed.parse(got.body);
  if (!answer.ok) return fail("answered without a sessions.list result");
  const out: Session[] = [];
  for (const fp of Object.keys(answer.value.results["sessions.list"].value).sort()) {
    for (const raw of answer.value.results["sessions.list"].value[fp]?.sessions ?? []) {
      const one = Session.parse(raw);
      if (one.ok) out.push(one.value);
    }
  }
  return write(out);
}
