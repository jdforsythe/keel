import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { InspectDocSchema } from "./InspectDocSchema.ts";
import { makeDiag } from "./makeDiag.ts";
import { summary } from "./summary.ts";
import { unavailable } from "./unavailable.ts";

const DEFAULT_URL = "http://localhost:5173";
const URL_MAX = 48;

const fail = (why: string, url: string): OutRecord[] => {
  const d = makeDiag("E1056", `${why}: ${url.length > URL_MAX ? `${url.slice(0, URL_MAX - 3)}...` : url}`, {
    see: "k.cli",
  });
  return [d, summary("inspect", [d], {})];
};

/**
 * `keel inspect [url]` (k.cli Inspect): fetch `<url>/__keel/inspect` from a running dev app and summarize it, one
 * `inspect.store` record per store (sorted by id), then counts. Unreachable, non-2xx, or a body that is not an
 * inspect document is E1056. Without `io.fetch` (an in-process engine with no network) it is I1055.
 */
export async function inspectCommand(input: Input, io: Io): Promise<OutRecord[]> {
  const get = io.fetch;
  if (get === undefined) return unavailable("inspect", "a network (io.fetch)", "k.cli");
  const url = (input.url ?? DEFAULT_URL).replace(/\/+$/, "");
  let res: Response;
  try {
    res = await get(`${url}/__keel/inspect`);
  } catch {
    return fail("inspect target unreachable", url);
  }
  if (!res.ok) return fail(`inspect target answered ${res.status}`, url);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  const doc = InspectDocSchema.parse(body);
  if (!doc.ok) return fail("not an inspect document", url);
  const d = doc.value;
  const ids = Object.keys(d.stores).sort();
  const records: OutRecord[] = ids.map((id) => {
    const log = d.stores[id]?.log ?? [];
    const last = log[log.length - 1]?.name;
    return { kind: "inspect.store", id, entries: log.length, ...(last === undefined ? {} : { last }) };
  });
  const counts = {
    nodes: d.graph.nodes.length,
    edges: d.graph.edges.length,
    stores: ids.length,
    ids: Object.keys(d.ids).length,
    a11y: Object.keys(d.a11y).length,
    routes: Object.keys(d.routes).length,
  };
  return [...records, summary(d.live ? "inspect live" : "inspect (no live page)", [], counts)];
}
