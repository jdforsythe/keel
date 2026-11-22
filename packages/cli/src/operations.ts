import { s } from "@keel/schema";
import { EvidenceRecord } from "./evidence/EvidenceRecord.ts";
import { A11ySchema } from "./internal/A11ySchema.ts";
import { DocsCiteSchema } from "./internal/DocsCiteSchema.ts";
import { DocsEntrySchema } from "./internal/DocsEntrySchema.ts";
import { DocsSectionSchema } from "./internal/DocsSectionSchema.ts";
import { DocsSkillSchema } from "./internal/DocsSkillSchema.ts";
import { EditSchema } from "./internal/EditSchema.ts";
import { ExplainSchema } from "./internal/ExplainSchema.ts";
import { InspectSectionSchema } from "./internal/InspectSectionSchema.ts";
import { InspectStoreSchema } from "./internal/InspectStoreSchema.ts";
import { LedgerSchema } from "./internal/LedgerSchema.ts";
import { ReqSchema } from "./internal/ReqSchema.ts";
import { ReviewSchema } from "./internal/ReviewSchema.ts";
import { outputOf } from "./internal/outputOf.ts";
import type { Operation } from "./types/Operation.ts";

/** Every command accepts these (k.cli). */
const common = {
  format: s.enum(["compact", "json", "pretty"]).optional(),
  quiet: s.boolean().optional(),
  limit: s.int().optional(),
  verbose: s.boolean().optional(),
};
/** Diagnostic-emitting commands also accept `--code`. */
const diagnostic = { ...common, code: s.string().optional() };
const paths = s.array(s.string()).optional();
/** k.scaffold operation flags. */
const structural = {
  ...diagnostic,
  op: s.string().optional(),
  args: s.array(s.string()).optional(),
  "dry-run": s.boolean().optional(),
  kind: s.enum(["component", "store", "route", "schema"]).optional(),
  adapter: s.enum(["client", "node", "static"]).optional(),
  workspace: s.boolean().optional(),
  path: s.string().optional(),
  file: s.string().optional(),
  api: s.boolean().optional(),
  openapi: s.string().optional(),
  to: s.string().optional(),
  default: s.string().optional(),
};

/** The command table (k.cli Commands): each command defined once, served by the binary, MCP and LSP. */
export const operations: readonly Operation[] = [
  {
    name: "check",
    description: "Run k.check over the project or the given paths.",
    input: s.object({ paths, base: s.string().optional(), ...diagnostic }),
    output: outputOf(),
    positional: ["paths"],
    scope: "query",
  },
  {
    name: "test",
    description: "Run the test harness under a sim ctx (k.testing).",
    input: s.object({ paths, ...diagnostic }),
    output: outputOf(),
    positional: ["paths"],
    scope: "query",
  },
  {
    name: "build",
    description: "Compile the project, write .keel artifacts, vite build.",
    input: s.object({
      target: s.enum(["capacitor", "tauri"]).optional(),
      platform: s.string().optional(),
      release: s.boolean().optional(),
      ...diagnostic,
    }),
    output: outputOf(),
    positional: [],
    scope: "query",
  },
  {
    name: "dev",
    description: "Dev server and log stream (k.server).",
    input: s.object({ port: s.int({ min: 1, max: 65535 }).optional(), ...diagnostic }),
    output: outputOf(ReqSchema),
    positional: [],
    scope: "none",
  },
  {
    name: "docs",
    description: "Installed docs: the map, a section or skill, --for <code>, --sync.",
    input: s.object({ id: s.string().optional(), for: s.string().optional(), sync: s.boolean().optional(), ...common }),
    output: outputOf(DocsEntrySchema, DocsSectionSchema, DocsSkillSchema, DocsCiteSchema, EditSchema),
    positional: ["id"],
    scope: "docs",
  },
  {
    name: "explain",
    description: "Meaning and fix of one diagnostic code.",
    input: s.object({ code: s.string().optional(), ...common }),
    output: outputOf(ExplainSchema),
    positional: ["code"],
    scope: "none",
  },
  {
    name: "inspect",
    description: "Summarize GET /__keel/inspect of a dev app (default http://localhost:5173).",
    input: s.object({ url: s.string().optional(), ...common }),
    output: outputOf(InspectStoreSchema, InspectSectionSchema),
    positional: ["url"],
    scope: "none",
  },
  {
    name: "render",
    description: "The a11y tree of one render of a route or component.",
    input: s.object({ target: s.string().optional(), props: s.string().optional(), ...common }),
    output: outputOf(A11ySchema),
    positional: ["target"],
    scope: "none",
  },
  {
    name: "scaffold",
    description: "Structural generator: project, module, route, component, store (k.scaffold).",
    input: s.object(structural),
    output: outputOf(EditSchema),
    positional: ["op", "args"],
    scope: "tree",
  },
  {
    name: "codemod",
    description: "Structural codemod: rename, move, add-field, place (k.scaffold).",
    input: s.object(structural),
    output: outputOf(EditSchema),
    positional: ["op", "args"],
    scope: "tree",
  },
  {
    name: "ledger",
    description: "Emit the ledger, --write it, or diff it against the committed one.",
    input: s.object({
      diff: s.boolean().optional(),
      write: s.string().optional(),
      scope: s.string().optional(),
      ...diagnostic,
    }),
    output: outputOf(LedgerSchema),
    positional: [],
    scope: "ledger",
  },
  {
    name: "evidence",
    description: "Write a signed evidence bundle, or --verify one with --key <keyId>.",
    input: s.object({
      out: s.string().optional(),
      audit: s.string().optional(),
      verify: s.string().optional(),
      key: s.string().optional(),
      ...common,
    }),
    output: outputOf(EvidenceRecord),
    positional: [],
    scope: "ledger",
  },
  {
    name: "review",
    description: "Escapes from the framework's protections by danger and novelty, over a git range or --all.",
    input: s.object({
      paths,
      all: s.boolean().optional(),
      list: s.boolean().optional(),
      "fail-on": s.enum(["warn"]).optional(),
      accept: s.string().optional(),
      reason: s.string().optional(),
      ...diagnostic,
    }),
    output: outputOf(ReviewSchema, EditSchema),
    positional: ["paths"],
    scope: "none",
  },
];
