// `@keel/std-report/tools`: the CLI-time half that `importDeps` loads for `keel check`, `keel build` and
// `keel report`: the `report.tally` record formatter and the `report` command (`stdCommand`). No exports.
import { formatter, stdCommand } from "@keel/cli";
import { Tally } from "./Tally.schema.ts";
import { command } from "./command.ts";

/** `orders.status paid=3 open=1`; `id 0` without rows. */
const compact = (t: Tally): string =>
  t.rows.length === 0 ? `${t.id} 0` : [t.id, ...t.rows.map((r) => `${r.key}=${r.n}`)].join(" ");

/** The id line, then keys left-aligned to the longest key and counts right-aligned to the widest count. */
const pretty = (t: Tally): string => {
  const kw = Math.max(0, ...t.rows.map((r) => r.key.length));
  const nw = Math.max(0, ...t.rows.map((r) => String(r.n).length));
  return [t.id, ...t.rows.map((r) => `${r.key.padEnd(kw)}  ${String(r.n).padStart(nw)}`)].join("\n");
};

formatter("report.tally", { schema: Tally, compact, pretty });
stdCommand("report", command);
