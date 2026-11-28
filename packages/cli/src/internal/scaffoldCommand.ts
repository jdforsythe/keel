import { existsSync } from "node:fs";
import { join } from "node:path";
import { type Op, type ScaffoldDiag, scaffold } from "@keel/scaffold";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import type { Write } from "../types/Write.ts";
import type { Outcome } from "./Outcome.ts";
import { buildCommand } from "./buildCommand.ts";
import { cliVersion } from "./cliVersion.ts";
import { isError } from "./isError.ts";
import { isRecord } from "./isRecord.ts";
import { loadShells } from "./loadShells.ts";
import { makeDiag } from "./makeDiag.ts";
import { missingInput } from "./missingInput.ts";
import { openapiInput } from "./openapiInput.ts";
import { projectFiles } from "./projectFiles.ts";
import { projectOptions } from "./projectOptions.ts";
import { scaffoldInput } from "./scaffoldInput.ts";
import { summary } from "./summary.ts";
import { unifiedDiff } from "./unifiedDiff.ts";
import { withAgentFiles } from "./withAgentFiles.ts";
import { withLibraryFiles } from "./withLibraryFiles.ts";

const GENERATORS: readonly Op[] = [
  "project",
  "module",
  "route",
  "component",
  "store",
  "transaction",
  "service",
  "shell",
  "library",
];
const CODEMODS: readonly Op[] = ["rename", "move", "add-field", "place"];
/** A `.keel/` artifact `keel build` writes; the ledger's own files are not among them (k.ledger). */
const BUILT = /^\.keel\/(?!ledger\.json$|monitored\.json$)[^/]+\.json$/;
const RENAME_KINDS: Readonly<Record<string, readonly string[]>> = {
  pascal: ["component", "schema"],
  dotted: ["store", "route"],
};

const refusal = (d: ScaffoldDiag, into: string, op: Op, files: ReadonlyMap<string, string>): OutRecord[] => {
  const missing = d.missing === undefined ? undefined : missingInput(op, d.missing, files);
  return [
    makeDiag(d.code, missing?.message ?? d.message, {
      // A missing input is no file's: the diagnostic names the flag, not a path.
      path: d.path === undefined || d.missing !== undefined ? undefined : `${into}${d.path}`,
      line: d.line,
      col: d.col,
      see: missing?.see ?? d.see,
    }),
    ...(d.cause === undefined
      ? []
      : [makeDiag(d.cause.code, d.cause.message, { path: d.cause.path, line: d.cause.line, col: 1, see: "k.check" })]),
  ];
};

/**
 * `keel scaffold <op> ...` / `keel codemod <op> ...` over `io.files` through `@keel/scaffold`, which is pure, so
 * `--dry-run` only skips the writes (RFC 0045). An applied operation in a project holding a `.keel/` artifact of
 * `keel build` then refreshes what `keel check` reads (k.scaffold Refresh): the edit set is applied, `buildCommand`
 * runs up to the bundles over the new tree, its diagnostics follow the edit lines, and the trailer counts `artifacts` as that run of `keel build` does. The edit set comes back as `scaffold.edit` records (unified diffs
 * under `--dry-run`) plus writes for the binary (`project <name>`: under `<name>/`, with the agent files of the running
 * `@keel/cli` unless `--workspace`, its version, and k.create-manager's rules, `projectOptions`;
 * `library`: with `.gitignore` and the agent files in `<base>/`); a refusal is its diagnostic (E135x, E1005, E1052), nothing written. `codemod rename` without
 * `--kind` tries component then schema (PascalCase) or store then route (dotted), first one that finds `from`.
 */
