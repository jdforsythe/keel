// What `pnpm gate` (tooling/gate.mjs) runs, read from tooling/ci.source.json: the job table, the order, the steps
// with `$setup` expanded, the `${{ }}` expressions it can answer, the declared rewrites, the version check, the scan
// for `fail ` lines and the verdict. Pure: no process, file or network here, so the tests drive it with a fixture.
import path from "node:path";

/**
 * Every job of the CI source, by name, with what the gate does with it. `run`: runs on every gate. `skip`: the reason
 * it does not; `flag`: `--with <job>` runs it here. `requires`: a tool the job needs on this machine; without it the
 * job is NOT RUN and fails the verdict unless `--allow-skip <job>`. `services`: for each of the job's services, the
 * container the gate starts and the name of the free port its first container port is published on. `containers`: containers a step starts, removed at the end. `rewrites`: text replaced in the job's
 * commands and environment before it runs (`{port:<name>}` is a free port the gate picks for that name); each must
 * match the source at least once, so a changed command fails the gate instead of running unrewritten. `linux`: the
 * job runs under `--linux`. A job of the source that is not here fails the gate: a new CI job is decided here first.
 */
export const JOBS = {
  check: { run: true, linux: true },
  "test-shard": { run: true, linux: true },
  test: { run: true, linux: true },
  postgres: {
    run: true,
    requires: "docker",
    services: { postgres: { container: "keel-gate-pg", port: "pg" } },
    containers: ["keel-gate-pg-ssl"],
    rewrites: [
      { from: "127.0.0.1:5432/", to: "127.0.0.1:{port:pg}/" },
      { from: "--name pg-tls", to: "--name keel-gate-pg-ssl" },
      { from: "docker exec pg-tls", to: "docker exec keel-gate-pg-ssl" },
      { from: "-p 5433:5432", to: "-p 127.0.0.1:{port:pg-ssl}:5432" },
      { from: "127.0.0.1:5433/", to: "127.0.0.1:{port:pg-ssl}/" },
    ],
  },
  "built-smokes": { run: true },
  build: { run: true },
  budgets: { run: true },
  "golden-1-images": { run: true, requires: "registry" },
  changes: {
    skip: "decides only whether the shell jobs run on a pull request; the gate names its shell jobs itself",
  },
  "shell-tauri": {
    skip: "Ubuntu only: WebKitGTK, WebKitWebDriver and Xvfb; tauri-driver has no WebDriver for macOS",
  },
  "shell-android": {
    skip: "builds the Android APK with Gradle, minutes of a Java toolchain on every gate",
    flag: true,
    requires: "android",
  },
  "shell-tauri-macos": {
    skip: "compiles the Tauri shell with Rust and drives it through the accessibility API",
    flag: true,
    requires: "rustup",
  },
  "shell-ios": {
    skip: "builds with xcodebuild and boots an iOS Simulator",
    flag: true,
    requires: "xcode",
  },
  "mutate-pr": {
    skip: "runs only on a pull request labelled mutate (pnpm mutate:changed is the same run)",
    flag: true,
  },
  eval: { skip: "runs only on the weekly schedule", flag: true },
};

/** The actions a step may use, by name without its version; any other fails the gate. */
export const ACTIONS = {
  "actions/checkout": "checkout",
  "pnpm/action-setup": "pnpm",
  "actions/setup-node": "node",
  "actions/setup-java": "java",
  "actions/cache": "cache",
  "actions/cache/save": "cache-save",
  "actions/cache/restore": "cache-restore",
  "actions/upload-artifact": "artifact",
};

/** Variables that tell a tool an agent is driving it (std-env's agent list, which vitest reads): CI has none. */
export const AGENT_VARS = [
  "AI_AGENT",
  "AUGMENT_AGENT",
  "CLAUDECODE",
  "CLAUDE_CODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CODEX_SANDBOX",
  "CODEX_THREAD_ID",
  "COPILOT_AGENT",
  "COPILOT_CLI",
  "CURSOR_AGENT",
  "GEMINI_CLI",
  "GOOSE_PROVIDER",
  "JUNIE_DATA",
  "JUNIE_SHIM_PATH",
  "OPENCODE",
  "REPL_ID",
];

/** The action kind of a `uses:` value (`owner/repo[/path]@ref # vX`), or undefined for one the gate does not know. */
export function actionOf(uses) {
  const name = String(uses).split("@")[0];
  return Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined;
}

