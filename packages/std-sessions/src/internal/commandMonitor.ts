import type { Io, OutRecord, Outcome } from "@keel/cli";
import { s } from "@keel/schema";
import { Tally } from "../monitor/Tally.schema.ts";
import { getJson } from "./getJson.ts";
import { readerHeaders } from "./readerHeaders.ts";
import { safeUrl } from "./safeUrl.ts";
import { sessionDiag } from "./sessionDiag.ts";

const MONITORED = ".keel/monitored.json";
/** A runtime response of `sessions.tally`: `results["sessions.tally"]` is `ok(Tally)`. */
const Answer = s.object({
  results: s.object({ "sessions.tally": s.object({ ok: s.literal(true), value: Tally }) }),
});

/**
 * `keel session monitor <url> [--out f]` (std.monitor): `GET <url>/sessions/tally` with the reader cookie the way
 * `ingest` sends it (https, or a loopback host), and write `{ v: 1, origin, from, to, tx }` (`tx` keys sorted) to
 * `f`, default `.keel/monitored.json`, with one `session.monitor` record. Unreachable, non-2xx, or not a `Tally` is
 * E2010 and writes nothing; without `io.fetch`, I1055.
 */
export async function commandMonitor(target: string | undefined, out: string | undefined, io: Io): Promise<Outcome> {
  const done = (records: OutRecord[], writes: Outcome["writes"] = []): Outcome => {
    const ok = !records.some((r) => r.kind === "diag" && String(r.code).startsWith("E"));
    return { records: [...records, { kind: "summary", ok, name: "session monitor", counts: {} }], writes };
  };
  const fetch = io.fetch;
  if (fetch === undefined) return done([sessionDiag("I1055", "session monitor needs a network (io.fetch)")]);
  const base = (target ?? "").replace(/\/+$/, "");
  if (base === "") return done([sessionDiag("E1052", "session monitor needs the tally service url")]);
  const fail = (why: string): Outcome => done([sessionDiag("E2010", `session monitor ${why}: ${base.slice(0, 48)}`)]);
  if (!safeUrl(base)) return fail("needs https");
  const got = await getJson({ ...io, fetch }, `${base}/sessions/tally`, { headers: readerHeaders(io, base) });
  if (!got.ok) return fail(got.why);
  const answer = Answer.parse(got.body);
  if (!answer.ok) return fail("answered without a Tally");
  const tally = answer.value.results["sessions.tally"].value;
  const tx: Record<string, number> = {};
  for (const name of Object.keys(tally.tx).sort()) tx[name] = tally.tx[name] ?? 0;
  const origin = new URL(base).origin;
  const file = out ?? MONITORED;
  const content = `${JSON.stringify({ v: 1, origin, from: tally.from, to: tally.to, tx }, null, 2)}\n`;
  const runs = Object.values(tx).reduce((a, b) => a + b, 0);
  const record = { kind: "session.monitor", origin, transactions: Object.keys(tx).length, runs, file };
  return done([record], [{ path: file, content, readonly: false }]);
}
