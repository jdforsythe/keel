import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Io, OutRecord, Outcome, SourceFile } from "@keel/cli";
import { Session } from "../Session.schema.ts";
import { toTest } from "../toTest.ts";
import { parseTs } from "./parseTs.ts";
import { placedRoutes } from "./placedRoutes.ts";
import { projectOf } from "./projectOf.ts";
import { redactLiterals } from "./redactLiterals.ts";
import { runJob } from "./runJob.ts";
import { servingDeployable } from "./servingDeployable.ts";
import { servingModules } from "./servingModules.ts";
import { sessionDiag } from "./sessionDiag.ts";
import { sessionOut } from "./sessionOut.ts";
import { sessionText } from "./sessionText.ts";

type Op = "replay" | "minimize" | "to-test";
const IDENT = /^[A-Za-z_$][\w$]*$/;

/** The target's text: from `files` when given there, else from disk under `cwd`. */
function sourceOf(io: Io, files: readonly SourceFile[], target: string): string | undefined {
  const rel = path.normalize(target).split(path.sep).join("/");
  const given = files.find((f) => f.path === rel);
  if (given !== undefined) return given.source;
  const abs = path.resolve(io.cwd, target);
  return existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
}

/** `list` entries of `modules/<m>/module.ts`'s `std['@keel/std-sessions']` (literal strings only). */
function entriesOf(files: readonly SourceFile[], m: string, list: "redact" | "expose"): string[] {
  const f = files.find((x) => x.path === `modules/${m}/module.ts`);
  const ast = f === undefined ? undefined : parseTs(f.path, f.source);
  if (ast === undefined) return [];
  return redactLiterals(ast)
    .literals.filter((l) => l.list === list)
    .map((l) => l.value);
}

/** Stores the emitted test can import: id `<module>.<name>` with a `modules/<module>/<name>.ts` file. */
function storesOf(files: readonly SourceFile[], ids: readonly string[], m: string) {
  const have = new Set(files.map((f) => f.path));
  return ids.flatMap((id) => {
    const dot = id.indexOf(".");
    const mod = id.slice(0, dot);
    const name = id.slice(dot + 1);
    if (dot <= 0 || !IDENT.test(name) || !have.has(`modules/${mod}/${name}.ts`)) return [];
    return [{ id, name, from: mod === m ? `../${name}.ts` : `../../${mod}/${name}.ts` }];
  });
}

/** The E2003 message for input `n` of `s` (-1: the base). */
function unappliedText(s: Session, n: number, redirectedTo: string | null = null): string {
  if (n < 0)
    return redirectedTo === null
      ? `base route ${s.route.id} is not served`
      : `base route ${s.route.id} redirected to ${redirectedTo}`;
  const e = s.events[n];
  const what = e === undefined ? "" : e.kind === "nav" ? e.href : e.kind === "fire" ? e.id : "";
  return `input event ${n} (${e?.kind ?? "none"}) does not apply: ${what}`;
}

/**
 * `keel session replay|minimize|to-test <f>` (std.sessions Commands): parse `<f>` with `sessions.Session` (E2002),
 * find the deployable serving `route.id` in `topology.ts` (none: E2003 for the base), and run the op as a job under
 * the project's `keel test` (`runJob`), replaying with the serving modules' `redact` entries. `replay` reports E2003
 * (an input that does not apply, N from 0 over `events`) and E2004 (fingerprint differs) and one `session` record.
 * A `replay` file with a top-level `users` key is a `SessionGroup`: `groupDiags` reports E2007 and E2008 (std.multi) and
 * nothing replays; a valid group gets a summary that says it replays through `replayGroup`, exit 0.
 * `minimize` rewrites `<f>` with the 1-minimal session; `to-test` writes `test/session-<fingerprint>.test.ts` beside `topology.ts` for a page a `node` deployable serves,
 * `modules/<m>/test/session-<fingerprint>.test.ts` otherwise,
 * from the session redacted with the route module's `expose` entries. Both write nothing unless the session reproduces (E2004).
 */