/** A job's steps with each `"$setup"` expanded to the source's `setup` steps, as tooling/generate.mjs does. */
export function expandSteps(source, name) {
  const setup = source.setup ?? [];
  return source.jobs[name].steps.flatMap((s) => (s === "$setup" ? setup : [s]));
}

const needsOf = (job) => (job.needs === undefined ? [] : Array.isArray(job.needs) ? job.needs : [job.needs]);

/**
 * The gate's plan: every job of the source in an order that keeps `needs` (source order among equals), each with
 * `run` or `skip` and why. `unknown` lists jobs the table does not name.
 * @param {{ jobs: Record<string, { needs?: string | string[] }> }} source
 * @param {{ with?: Set<string>, only?: Set<string>, linux?: boolean, table?: Record<string, object> }} opts
 */
export function planJobs(source, opts = {}) {
  const table = opts.table ?? JOBS;
  const names = Object.keys(source.jobs);
  const unknown = names.filter((n) => !Object.hasOwn(table, n));
  const order = [];
  const placed = new Set();
  while (order.length < names.length) {
    const next = names.find((n) => !placed.has(n) && needsOf(source.jobs[n]).every((d) => placed.has(d)));
    if (next === undefined) throw new Error(`the needs of ${names.filter((n) => !placed.has(n)).join(", ")} loop`);
    placed.add(next);
    order.push(next);
  }
  const jobs = order.map((name) => {
    const rule = table[name];
    if (rule === undefined) return { name, decision: "unknown", reason: "unknown job: decide" };
    const wanted = rule.run === true || (rule.flag === true && (opts.with?.has(name) ?? false));
    if (!wanted) {
      const how = rule.flag === true ? ` (--with ${name})` : "";
      return { name, decision: "skip", reason: `${rule.skip ?? "not run here"}${how}`, rule };
    }
    if (opts.linux === true && rule.linux !== true)
      return { name, decision: "skip", reason: "--linux runs check and test-shard", rule };
    if (opts.only !== undefined && !opts.only.has(name))
      return { name, decision: "skip", reason: "not in --only", rule };
    return { name, decision: "run", rule };
  });
  return { jobs, unknown };
}

/** The `--with` names that are not a flag-runnable job of the table. */
export function badWith(names, table = JOBS) {
  return [...names].filter((n) => table[n]?.flag !== true);
}

/** A job's matrix instances: one per combination, each with its label (`test-shard 3`) and values. */
export function instances(name, job) {
  const matrix = job.strategy?.matrix;
  if (matrix === undefined) return [{ label: name, matrix: {} }];
  let combos = [{}];
  for (const [k, values] of Object.entries(matrix))
    combos = combos.flatMap((c) => values.map((v) => ({ ...c, [k]: v })));
  return combos.map((m) => ({ label: [name, ...Object.values(m)].join(" "), matrix: m }));
}

/**
 * `text` with each `${{ expression }}` answered from `ctx`: `matrix.<k>`, `secrets.<k>` and `vars.<k>` (empty: no
 * secret or variable reaches a local run), `github.workspace`, `runner.os`, `runner.arch`, `needs.<job>.result`.
 * Any other expression throws, so a new one is decided here before the gate runs it.
 */
export function expr(text, ctx) {
  return String(text).replace(/\$\{\{\s*(.*?)\s*\}\}/g, (_, e) => {
    let m = /^matrix\.([\w-]+)$/.exec(e);
    if (m !== null && Object.hasOwn(ctx.matrix ?? {}, m[1])) return String(ctx.matrix[m[1]]);
    if (/^(secrets|vars)\.[\w-]+$/.test(e)) return "";
    if (e === "github.workspace" && ctx.workspace !== undefined) return ctx.workspace;
    if (e === "runner.os") return ctx.runnerOs ?? "";
    if (e === "runner.arch") return ctx.runnerArch ?? "";
    m = /^needs\.([\w-]+)\.result$/.exec(e);
    if (m !== null && Object.hasOwn(ctx.needs ?? {}, m[1])) return ctx.needs[m[1]];
    throw new Error(`unknown expression \${{ ${e} }}: decide in tooling/gate-plan.mjs`);
  });
}

/** Each value of an `env` map through `expr`. */
export function exprEnv(env, ctx) {
  return Object.fromEntries(Object.entries(env ?? {}).map(([k, v]) => [k, expr(v, ctx)]));
}

