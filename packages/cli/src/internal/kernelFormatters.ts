import { A11ySchema } from "./A11ySchema.ts";
import { CiteSchema } from "./CiteSchema.ts";
import { DiagSchema } from "./DiagSchema.ts";
import { EditSchema } from "./EditSchema.ts";
import type { Entry } from "./Entry.ts";
import { ExplainSchema } from "./ExplainSchema.ts";
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

/**
 * Formatters registered at startup. Kernel kinds (k.cli): diag, summary, req, ledger, a11y.
 * The cli's own record kinds (spec.section, spec.cite, explain.text, scaffold.edit) go through the same extension point.
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
    "scaffold.edit",
    entryOf({
      schema: EditSchema,
      compact: (r) => r.diff ?? `${r.action} ${r.path}`,
      pretty: (r) => (r.diff === undefined ? `${r.action.padEnd(6)} ${r.path}` : `${r.action} ${r.path}\n${r.diff}`),
    }),
  ],
];
