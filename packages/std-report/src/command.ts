import type { OutRecord, Outcome, StdOperation } from "@keel/cli";
import { s } from "@keel/schema";
import { Tally } from "./Tally.ts";
import { callerCookie } from "./callerCookie.ts";

const DEFAULT_URL = "http://localhost:5173";
const URL_MAX = 48;
const JSON_ONLY = { accept: "application/json" };

/** The parts of `GET /__keel/inspect` (k.inspect) that mark an inspect document; `sections` is absent without inspector hooks. */
const InspectDoc = s.object({
  live: s.boolean(),
  graph: s.object({}),
  stores: s.record(s.json()),
  ids: s.record(s.json()),
  a11y: s.record(s.json()),
  routes: s.record(s.json()),
  sections: s.record(s.json()).optional(),
});

/** A loader's answer (k.api): the route's `id` and the `Result` of each loader that ran, by route id. */
const LoaderAnswer = s.object({ id: s.string(), results: s.record(s.json()) });

/** A loader's `Result` that is ok. */
const OkResult = s.object({ ok: s.literal(true), value: s.json() });

/** The tallies a route-form body holds, a lone `Tally` as an array of one; `undefined` for a body of another shape. */
const talliesOf = (body: unknown): OutRecord[] | undefined => {
  const one = Tally.parse(body);
  if (one.ok) return [one.value];
  const many = s.array(Tally).parse(body);
  return many.ok ? many.value : undefined;
};

/** The `value` of the ok `results[id]` in a loader's answer; `undefined` for any other body. */
const loaded = (body: unknown): unknown => {
  const answer = LoaderAnswer.parse(body);
  if (!answer.ok || !Object.hasOwn(answer.value.results, answer.value.id)) return undefined;
  const result = OkResult.parse(answer.value.results[answer.value.id]);
  return result.ok ? result.value.value : undefined;
};

const done = (records: OutRecord[], counts: Record<string, number>, ok: boolean): Outcome => ({
  records: [...records, { kind: "summary", ok, name: "report", counts }],
  writes: [],
});

const diag = (code: string, message: string): OutRecord => ({
  kind: "diag",
  code,
  message,
  see: code === "E1056" ? "k.inspect" : "k.cli",
});

/** `url` without its query and fragment, cut to `URL_MAX`: the form an E1056 message names. */
const shown = (url: string): string => {
  const bare = url.replace(/[?#].*$/s, "");
  return bare.length > URL_MAX ? `${bare.slice(0, URL_MAX - 3)}...` : bare;
};

/** The parsed `url` when it names a route of the app: a path beyond `/` or a query. */
const routeOf = (url: string): URL | undefined => {
  const parsed = URL.canParse(url) ? new URL(url) : undefined;
  return parsed === undefined || (/^\/*$/.test(parsed.pathname) && parsed.search === "") ? undefined : parsed;
};

/**
 * The `report` command std.report fills with `stdCommand('report', command)` (k.cli), in one of two forms the `url`
 * alone decides, each making one request. Unreachable, non-2xx or a body of another shape is E1056, naming the url
 * without its query; without `io.fetch`, I1055.
 *
 * Inspect form (`url` absent, default `http://localhost:5173`, or with no path beyond `/` and no query): fetches
 * `<url>/__keel/inspect` from a running dev app and emits one `report.tally` record per inspector section whose
 * `value` parses with `Tally`, by section id ascending, then a `summary` named `report` with the count `tallies`.
 * Sections of another shape and sections holding an `error` are skipped. No credential is sent.
 *
 * Route form (a path beyond `/` or a query): fetches the url as given, a route the app serves behind its own guard.
 * The JSON body is a `Tally` or an array of them, emitted in the order given, then the summary. A loader's answer
 * `{ id, results }` (k.api) whose `results[id]` is `{ ok: true, value }` is read as its `value` is; no other entry of
 * `results` is read. An inspect document, an array with one item failing `Tally`, or a loader's answer whose
 * `results[id]` is absent, not ok or holds another `value` is E1056. A non-empty `KEEL_REPORT_TOKEN` in `io.env` goes with that
 * request as the caller cookie (`callerCookie`): it is read for the request and neither kept nor printed.
 */
export const command: StdOperation = {
  name: "report",
  description: "Print the tallies of a dev app's inspect sections, or of a route url answering them (std.report).",
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
    const given = input.url ?? DEFAULT_URL;
    const route = routeOf(given);
    const url = route === undefined ? given.replace(/[?#].*$/s, "").replace(/\/+$/, "") : given;
    const fail = (why: string): Outcome => done([diag("E1056", `${why}: ${shown(url)}`)], {}, false);
    const cookie = route === undefined ? undefined : callerCookie(route.href, io.env?.KEEL_REPORT_TOKEN);
    let res: Response;
    try {
      res =
        route === undefined
          ? await get(`${url}/__keel/inspect`)
          : await get(url, { headers: cookie === undefined ? JSON_ONLY : { ...JSON_ONLY, cookie } });
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
    if (route !== undefined) {
      const tallies = talliesOf(body) ?? talliesOf(loaded(body));
      return tallies === undefined
        ? fail("not a tally or an array of them")
        : done(tallies, { tallies: tallies.length }, true);
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