/** Whether a step runs after an earlier one failed: `always()` does; no `if` does not; any other `if` throws. */
export function runsAfterFailure(step) {
  if (step.if === undefined) return false;
  if (String(step.if).trim() === "always()") return true;
  throw new Error(`unknown step condition "${step.if}": decide in tooling/gate-plan.mjs`);
}

/**
 * The job with its rewrites applied to every step's `run`, `env` and `with`, the job's `env` and its services' `env`.
 * `ports` answers `{port:<name>}`. Throws when a rewrite matches nothing: the source changed under it.
 */
export function applyRewrites(job, steps, rewrites, ports) {
  const fill = (s) => s.replace(/\{port:([\w-]+)\}/g, (_, n) => String(ports[n]));
  const hits = new Map(rewrites.map((r) => [r.from, 0]));
  const text = (s) => {
    let out = s;
    for (const r of rewrites) {
      const parts = out.split(r.from);
      hits.set(r.from, (hits.get(r.from) ?? 0) + parts.length - 1);
      out = parts.join(fill(r.to));
    }
    return out;
  };
  const deep = (v) =>
    typeof v === "string"
      ? text(v)
      : Array.isArray(v)
        ? v.map(deep)
        : typeof v === "object" && v !== null
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))
          : v;
  const out = { env: deep(job.env ?? {}), steps: steps.map(deep) };
  const missed = [...hits].filter(([, n]) => n === 0).map(([from]) => from);
  if (missed.length > 0) throw new Error(`rewrite "${missed.join('", "')}" matches nothing in the source: decide`);
  return out;
}

/** The lines of a step's output that start `fail ` (ANSI colour removed): a step that prints one has failed. */
export function failLines(output) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the ESC of an ANSI colour code
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  return plain.split("\n").filter((l) => /^fail /.test(l.replace(/\r$/, "")));
}

/**
 * The tool versions the source's setup pins against those found: `node` from `actions/setup-node`'s `node-version`
 * (a major alone matches any release of it), `pnpm` from `pnpm/action-setup`'s `version` or else the root
 * `packageManager` pin. Each mismatch names both versions.
 */
export function versionCheck(source, packageJson, found) {
  const out = [];
  for (const step of source.setup ?? []) {
    if (typeof step !== "object" || step.uses === undefined) continue;
    const kind = actionOf(step.uses);
    if (kind === "node") {
      const want = String(step.with?.["node-version"] ?? "");
      const have = found.node.replace(/^v/, "");
      const ok = /^\d+$/.test(want) ? have.split(".")[0] === want : have === want.replace(/^v/, "");
      if (!ok) out.push({ tool: "node", want, found: have });
    }
    if (kind === "pnpm") {
      const pin = /^pnpm@([^+]+)/.exec(packageJson.packageManager ?? "")?.[1];
      const want = String(step.with?.version ?? pin ?? "");
      if (want !== found.pnpm) out.push({ tool: "pnpm", want, found: found.pnpm });
    }
  }
  return out;
}

/** The node major the source's setup asks for, or undefined. */
export function nodeMajor(source) {
  for (const step of source.setup ?? [])
    if (typeof step === "object" && actionOf(step.uses ?? "") === "node") {
      const m = /^(\d+)/.exec(String(step.with?.["node-version"] ?? ""));
      if (m !== null) return m[1];
    }
  return undefined;
}

/** A step's name for the summary: its `name`, else the first line of its `run`, else its action. */
export function stepName(step) {
  const raw = step.name ?? String(step.run ?? step.uses ?? "step").split("\n")[0];
  return raw.length > 60 ? `${raw.slice(0, 57)}...` : raw;
}

/**
 * The verdict: ok when no job failed and every job that was to run ran, or was allowed to be skipped. `first` is the
 * first failure, `job/step`.
 * @param {Array<{ label: string, name: string, status: string, steps?: Array<{ name: string, status: string }> }>} jobs
 * @param {Set<string>} allowSkip
 */
export function verdict(jobs, allowSkip = new Set()) {
  const failed = jobs.filter((j) => j.status === "fail" || (j.status === "not-run" && !allowSkip.has(j.name)));
  const first = failed[0];
  const step = first?.steps?.find((s) => s.status === "fail");
  return {
    ok: failed.length === 0,
    failed: failed.length,
    first: first === undefined ? undefined : `${first.label}/${step?.name ?? first.reason ?? first.status}`,
  };
}

/** The result file of a gated commit, under the main worktree's `.keel-gate/`. */
export const resultPath = (main, sha) => path.join(main, ".keel-gate", `${sha}.json`);
