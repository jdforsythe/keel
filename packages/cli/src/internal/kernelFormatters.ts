import { A11ySchema } from "./A11ySchema.ts";
import { CiteSchema } from "./CiteSchema.ts";
import { DiagSchema } from "./DiagSchema.ts";
import { EditSchema } from "./EditSchema.ts";
import type { Entry } from "./Entry.ts";
import { ExplainSchema } from "./ExplainSchema.ts";
import { InspectSectionSchema } from "./InspectSectionSchema.ts";
import { InspectStoreSchema } from "./InspectStoreSchema.ts";
import { LedgerMutationSchema } from "./LedgerMutationSchema.ts";
import { LedgerSchema } from "./LedgerSchema.ts";
import { ReqSchema } from "./ReqSchema.ts";
import { SectionSchema } from "./SectionSchema.ts";
import { SummarySchema } from "./SummarySchema.ts";
import { countsText } from "./countsText.ts";
import { diagCompact } from "./diagCompact.ts";
import { diagPretty } from "./diagPretty.ts";
import { entryOf } from "./entryOf.ts";

const flags = (st: Readonly<Record<string, boolean | undefined>>): string => {
  const on = Object.entries(st)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  return on.length === 0 ? "" : ` [${on.join(" ")}]`;
};

const VALUE_MAX = 120;
const clip = (s: string): string => (s.length > VALUE_MAX ? `${s.slice(0, VALUE_MAX - 3)}...` : s);

/**
 * Formatters registered at startup. Kernel kinds (k.cli): diag, summary, req, a11y, and k.ledger's ledger and ledger.mutation.
 * The cli's own record kinds (spec.section, spec.cite, explain.text, scaffold.edit, inspect.store, inspect.section) go through the same extension point.
 */
export const kernelFormatters: readonly (readonly [string, Entry])[] = [
  ["diag", entryOf({ schema: DiagSchema, compact: diagCompact, pretty: diagPretty })],
  [
    "summary",
    entryOf({
      schema: SummarySchema,
      compact: (r) => [r.ok ? "ok" : "fail", r.name, countsText(r.counts)].filter((p) => p !== "").join(" "),
      pretty: (r) => {
        const c = countsText(r.counts);
        return `${r.name}: ${r.ok ? "passed" : "failed"}${c === "" ? "" : ` (${c})`}`;
      },
    }),
  ],
  [
    "req",
    entryOf({
      schema: ReqSchema,
      compact: (r) =>
        [r.method, r.path, r.route, String(r.status), `${r.ms}ms`].filter((p) => p !== undefined).join(" "),
      pretty: (r) => `${r.status} ${r.method} ${r.path}${r.route === undefined ? "" : `  (${r.route})`}  ${r.ms}ms`,
    }),
  ],
  [
    "ledger",
    entryOf({
      schema: LedgerSchema,
      compact: (r) => `${r.item} ${r.rung} ${r.evidence}`,
      pretty: (r) => `${r.rung.padEnd(13)} ${r.item}\n  evidence: ${r.evidence}`,
    }),
  ],
  [
    "ledger.mutation",
    entryOf({
      schema: LedgerMutationSchema,
      compact: (r) => `${r.file} ${r.score.toFixed(1)}% ${r.survived} survived${r.fresh ? "" : " stale"}`,
      pretty: (r) => `${r.file}: ${r.score.toFixed(1)}% (${r.survived} survived)${r.fresh ? "" : ", stale"}`,
    }),
  ],
  [
    "a11y",
    entryOf({
      schema: A11ySchema,
      compact: (r) => `${"  ".repeat(r.depth)}${r.role} "${r.name}" ${r.id}${flags(r.state)}`,
      pretty: (r) => `${"  ".repeat(r.depth)}- ${r.role} "${r.name}" (#${r.id})${flags(r.state)}`,
    }),
  ],
  [
    "spec.section",
    entryOf({ schema: SectionSchema, compact: (r) => r.text.trimEnd(), pretty: (r) => r.text.trimEnd() }),
  ],
  [
    "spec.cite",
    entryOf({
      schema: CiteSchema,
      compact: (r) => `${r.path}:${r.line} ${r.text}`,
      pretty: (r) => `${r.path}:${r.line}\n  ${r.text}`,
    }),
  ],
  [
    "explain.text",
    entryOf({
      schema: ExplainSchema,
      compact: (r) => (r.text.includes(r.code) ? r.text : `${r.code} ${r.text}`),
      pretty: (r) => `${r.code}\n\n${r.text}`,
    }),
  ],
  [
    "inspect.store",
    entryOf({
      schema: InspectStoreSchema,
      compact: (r) => `${r.id} ${r.entries} entries${r.last === undefined ? "" : `, last ${r.last}`}`,
      pretty: (r) => `store ${r.id}: ${r.entries} log entries${r.last === undefined ? "" : ` (last ${r.last})`}`,
    }),
  ],
  [
    "inspect.section",
    entryOf({
      schema: InspectSectionSchema,
      compact: (r) => `section ${r.id} ${clip(JSON.stringify(r.value))}`,
      pretty: (r) => `section ${r.id}: ${r.doc}\n  ${clip(JSON.stringify(r.value))}`,
    }),
  ],
  [
    "scaffold.edit",
    entryOf({
      schema: EditSchema,
      compact: (r) => r.diff ?? `${r.action} ${r.path}`,
      pretty: (r) => (r.diff === undefined ? `${r.action.padEnd(6)} ${r.path}` : `${r.action} ${r.path}\n${r.diff}`),
    }),
  ],
];
