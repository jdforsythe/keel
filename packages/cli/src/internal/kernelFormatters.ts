import { EvidenceRecord } from "../evidence/EvidenceRecord.ts";
import { A11ySchema } from "./A11ySchema.ts";
import { DiagSchema } from "./DiagSchema.ts";
import { DocsAreaSchema } from "./DocsAreaSchema.ts";
import { DocsCiteSchema } from "./DocsCiteSchema.ts";
import { DocsCodeSchema } from "./DocsCodeSchema.ts";
import { DocsEntrySchema } from "./DocsEntrySchema.ts";
import { DocsHitSchema } from "./DocsHitSchema.ts";
import { DocsSectionSchema } from "./DocsSectionSchema.ts";
import { DocsSkillSchema } from "./DocsSkillSchema.ts";
import { DocsTermSchema } from "./DocsTermSchema.ts";
import { EditSchema } from "./EditSchema.ts";
import type { Entry } from "./Entry.ts";
import { ExplainSchema } from "./ExplainSchema.ts";
import { InspectSectionSchema } from "./InspectSectionSchema.ts";
import { InspectStoreSchema } from "./InspectStoreSchema.ts";
import { LedgerMutationSchema } from "./LedgerMutationSchema.ts";
import { LedgerSchema } from "./LedgerSchema.ts";
import { ReqSchema } from "./ReqSchema.ts";
import { ReviewSchema } from "./ReviewSchema.ts";
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

/** `keel review`'s trailer says `listed` where its json count says `list` (k.review Loudness). */
const trailerCounts = (c: Readonly<Record<string, number>>): Record<string, number> =>
  Object.fromEntries(Object.entries(c).map(([k, v]) => [k === "list" ? "listed" : k, v]));

/** A file's text as it is: the record's line break follows, so one final newline is dropped. */
const verbatim = (t: string): string => (t.endsWith("\n") ? t.slice(0, -1) : t);
const VALUE_MAX = 120;
const clip = (s: string): string => (s.length > VALUE_MAX ? `${s.slice(0, VALUE_MAX - 3)}...` : s);

/**
 * Formatters registered at startup. Kernel kinds (k.cli): diag, summary, req, a11y, evidence, and k.ledger's ledger and
 * ledger.mutation.
 * The cli's own record kinds (docs.area, docs.entry, docs.section, docs.skill, docs.cite, docs.code, docs.term, docs.hit, explain.text, scaffold.edit, inspect.store, inspect.section) go through the same extension point.
 */
export const kernelFormatters: readonly (readonly [string, Entry])[] = [
  ["diag", entryOf({ schema: DiagSchema, compact: diagCompact, pretty: diagPretty })],
  [
    "summary",
    entryOf({
      schema: SummarySchema,
      compact: (r) =>
        [r.ok ? "ok" : "fail", r.name, countsText(r.name === "review" ? trailerCounts(r.counts) : r.counts)]
          .filter((p) => p !== "")
          .join(" "),
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
      compact: (r) => [r.method, r.path, r.route, r.status, `${r.ms}ms`].filter((p) => p !== undefined).join(" "),
      pretty: (r) => `${r.status} ${r.method} ${r.path}${r.route === undefined ? "" : `  (${r.route})`}  ${r.ms}ms`,
    }),
  ],
  [
    "review",
    entryOf({
      schema: ReviewSchema,
      compact: (r) => `${r.code} ${r.path}:${r.line}:${r.col} ${r.danger} ${r.novelty} ${r.message}`,
      pretty: (r) =>
        `${r.loud.padEnd(4)} ${r.code} ${r.path}:${r.line}:${r.col}\n  ${r.danger}, ${r.novelty}${r.opt ? ", opt-in" : ""}: ${r.message}${r.reason === undefined ? "" : `\n  reason: ${r.reason}`}\n  see: keel explain ${r.code}`,
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
    "evidence",
    entryOf({
      schema: EvidenceRecord,
      compact: (r) => `ok evidence ${r.dir} ${r.files} files key ${r.keyId}`,
      pretty: (r) => `evidence ${r.dir}: verified, ${r.files} files signed ${r.at} by key ${r.keyId}`,
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
    "docs.entry",
    entryOf({
      schema: DocsEntrySchema,
      compact: (r) =>
        `${r.id} ${r.title} ${r.package}${r.installed ? "" : " not installed"}${r.holds ? `: ${r.holds}` : ""}`,
      pretty: (r) =>
        `${r.id.padEnd(16)} ${r.title} (${r.package}${r.installed ? "" : ", not installed"})${r.holds ? `\n  ${r.holds}` : ""}`,
    }),
  ],
  [
    "docs.area",
    entryOf({
      schema: DocsAreaSchema,
      compact: (r) => `${r.id} ${r.title}, ${r.sections} ${r.sections === 1 ? "section" : "sections"}`,
      pretty: (r) => `${r.id.padEnd(10)} ${r.title} (${r.sections} ${r.sections === 1 ? "section" : "sections"})`,
    }),
  ],
  [
    "docs.code",
    entryOf({
      schema: DocsCodeSchema,
      compact: (r) => [r.code, ...r.ids.slice(0, 3), ...(r.ids.length > 3 ? [`+${r.ids.length - 3}`] : [])].join(" "),
      pretty: (r) => `${r.code}: ${r.ids.join(", ")}`,
    }),
  ],
  [
    "docs.term",
    entryOf({
      schema: DocsTermSchema,
      compact: (r) => `${r.term}: ${r.text}`,
      pretty: (r) => `${r.term}\n  ${r.text}`,
    }),
  ],
  [
    "docs.hit",
    entryOf({
      schema: DocsHitSchema,
      compact: (r) => `${r.id} ${r.title} ${r.count}`,
      pretty: (r) => `${r.id.padEnd(16)} ${r.title} (${r.count} ${r.count === 1 ? "span" : "spans"})`,
    }),
  ],
  [
    "docs.section",
    entryOf({ schema: DocsSectionSchema, compact: (r) => verbatim(r.text), pretty: (r) => verbatim(r.text) }),
  ],
  [
    "docs.skill",
    entryOf({ schema: DocsSkillSchema, compact: (r) => verbatim(r.text), pretty: (r) => verbatim(r.text) }),
  ],
  [
    "docs.cite",
    entryOf({
      schema: DocsCiteSchema,
      compact: (r) => `${r.id}:${r.line} ${r.text}`,
      pretty: (r) => `${r.id}:${r.line}\n  ${r.text}`,
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
      compact: (r) =>
        `section ${r.deployable === undefined ? "" : `${r.deployable} `}${r.id} ${clip(JSON.stringify(r.value))}`,
      pretty: (r) =>
        `section ${r.deployable === undefined ? "" : `${r.deployable} `}${r.id}: ${r.doc}\n  ${clip(JSON.stringify(r.value))}`,
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
