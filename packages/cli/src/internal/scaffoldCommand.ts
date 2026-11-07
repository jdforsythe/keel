import { type Op, type ScaffoldDiag, plan, scaffold } from "@keel/scaffold";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { Write } from "../types/Write.ts";
import type { Outcome } from "./Outcome.ts";
import { makeDiag } from "./makeDiag.ts";
import { openapiInput } from "./openapiInput.ts";
import { projectFiles } from "./projectFiles.ts";
import { scaffoldInput } from "./scaffoldInput.ts";
import { summary } from "./summary.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const GENERATORS: readonly Op[] = ["project", "module", "route", "component", "store", "transaction", "service"];
const CODEMODS: readonly Op[] = ["rename", "move", "add-field"];
const RENAME_KINDS: Readonly<Record<string, readonly string[]>> = {
  pascal: ["component", "schema"],
  dotted: ["store", "route"],
};

const refusal = (d: ScaffoldDiag): OutRecord[] => [
  makeDiag(d.code, d.message, { path: d.path, line: d.line, col: d.col, see: d.see }),
  ...(d.cause === undefined
    ? []
    : [makeDiag(d.cause.code, d.cause.message, { path: d.cause.path, line: d.cause.line, col: 1, see: "k.check" })]),
];

/**
 * `keel scaffold <op> ...` / `keel codemod <op> ...` over `io.files` through `@keel/scaffold` (`--dry-run` ->
 * `plan`). The edit set comes back as `scaffold.edit` records (unified diffs under `--dry-run`) plus writes for
 * the binary; a refusal is its diagnostic (E135x, E1005, E1052), nothing written. `codemod rename` without
 * `--kind` tries component then schema (PascalCase) or store then route (dotted), first one that finds `from`.
 */
export function scaffoldCommand(name: "scaffold" | "codemod", input: Input, io: Io): Outcome {
  const opName = input.op;
  if (opName === undefined) return { records: [summary(name, [], { created: 0, changed: 0, removed: 0 })], writes: [] };
  const mine = name === "scaffold" ? GENERATORS : CODEMODS;
  const op = mine.find((o) => o === opName);
  if (op === undefined) {
    const other = (name === "scaffold" ? CODEMODS : GENERATORS).some((o) => o === opName)
      ? `; it is keel ${name === "scaffold" ? "codemod" : "scaffold"} ${opName}`
      : "";
    const d = makeDiag("E1052", `unknown ${name} operation ${JSON.stringify(opName.slice(0, 24))}${other}`, {
      see: "k.scaffold",
    });
    return { records: [d, summary(name, [d], {})], writes: [] };
  }
  const files = new Map(projectFiles(io).map((f) => [f.path, f.source]));
  const dry = input["dry-run"] === true;
  const call = dry ? plan : scaffold;
  const generated = op === "service" ? openapiInput(input.args?.[0], input, io.cwd, files) : undefined;
  if (generated !== undefined && !generated.ok)
    return { records: [generated.diag, summary(`${name} ${op}`, [generated.diag], {})], writes: [] };
  const base = scaffoldInput(op, input, generated?.value);
  const from = typeof base.from === "string" ? base.from : "";
  const kinds =
    op === "rename" && input.kind === undefined
      ? (RENAME_KINDS[/^[A-Z]/.test(from) ? "pascal" : "dotted"] ?? [])
      : [undefined];
  let result = call(op, kinds[0] === undefined ? base : { ...base, kind: kinds[0] }, files);
  for (const k of kinds.slice(1)) {
    if (result.ok || result.error.data.code !== "E1052") break;
    result = call(op, { ...base, kind: k }, files);
  }
  const label = `${name} ${op}`;
  if (!result.ok) {
    const rs = refusal(result.error.data);
    return { records: [...rs, summary(label, rs, {})], writes: [] };
  }
  const edit = result.value;
  const after = (p: string): string | null => edit.files.get(p) ?? null;
  const records: OutRecord[] = [];
  const writes: Write[] = [];
  const add = (action: "create" | "change" | "remove", path: string): void => {
    const diff = dry
      ? unifiedDiff(path, action === "create" ? null : (files.get(path) ?? null), after(path))
      : undefined;
    records.push({ kind: "scaffold.edit", action, path, ...(diff === undefined ? {} : { diff }) });
    writes.push({ path, content: action === "remove" ? null : after(path), readonly: false });
  };
  for (const p of edit.created) add("create", p);
  for (const p of edit.changed) add("change", p);
  for (const p of edit.removed) add("remove", p);
  const counts = { created: edit.created.length, changed: edit.changed.length, removed: edit.removed.length };
  return { records: [...records, summary(dry ? `${label} --dry-run` : label, [], counts)], writes: dry ? [] : writes };
}
