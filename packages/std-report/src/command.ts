import type { OutRecord, Outcome, StdOperation } from "@keel/cli";
import { s } from "@keel/schema";
import { Tally } from "./Tally.ts";

const DEFAULT_URL = "http://localhost:5173";
const URL_MAX = 48;

/** The parts of `GET /__keel/inspect` (k.cli Inspect) that mark an inspect document; `sections` is absent without inspector hooks. */
const InspectDoc = s.object({
  live: s.boolean(),
  graph: s.object({}),
  stores: s.record(s.json()),
  ids: s.record(s.json()),
  a11y: s.record(s.json()),
  routes: s.record(s.json()),
  sections: s.record(s.json()).optional(),
});

const done = (records: OutRecord[], counts: Record<string, number>, ok: boolean): Outcome => ({
  records: [...records, { kind: "summary", ok, name: "report", counts }],
  writes: [],
});

const diag = (code: string, message: string): OutRecord => ({ kind: "diag", code, message, see: "k.cli" });

/**
 * The `report` command std.report fills with `stdCommand('report', command)` (k.cli): `keel report [url]` fetches
 * `<url>/__keel/inspect` from a running dev app (default `http://localhost:5173`) and emits one `report.tally` record
 * per inspector section whose `value` parses with `Tally`, by section id ascending, then a `summary` named `report`
 * with the count `tallies`. Sections of another shape and sections holding an `error` are skipped. Unreachable,
 * non-2xx, or a body that is not an inspect document is E1056; without `io.fetch`, I1055.
 */
export const command: StdOperation = {
  name: "report",
  description: "Print the tallies a running dev app serves as inspect sections (std.report).",
  input: s.object({
    url: s.string().optional(),
    format: s.enum(["compact", "json", "pretty"]).optional(),
    quiet: s.boolean().optional(),
    limit: s.int({ min: 0, max: 1_000_000 }).optional(),
    verbose: s.boolean().optional(),
  }),
  output: s.object({ records: s.array(s.object({ kind: s.string() })) }),
  positional: ["url"],
  scope: "none",
  run: async (input, io) => {
    const get = io.fetch;
    if (get === undefined) return done([diag("I1055", "report not available: needs a network (io.fetch)")], {}, true);
    const url = (input.url ?? DEFAULT_URL).replace(/\/+$/, "");
    const fail = (why: string): Outcome =>
      done([diag("E1056", `${why}: ${url.length > URL_MAX ? `${url.slice(0, URL_MAX - 3)}...` : url}`)], {}, false);
    let res: Response;
    try {
      res = await get(`${url}/__keel/inspect`);
    } catch {
      return fail("report target unreachable");
    }
    if (!res.ok) return fail(`report target answered ${res.status}`);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const doc = InspectDoc.parse(body);
    if (!doc.ok) return fail("not an inspect document");
    const sections = doc.value.sections ?? {};
    const tallies: OutRecord[] = [];
    for (const id of Object.keys(sections).sort()) {
      const section = s.object({ value: Tally }).parse(sections[id]);
      if (section.ok && !("error" in section.value)) tallies.push(section.value.value);
    }
    return done(tallies, { tallies: tallies.length }, true);
  },
};