export async function commandRun(
  op: Op,
  target: string,
  io: Io,
  maxRuns: number | undefined,
  user: string | undefined = undefined,
): Promise<Outcome> {
  const files = projectOf(io);
  const done = (
    records: OutRecord[],
    writes: Outcome["writes"] = [],
    failed = false,
    name = `session ${op}`,
  ): Outcome => {
    const ok = !failed && !records.some((r) => r.kind === "diag" && String(r.code).startsWith("E"));
    return { records: [...records, { kind: "summary", ok, name, counts: { sessions: 1 } }], writes };
  };
  const text = sourceOf(io, files, target);
  let raw: unknown;
  try {
    raw = text === undefined ? undefined : JSON.parse(text);
  } catch {
    raw = undefined;
  }
  if (raw === undefined)
    return done([sessionDiag("E2002", "session file fails sessions.Session at (root): not JSON", target)]);
  if (op === "replay" && text !== undefined && typeof raw === "object" && raw !== null && "users" in raw) {
    const { groupDiags } = await import("@keel/std-sessions/group");
    const found = groupDiags(text, target);
    if (found.length > 0) return done(found);
    return done([], [], false, "session replay: a group file replays through replayGroup");
  }
  const parsed = Session.parse(raw);
  if (!parsed.ok) {
    const issue = parsed.error.data.issues[0];
    const at = issue === undefined || issue.path.length === 0 ? "(root)" : issue.path.join(".");
    return done([
      sessionDiag("E2002", `session file fails sessions.Session at ${at}: ${String(issue?.rule ?? "invalid")}`, target),
    ]);
  }
  const session = parsed.value;
  const modules = servingModules(files, session.route.id);
  if (modules === undefined) return done([sessionDiag("E2003", unappliedText(session, -1), target)]);
  const m = session.route.id.split(".")[0] ?? "";
  const deployable = servingDeployable(files, session.route.id);
  // A `node` deployable serves the page: the job builds its app as the generated entry does (every placed module's
  // routes, the identity source). Any other adapter replays through the router.
  const placed = deployable?.adapter === "node" ? placedRoutes(io.cwd, files, deployable.modules) : [];
  const serve =
    deployable === undefined || deployable.adapter !== "node"
      ? undefined
      : { deployable: deployable.name, identity: files.some((f) => f.path === "identity.server.ts") };
  const hasIdentity = files.some((f) => f.path === "identity.ts");
  const job = await runJob(io, {
    op,
    session: Session.encode(session),
    modules,
    ...(serve === undefined
      ? {}
      : { serve: { ...serve, routes: placed.map((p) => (p.app ? `../../modules/${p.module}/routes.ts` : p.spec)) } }),
    ...(user === undefined ? {} : { user }),
    // Without `serve` the router form takes the project's identity mount, as the built entry does (k.guards Client).
    ...(serve === undefined && hasIdentity ? { mount: true } : {}),
    expose: op === "to-test" ? entriesOf(files, m, "expose") : [],
    redact: modules.flatMap((x) => entriesOf(files, x, "redact")),
    ...(maxRuns === undefined ? {} : { maxRuns }),
  });
  // No result: the job did not run (vitest `include` misses `.keel/sessions/`) or app code threw; the test run's
  // diagnostics say which, and the summary fails.
  if (!job.ok) return done(job.diags, [], true);
  const r = job.result;
  const diags: OutRecord[] = [];
  if (r.unapplied !== null && op !== "minimize")
    diags.push(sessionDiag("E2003", unappliedText(session, r.unapplied, r.redirectedTo), target));
  if (!r.reproduced)
    diags.push(sessionDiag("E2004", `replay fingerprint ${r.fingerprint} differs from ${session.fingerprint}`, target));
  const out = r.session;
  if (op === "replay" || out === null || diags.length > 0) return done([...diags, sessionOut(session, r.error, null)]);
  if (op === "minimize") {
    return done(
      [sessionOut(out, out.error?.code ?? null, target)],
      [{ path: target, content: sessionText(out), readonly: false }],
    );
  }
  const file =
    serve === undefined
      ? `modules/${m}/test/session-${out.fingerprint}.test.ts`
      : `test/session-${out.fingerprint}.test.ts`;
  // From `test/` the app's files are one folder up; from `modules/<m>/test/` the module's own are one up and the rest
  // two.
  const own = (name: string): string => (serve === undefined ? `../${name}` : `../modules/${m}/${name}`);
  const other = (id: string, name: string): string =>
    serve === undefined ? `../../${id}/${name}` : `../modules/${id}/${name}`;
  const source = toTest(out, {
    navs: r.navs,
    stores: storesOf(files, Object.keys(out.state), m),
    routes: (serve === undefined ? modules.map((x) => ({ module: x, app: true, spec: x, contract: "" })) : placed).map(
      (p) => ({
        module: p.module,
        from: !p.app ? p.spec : p.module === m ? own("routes.ts") : other(p.module, "routes.ts"),
        contract: !p.app
          ? p.contract
          : p.module === m
            ? own(`${p.module}.contract.ts`)
            : other(p.module, `${p.module}.contract.ts`),
      }),
    ),
    ...(serve === undefined
      ? {}
      : {
          serve: {
            deployable: serve.deployable,
            topology: "../topology.ts",
            ...(serve.identity ? { identity: "../identity.server.ts" } : {}),
          },
        }),
    ...(user === undefined ? {} : { user }),
    ...(serve === undefined && hasIdentity ? { mount: "../../../identity.ts" } : {}),
  });
  return done([sessionOut(out, out.error?.code ?? null, file)], [{ path: file, content: source, readonly: false }]);
}
