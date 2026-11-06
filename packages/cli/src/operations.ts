import { s } from "@keel/schema";
import { A11ySchema } from "./internal/A11ySchema.ts";
import { CiteSchema } from "./internal/CiteSchema.ts";
import { EditSchema } from "./internal/EditSchema.ts";
import { ExplainSchema } from "./internal/ExplainSchema.ts";
import { LedgerSchema } from "./internal/LedgerSchema.ts";
import { ReqSchema } from "./internal/ReqSchema.ts";
import { SectionSchema } from "./internal/SectionSchema.ts";
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
  path: s.string().optional(),
  file: s.string().optional(),
  openapi: s.string().optional(),
  to: s.string().optional(),
  default: s.string().optional(),
};

/** The command table (k.cli Commands): each command defined once, served by the binary, MCP and LSP. */
export const operations: readonly Operation[] = [
  {
    name: "check",
    description: "Run the k.check pipeline over the project, or the given paths.",
    input: s.object({ paths, ...diagnostic }),
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
    description: "Compile the project and write the .keel artifacts; vite build when vite.config.ts exists.",
    input: s.object(diagnostic),
    output: outputOf(),
    positional: [],
    scope: "query",
  },
  {
    name: "dev",
    description: "Dev server and log stream (k.server).",
    input: s.object(diagnostic),
    output: outputOf(ReqSchema),
    positional: [],
    scope: "none",
  },
  {
    name: "spec",
    description: "Print one spec section, every spec line citing a code (for), or the map.",
    input: s.object({ id: s.string().optional(), for: s.string().optional(), map: s.boolean().optional(), ...common }),
    output: outputOf(SectionSchema, CiteSchema),
    positional: ["id"],
    scope: "query",
  },
  {
    name: "explain",
    description: "Meaning and fix pattern of one diagnostic code, at most 120 tokens.",
    input: s.object({ code: s.string().optional(), ...common }),
    output: outputOf(ExplainSchema),
    positional: ["code"],
    scope: "none",
  },
  {
    name: "inspect",
    description: "Query a running dev app: state, deps, tree, a11y or log.",
    input: s.object({
      what: s.enum(["state", "deps", "tree", "a11y", "log"]).optional(),
      id: s.string().optional(),
      ...common,
    }),
    output: outputOf(A11ySchema, ReqSchema),
    positional: ["what"],
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
    description: "Structural codemod: rename, move, add-field (k.scaffold).",
    input: s.object(structural),
    output: outputOf(EditSchema),
    positional: ["op", "args"],
    scope: "tree",
  },
  {
    name: "ledger",
    description: "Emit the verification ledger, or diff it against the committed one.",
    input: s.object({ diff: s.boolean().optional(), ...diagnostic }),
    output: outputOf(LedgerSchema),
    positional: [],
    scope: "query",
  },
];