export async function scaffoldCommand(name: "scaffold" | "codemod", input: Input, io: Io): Promise<Outcome> {
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
  // `scaffold project <name>` writes under `<name>/` (rfc:0068): the generator sees that directory as its tree.
  const dir = input.args?.[0];
  const into = op === "project" && typeof dir === "string" && dir !== "" ? `${dir}/` : "";
  const files = new Map(
    projectFiles(io)
      .filter((f) => f.path.startsWith(into))
      .map((f) => [f.path.slice(into.length), f.source]),
  );
  const dry = input["dry-run"] === true;
  const generated =
    op === "service" &&
    input.openapi !== undefined &&
    (input.name === undefined || /^[a-z][A-Za-z0-9]*$/.test(input.name))
      ? openapiInput(input.name ?? input.args?.[0], input.openapi, io.cwd, files)
      : undefined;
  if (generated !== undefined && !generated.ok)
    return { records: [generated.diag, summary(`${name} ${op}`, [generated.diag], {})], writes: [] };
  const given = scaffoldInput(op, input, generated?.value, (d) => d !== "" && existsSync(join(io.cwd, d)));
  // `project` outside the Keel monorepo follows k.create's Versions and k.create-manager's rules.
  const opts = op === "project" && input.workspace !== true ? projectOptions(io, into.slice(0, -1)) : undefined;
  if (opts?.cli !== undefined && opts.cli !== cliVersion()) {
    const d = makeDiag(
      "E1363",
      `@keel/cli ${opts.cli.slice(0, 16)} is above, this is ${cliVersion().slice(0, 16)}; run that version's keel`,
      { see: "k.create" },
    );
    return { records: [d, summary(`${name} ${op}`, [d], {})], writes: [] };
  }
  const base =
    opts === undefined
      ? given
      : {
          ...given,
          version: cliVersion(),
          member: opts.member,
          ...(opts.packageManager === undefined ? {} : { packageManager: opts.packageManager }),
        };
  const from = typeof base.from === "string" ? base.from : "";
  const kinds =
    op === "rename" && input.kind === undefined
      ? (RENAME_KINDS[/^[A-Z]/.test(from) ? "pascal" : "dotted"] ?? [])
      : [undefined];
  const { shells } = await loadShells(io.cwd, projectFiles(io), undefined);
  let result = scaffold(op, kinds[0] === undefined ? base : { ...base, kind: kinds[0] }, files, shells);
  for (const k of kinds.slice(1)) {
    if (result.ok || result.error.data.code !== "E1052") break;
    result = scaffold(op, { ...base, kind: k }, files, shells);
  }
  const label = `${name} ${op}`;
  if (!result.ok) {
    const rs = refusal(result.error.data, into, op, files);
    return { records: [...rs, summary(label, rs, {})], writes: [] };
  }
  const edit =
    op === "project" && input.workspace !== true
      ? await withAgentFiles(result.value, io)
      : op === "library" && typeof base.name === "string"
        ? await withLibraryFiles(result.value, io, base.name)
        : result.value;
  const after = (p: string): string | null => edit.files.get(p) ?? null;
  const records: OutRecord[] = [];
  const writes: Write[] = [];
  const add = (action: "create" | "change" | "remove", path: string): void => {
    const at = `${into}${path}`;
    const diff = dry ? unifiedDiff(at, action === "create" ? null : (files.get(path) ?? null), after(path)) : undefined;
    records.push({ kind: "scaffold.edit", action, path: at, ...(diff === undefined ? {} : { diff }) });
    writes.push({ path: at, content: action === "remove" ? null : after(path), readonly: false });
  };
  for (const p of edit.created) add("create", p);
  for (const p of edit.changed) add("change", p);
  for (const p of edit.removed) add("remove", p);
  for (const n of edit.notes ?? []) records.push({ kind: "scaffold.note", path: `${into}${n.path}`, note: n.note });
  if (opts?.outside === true)
    records.push(
      makeDiag("W1364", `${into.slice(0, 40)} is not in the workspace's package globs; add it to them`, {
        see: "k.create",
      }),
    );
  const counts = { created: edit.created.length, changed: edit.changed.length, removed: edit.removed.length };
  const built = into === "" && [...files.keys()].some((p) => BUILT.test(p));
  // `shell` refreshes nothing: the new shell package is not installed yet, so its target cannot load (k.scaffold-shell).
  // `library` writes a package of its own beside the project (k.library-pack Scaffold), none of the project's files.
  if (dry || !built || writes.length === 0 || op === "shell" || op === "library")
    return {
      records: [...records, summary(dry ? `${label} --dry-run` : label, [], counts)],
      writes: dry ? [] : writes,
    };
  io.apply?.(writes);
  const tree = [...edit.files].map(([path, source]) => ({ path, source }));
  const rebuilt = await buildCommand({ ...io, files: tree }, {}, true);
  const diags = rebuilt.records.filter((r) => r.kind !== "summary");
  const trailer = rebuilt.records.find((r) => r.kind === "summary");
  const failed = trailer?.ok !== true || diags.some(isError);
  const made = isRecord(trailer?.counts) ? trailer.counts.artifacts : undefined;
  const artifacts = failed || typeof made !== "number" ? 0 : made;
  return {
    records: [
      ...records,
      ...diags,
      summary(label, diags, { ...counts, artifacts, errors: failed ? Math.max(1, diags.filter(isError).length) : 0 }),
    ],
    writes: [...writes, ...rebuilt.writes],
    ...(rebuilt.stderr === undefined ? {} : { stderr: rebuilt.stderr }),
    ...(rebuilt.code === undefined ? {} : { code: rebuilt.code }),
  };
}
