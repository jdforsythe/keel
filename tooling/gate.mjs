// `pnpm gate [<rev>]`: runs, on this machine, every job CI runs on a pull request that this machine can run, on one
// commit (default HEAD) checked out in the clean worktree `.worktrees/verify`, each step's command read from
// tooling/ci.source.json, so the gate and CI cannot drift. The job table, expressions and verdict are in
// tooling/gate-plan.mjs; docs/GATE.md says what runs, what is skipped and why.
// Usage: node tooling/gate.mjs [<rev>] [--scale <n>] [--with <job,...>] [--allow-skip <job,...>] [--only <job,...>]
//          [--fail-fast] [--quiet] [--max-load <n>] [--load-wait <minutes>] [--worktree <path>]
//          [--skip-slow] [--slow-cpus <n>] [--slow-memory <size>] [--slow-parallel <n>]
//        node tooling/gate.mjs --status [<rev>]
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {
  AGENT_VARS,
  actionOf,
  applyRewrites,
  badWith,
  downloadPatterns,
  expandSteps,
  expr,
  exprEnv,
  failLines,
  instances,
  nodeMajor,
  keepNodeModules,
  matchesPattern,
  planJobs,
  SLOW,
  SLOW_JOB,
  bindMounts,
  dockerProblem,
  resultPath,
  runsAfterFailure,
  slowContainer,
  slowEnv,
  slowExecArgs,
  slowParallel,
  slowRunArgs,
  slowSetupScript,
  slowShards,
  slowSteps,
  stepName,
  verdict,
  versionCheck,
  workspaceGlobs,
} from "./gate-plan.mjs";

const FORBIDDEN_PORTS = new Set([5173, 5214, 5432, 8080]);
const t0 = performance.now();
const say = (text) => fs.writeSync(1, `${text}\n`);
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- arguments ----
const argv = process.argv.slice(2);
const VALUE = new Set([
  "scale",
  "with",
  "allow-skip",
  "only",
  "max-load",
  "load-wait",
  "worktree",
  "format",
  "slow-cpus",
  "slow-memory",
  "slow-parallel",
]);
const flags = new Set();
const values = new Map();
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) positional.push(a);
  else if (a.includes("=")) values.set(a.slice(2, a.indexOf("=")), a.slice(a.indexOf("=") + 1));
  else if (VALUE.has(a.slice(2)) && argv[i + 1] !== undefined) values.set(a.slice(2), argv[++i]);
  else flags.add(a.slice(2));
}
const FLAGS = new Set(["status", "fail-fast", "quiet", "skip-slow"]);
const unknownFlags = [...flags].filter((f) => !FLAGS.has(f)).concat([...values.keys()].filter((k) => !VALUE.has(k)));
if (unknownFlags.length > 0) {
  fs.writeSync(1, `fail gate unknown flag --${unknownFlags.join(", --")}\n`);
  process.exit(2);
}
const list = (k) => new Set((values.get(k) ?? "").split(",").filter(Boolean));
const git = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8" });
const fail = (line) => {
  say(line);
  process.exit(1);
};

const here = process.cwd();
const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], here).stdout.trim();
if (common === "") fail("fail gate not inside a git repository");
// The main worktree: the outermost registered worktree that holds this one (a lane lives in its `.worktrees/`), or this
// one. The repository's first worktree may be elsewhere: the gate's checkout and results belong to this line of work.
const top = git(["rev-parse", "--show-toplevel"], here).stdout.trim();
const worktrees = git(["worktree", "list", "--porcelain"], here)
  .stdout.split("\n")
  .filter((l) => l.startsWith("worktree "))
  .map((l) => l.slice("worktree ".length));
const main = worktrees
  .filter((w) => top === w || top.startsWith(`${w}${path.sep}`))
  .reduce((a, w) => (w.length < a.length ? w : a), top);
const rev = positional[0] ?? "HEAD";
const sha = git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], here).stdout.trim();
if (sha === "") fail(`fail gate ${rev} is not a commit`);
const short = sha.slice(0, 12);

// ---- --status ----
if (flags.has("status")) {
  const file = resultPath(main, sha);
  if (!fs.existsSync(file)) fail(`fail gate-status ${short} not gated`);
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  if (r.partial === true) fail(`fail gate-status ${short} partial gate (${r.partialReason}): ${r.line}`);
  if (r.ok !== true) fail(`fail gate-status ${short} gated and failed: ${r.line}`);
  if (r.slowSkipped === true)
    fail(`fail gate-status ${short} not a whole pass: ${SLOW_JOB} skipped (--skip-slow): ${r.line}`);
  if (!(r.jobs ?? []).some((j) => j.name === SLOW_JOB && j.status === "ok"))
    fail(`fail gate-status ${short} not a whole pass: ${SLOW_JOB} did not run: ${r.line}`);
  say(`ok gate-status ${short} gated ${r.finished}: ${r.line}`);
  process.exit(0);
}

const withJobs = list("with");
const allowSkip = list("allow-skip");
const only = values.has("only") ? list("only") : undefined;
const scale = values.get("scale") ?? "0.1";
const maxLoad = Number(values.get("max-load") ?? 30);
const loadWaitMs = Number(values.get("load-wait") ?? 20) * 60_000;
const slowCpus = Number(values.get("slow-cpus") ?? SLOW.cpus);
const slowMemory = values.get("slow-memory") ?? SLOW.memory;
const slowParallelWanted = values.has("slow-parallel") ? Number(values.get("slow-parallel")) : undefined;
if (slowParallelWanted !== undefined && !(Number.isInteger(slowParallelWanted) && slowParallelWanted > 0))
  fail(`fail gate --slow-parallel ${values.get("slow-parallel")} is not a positive whole number`);
if (!(slowCpus > 0)) fail(`fail gate --slow-cpus ${values.get("slow-cpus")} is not a positive number`);
if (!/^\d+[bkmg]$/i.test(slowMemory)) fail(`fail gate --slow-memory ${slowMemory} is not a size such as 7700m`);
if (!(Number(scale) > 0)) fail(`fail gate --scale ${scale} is not a positive number`);
const bad = badWith(withJobs);
if (bad.length > 0) fail(`fail gate --with ${bad.join(",")}: not a job the gate runs behind a flag`);

// ---- the clean worktree ----
const verify = path.resolve(values.get("worktree") ?? path.join(main, ".worktrees", "verify"));
const registered = worktrees.includes(verify);
if (!registered) fail(`fail gate no worktree at ${verify}: git worktree add --detach ${verify}`);
const gitDir = git(["rev-parse", "--absolute-git-dir"], verify).stdout.trim();
const lock = path.join(gitDir, "keel-gate.lock");
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
if (fs.existsSync(lock)) {
  const pid = Number(fs.readFileSync(lock, "utf8"));
  if (Number.isInteger(pid) && alive(pid)) fail(`fail gate another gate (pid ${pid}) runs in ${verify}`);
}
const dirty = git(["status", "--porcelain", "--untracked-files=no"], verify).stdout.trim();
if (dirty !== "") fail(`fail gate ${verify} has tracked changes; it is the gate's clean checkout:\n${dirty}`);
fs.writeFileSync(lock, String(process.pid));
const co = git(["checkout", "-q", "--detach", sha], verify);
if (co.status !== 0) fail(`fail gate checkout ${short} in ${verify}: ${co.stderr.trim()}`);

const out = path.join(os.tmpdir(), `keel-gate-${short}`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const source = JSON.parse(fs.readFileSync(path.join(verify, "tooling/ci.source.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(verify, "package.json"), "utf8"));
const scaled = fs.existsSync(path.join(verify, "tooling/test-time.ts"));

// ---- what this gate started, removed at the end whatever happens ----
const groups = new Set();
const started = new Set();
const containers = new Set();
const docker = (args, opts = {}) => spawnSync("docker", args, { encoding: "utf8", timeout: 120_000, ...opts });

function killGroup(pid, signal) {
  for (const target of [-pid, pid])
    try {
      process.kill(target, signal);
    } catch {}
}

/** Stops every process group and container this gate started, then checks none is left. */
async function cleanup() {
  for (const pid of groups) killGroup(pid, "SIGTERM");
  const until = performance.now() + 5000;
  while ([...groups].some(alive) && performance.now() < until) await sleep(100);
  for (const pid of groups) killGroup(pid, "SIGKILL");
  for (const name of containers) docker(["rm", "-f", "-v", name]);
  await sleep(200);
  const left = [];
  for (const pid of started) if (alive(pid)) left.push(`process group ${pid}`);
  for (const name of containers)
    if (docker(["ps", "-aq", "--filter", `name=^/${name}$`]).stdout.trim() !== "") left.push(`container ${name}`);
  fs.rmSync(lock, { force: true });
  return left;
}

// ---- the executor: the host's bash ----
const bash = fs.existsSync("/opt/homebrew/bin/bash") ? "/opt/homebrew/bin/bash" : "bash";

/**
 * Runs `script` with bash as GitHub's runner does (`bash --noprofile --norc -eo pipefail`), its own process group,
 * output to `log`; resolves `{ code, timedOut }`.
 */
function runScript(script, { cwd, env, log, deadline }) {
  const fd = fs.openSync(log, "a");
  const file = `${log}.sh`;
  fs.writeFileSync(file, script);
  const child = spawn(bash, ["--noprofile", "--norc", "-eo", "pipefail", file], {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  if (child.pid !== undefined) {
    groups.add(child.pid);
    started.add(child.pid);
  }
  return new Promise((resolve) => {
    let timedOut = false;
    const timer = setTimeout(
      () => {
        timedOut = true;
        if (child.pid !== undefined) killGroup(child.pid, "SIGTERM");
        setTimeout(() => child.pid !== undefined && killGroup(child.pid, "SIGKILL"), 10_000).unref();
      },
      Math.max(1, deadline - Date.now()),
    );
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (child.pid !== undefined) groups.delete(child.pid);
      resolve({ code: code ?? (signal === null ? 1 : 128), timedOut });
    });
    child.on("error", () => resolve({ code: 127, timedOut }));
  });
}

const rootDir = verify;
const snapshot = path.join(out, "turbo-cache");
/** The artifacts a job uploads that a later job downloads, by name. */
const artifacts = path.join(out, "artifacts");
const wanted = downloadPatterns(source);
// A copy-on-write clone of the cache folder (APFS).
const copyTree = "cp -cR";
/** A runner's fresh checkout: the commit, no untracked or ignored file but the installed node_modules, no tool cache in them. */
const KEEP = keepNodeModules(workspaceGlobs(fs.readFileSync(path.join(verify, "pnpm-workspace.yaml"), "utf8")))
  .map((p) => `-e '${p}'`)
  .join(" ");
const RESET = [
  `git reset -q --hard ${sha}`,
  `git clean -ffdxq ${KEEP}`,
  "rm -rf node_modules/.vite node_modules/.cache */*/node_modules/.vite */*/node_modules/.cache",
].join("\n");

// ---- environment ----
const nodeDir = (() => {
  const major = nodeMajor(source);
  const have = spawnSync("node", ["--version"], { encoding: "utf8" }).stdout.trim();
  if (major === undefined || have.replace(/^v/, "").split(".")[0] === major) return undefined;
  // As actions/setup-node does: the newest installed release of the major the source pins.
  const nvm = path.join(process.env.NVM_DIR ?? path.join(os.homedir(), ".nvm"), "versions", "node");
  const found = fs.existsSync(nvm)
    ? fs
        .readdirSync(nvm)
        .filter((v) => v.startsWith(`v${major}.`))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    : [];
  return found.length > 0 ? path.join(nvm, found[0], "bin") : undefined;
})();

function baseEnv() {
  const env = { ...process.env };
  for (const k of [...AGENT_VARS, "KEEL_TEST_TIME_SCALE", "FORCE_COLOR"]) delete env[k];
  const cargo = path.join(os.homedir(), ".cargo", "bin");
  env.PATH = [nodeDir, fs.existsSync(cargo) ? cargo : undefined, env.PATH].filter(Boolean).join(path.delimiter);
  env.CI = "true";
  env.GITHUB_ACTIONS = "true";
  if (scaled) env.KEEL_TEST_TIME_SCALE = scale;
  return { ...env, ...exprEnv(source.env, {}) };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a !== null ? a.port : 0;
      s.close(() => (FORBIDDEN_PORTS.has(port) || port === 0 ? freePort().then(resolve, reject) : resolve(port)));
    });
  });
}

function requirement(tool, env) {
  if (tool === "docker")
    return docker(["info", "--format", "{{.ServerVersion}}"]).status === 0 || "docker is not running";
  if (tool === "registry") {
    const up = requirement("docker", env);
    if (up !== true) return up;
    // A pull asks the credential helper first; a locked one hangs every pull until the job's timeout.
    const config = path.join(env.DOCKER_CONFIG ?? path.join(os.homedir(), ".docker"), "config.json");
    const store = fs.existsSync(config) ? JSON.parse(fs.readFileSync(config, "utf8")).credsStore : undefined;
    if (typeof store !== "string") return true;
    const r = spawnSync(`docker-credential-${store}`, ["list"], {
      stdio: "ignore",
      timeout: 10_000,
      killSignal: "SIGKILL",
    });
    return r.status === 0 || `docker's credential helper (${store}) did not answer in 10s, so a pull would hang`;
  }
  if (tool === "xcode")
    return spawnSync("xcrun", ["simctl", "help"], { stdio: "ignore" }).status === 0 || "Xcode's simctl is not here";
  if (tool === "rustup")
    return spawnSync("rustup", ["--version"], { stdio: "ignore", env }).status === 0 || "rustup is not here";
  if (tool === "android") {
    const sdk = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, path.join(os.homedir(), "Library/Android/sdk")].find(
      (d) => d !== undefined && fs.existsSync(d),
    );
    if (sdk === undefined) return "no Android SDK (ANDROID_HOME)";
    env.ANDROID_HOME = sdk;
    return true;
  }
  return `unknown requirement ${tool}`;
}

/** JAVA_HOME of a JDK of `major`, as actions/setup-java sets it, or undefined. */
function javaHome(major) {
  const r = spawnSync("/usr/libexec/java_home", ["-v", String(major)], { encoding: "utf8" });
  if (r.status === 0 && r.stdout.trim() !== "") return r.stdout.trim();
  const jbr = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
  const release = path.join(jbr, "release");
  if (fs.existsSync(release) && fs.readFileSync(release, "utf8").includes(`JAVA_VERSION="${major}`)) return jbr;
  return undefined;
}

// ---- one step, one job ----
async function waitForLoad() {
  const until = Date.now() + loadWaitMs;
  while (os.loadavg()[0] > maxLoad && Date.now() < until) await sleep(15_000);
  return Number(os.loadavg()[0].toFixed(1));
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Runs one instance of a job from a fresh checkout; returns its record. */
async function runInstance(name, job, inst, rule, needs) {
  const start = performance.now();
  const deadline = Date.now() + (job["timeout-minutes"] ?? 360) * 60_000;
  const dir = path.join(out, slug(inst.label));
  fs.mkdirSync(dir, { recursive: true });
  const record = { label: inst.label, name, status: "ok", steps: [], seconds: 0, load: 0 };
  const ctx = {
    matrix: inst.matrix,
    workspace: rootDir,
    runnerOs: "macOS",
    runnerArch: os.arch() === "arm64" ? "ARM64" : "X64",
    needs,
  };
  const env = baseEnv();
  const temp = path.join(dir, "runner-temp");
  let steps = expandSteps(source, name);
  let jobEnv = job.env ?? {};
  try {
    const ports = {};
    for (const s of Object.values(rule.services ?? {})) ports[s.port] = await freePort();
    for (const r of rule.rewrites ?? [])
      for (const m of r.to.matchAll(/\{port:([\w-]+)\}/g)) ports[m[1]] ??= await freePort();
    if (rule.rewrites !== undefined) {
      const rewritten = applyRewrites(job, steps, rule.rewrites, ports);
      steps = rewritten.steps;
      jobEnv = rewritten.env;
    }
    Object.assign(env, exprEnv(jobEnv, ctx), { RUNNER_TEMP: temp });
    const reset = await runScript(`${RESET}\nmkdir -p ${JSON.stringify(temp)}`, {
      cwd: rootDir,
      env,
      log: path.join(dir, "00-reset.log"),
      deadline,
    });
    if (reset.code !== 0) throw new Error(`the fresh checkout failed: ${path.join(dir, "00-reset.log")}`);
    for (const c of [...Object.values(rule.services ?? {}).map((s) => s.container), ...(rule.containers ?? [])]) {
      containers.add(c);
      docker(["rm", "-f", "-v", c]);
    }
    for (const [svc, spec] of Object.entries(job.services ?? {})) {
      const mine = rule.services?.[svc];
      if (mine === undefined) throw new Error(`service ${svc} of ${name} has no container in the gate's table`);
      const options = String(spec.options ?? "");
      if (/["']/.test(options)) throw new Error(`service ${svc} options are quoted: decide how the gate passes them`);
      const inner = String(spec.ports?.[0] ?? "")
        .split(":")
        .at(-1);
      const r = docker([
        "run",
        "-d",
        "--name",
        mine.container,
        ...Object.entries(spec.env ?? {}).flatMap(([k, v]) => ["-e", `${k}=${expr(v, ctx)}`]),
        "-p",
        `127.0.0.1:${ports[mine.port]}:${inner}`,
        ...options.split(/\s+/).filter(Boolean),
        spec.image,
      ]);
      if (r.status !== 0) throw new Error(`service ${svc} did not start: ${r.stderr.trim()}`);
      const until = Date.now() + 120_000;
      let health = "";
      while (health !== "healthy" && Date.now() < until) {
        await sleep(1000);
        health = docker(["inspect", "-f", "{{.State.Health.Status}}", mine.container]).stdout.trim();
      }
      if (health !== "healthy") throw new Error(`service ${svc} not healthy after 120s`);
    }
    let failed = false;
    for (const [i, step] of steps.entries()) {
      const sname = stepName(step);
      const log = path.join(dir, `${String(i + 1).padStart(2, "0")}-${slug(sname)}.log`);
      if (failed && !runsAfterFailure(step)) {
        record.steps.push({ name: sname, status: "not-run" });
        continue;
      }
      const s0 = performance.now();
      const res = await runStep(step, { env, ctx, log, deadline });
      const lines = res.status === "ok" && fs.existsSync(log) ? failLines(fs.readFileSync(log, "utf8")) : [];
      const status = res.status === "ok" && lines.length === 0 ? "ok" : "fail";
      const entry = { name: sname, status, seconds: (performance.now() - s0) / 1000, log, ...res.detail };
      if (lines.length > 0) entry.failLines = lines;
      if (status === "fail" && entry.failLines === undefined && fs.existsSync(log))
        entry.failLines = failLines(fs.readFileSync(log, "utf8"));
      record.steps.push(entry);
      record.load = Math.max(record.load, res.detail?.load ?? 0);
      if (status === "fail") failed = true;
    }
    if (failed) record.status = "fail";
  } catch (e) {
    record.status = "fail";
    record.reason = e instanceof Error ? e.message : String(e);
  } finally {
    for (const c of [...Object.values(rule.services ?? {}).map((s) => s.container), ...(rule.containers ?? [])])
      docker(["rm", "-f", "-v", c]);
  }
  record.seconds = (performance.now() - start) / 1000;
  return record;
}

/** One step: a `run` through bash, or what the gate does for a known action. */
async function runStep(step, { env, ctx, log, deadline }) {
  if (step.shell !== undefined) throw new Error(`step shell "${step.shell}": decide in tooling/gate.mjs`);
  if (step.run !== undefined) {
    const load = await waitForLoad();
    const cwd = step["working-directory"] === undefined ? rootDir : path.join(rootDir, step["working-directory"]);
    const stepEnv = { ...env, ...exprEnv(step.env, ctx) };
    const r = await runScript(expr(step.run, ctx), { cwd, env: stepEnv, log, deadline });
    const detail = { load, exit: r.code, ...(r.timedOut ? { timedOut: true } : {}) };
    return { status: r.code === 0 && !r.timedOut ? "ok" : "fail", detail };
  }
  const kind = actionOf(step.uses ?? "");
  const p = expr(step.with?.path ?? "", ctx);
  const sh = async (script) => {
    const r = await runScript(script, { cwd: rootDir, env, log, deadline });
    return { status: r.code === 0 ? "ok" : "fail", detail: { exit: r.code } };
  };
  if (kind === "checkout" || kind === "pnpm" || kind === "node" || kind === "cache") return { status: "ok" };
  if (kind === "cache-save")
    return p === ".turbo/cache"
      ? sh(`rm -rf ${snapshot}\nif [ -d .turbo/cache ]; then ${copyTree} .turbo/cache ${snapshot}; fi`)
      : { status: "ok" };
  if (kind === "cache-restore")
    return p === ".turbo/cache"
      ? sh(
          `if [ -d ${snapshot} ]; then mkdir -p .turbo && rm -rf .turbo/cache && ${copyTree} ${snapshot} .turbo/cache; fi`,
        )
      : { status: "ok" };
  // Artifacts a later job downloads live under the run's folder: each job starts from a fresh tree, as on a runner.
  if (kind === "download") {
    const dest = JSON.stringify(p === "" ? "." : p);
    const pattern = String(step.with?.pattern ?? "");
    const names = fs.existsSync(artifacts) ? fs.readdirSync(artifacts).filter((n) => matchesPattern(n, pattern)) : [];
    return sh(
      names
        .map(
          (n) =>
            `mkdir -p ${dest}/${JSON.stringify(n)} && cp -R ${JSON.stringify(path.join(artifacts, n))}/. ${dest}/${JSON.stringify(n)}`,
        )
        .join("\n") || "true",
    );
  }
  if (kind === "artifact") {
    const files = p.split("\n").filter((f) => f !== "");
    const check = step.with?.["if-no-files-found"] === "error" ? files.map((f) => `test -e ${JSON.stringify(f)}`) : [];
    const name = expr(String(step.with?.name ?? ""), ctx);
    const keep = name !== "" && wanted.some((w) => matchesPattern(name, w));
    const copy = keep
      ? [
          `rm -rf ${JSON.stringify(path.join(artifacts, name))}`,
          `mkdir -p ${JSON.stringify(path.join(artifacts, name))}`,
          ...files.map((f) => `cp -R ${JSON.stringify(f)} ${JSON.stringify(path.join(artifacts, name))}/`),
        ]
      : [];
    return check.length + copy.length === 0 ? { status: "ok" } : sh([...check, ...copy].join("\n"));
  }
  if (kind === "java") {
    const major = String(step.with?.["java-version"] ?? "");
    const home = javaHome(major);
    if (home === undefined) {
      fs.writeFileSync(log, `no JDK ${major} here (actions/setup-java sets one up on the runner)\n`);
      return { status: "fail", detail: { want: `java ${major}` } };
    }
    env.JAVA_HOME = home;
    env.PATH = `${path.join(home, "bin")}${path.delimiter}${env.PATH}`;
    return { status: "ok" };
  }
  throw new Error(`unknown action ${step.uses}: decide in tooling/gate-plan.mjs`);
}

// ---- the slow-machine job: the test shards in a Linux container with constrained CPUs ----
const shq = (a) => `'${a.replaceAll("'", "'\\''")}'`;

/** A docker command bounded by `ms`; a failure or a hang throws a message that names the command. */
function dockerBounded(args, ms) {
  const r = docker(args, { timeout: ms, killSignal: "SIGKILL", maxBuffer: 64 * 2 ** 20 });
  const problem = dockerProblem(args, r, ms);
  if (problem !== undefined) throw new Error(problem);
  return r.stdout;
}

/** Runs every shard of the source's `test-shard` job in one `node:<major>` container from a clean clone of the commit. */
async function runSlow() {
  const major = nodeMajor(source) ?? "22";
  const image = `node:${major}`;
  const builtImage = `${slowContainer(short)}:built`;
  const name = slowContainer(short);
  const dir = path.join(out, "slow-shards");
  fs.mkdirSync(dir, { recursive: true });
  const clone = path.join(dir, "tree");
  const env = slowEnv(source);
  const shards = slowShards(source);
  const info = docker(["info", "--format", "{{.NCPU}} {{.MemTotal}}"]).stdout.trim().split(" ").map(Number);
  const parallel =
    slowParallelWanted ??
    slowParallel({
      machineCpus: info[0] ?? 0,
      machineMemory: info[1] ?? 0,
      cpus: slowCpus,
      memory: slowMemory,
    });
  const note = `${slowCpus} cpus, ${slowMemory}${parallel > 1 ? `, ${parallel} shards at once` : ""}`;
  const make = (label, extra = {}) => ({
    label,
    name: SLOW_JOB,
    status: "ok",
    steps: [],
    seconds: 0,
    load: 0,
    note,
    ...extra,
  });
  const prep = make(SLOW_JOB);
  const results = [];
  const t = performance.now();
  const exec = async (container, record, label, script, stepEnv, deadline, index) => {
    const log = path.join(dir, `${String(index).padStart(3, "0")}-${slug(label)}.log`);
    const s0 = performance.now();
    const load = await waitForLoad();
    const args = slowExecArgs(container, { ...env, ...stepEnv }, script);
    const r = await runScript(`exec docker ${args.map(shq).join(" ")}`, {
      cwd: rootDir,
      env: baseEnv(),
      log,
      deadline,
    });
    const lines = r.code === 0 && fs.existsSync(log) ? failLines(fs.readFileSync(log, "utf8")) : [];
    const status = r.code === 0 && !r.timedOut && lines.length === 0 ? "ok" : "fail";
    const entry = { name: label, status, seconds: (performance.now() - s0) / 1000, log, load, exit: r.code };
    if (r.timedOut) entry.timedOut = true;
    if (status === "fail" && fs.existsSync(log)) entry.failLines = failLines(fs.readFileSync(log, "utf8"));
    record.steps.push(entry);
    record.load = Math.max(record.load, load);
    if (status === "fail") record.status = "fail";
    return status === "ok";
  };
  // One shard in a container of its own: the job's `timeout-minutes` to itself, as on a runner of its own.
  const shardMs = (source.jobs["test-shard"]["timeout-minutes"] ?? 35) * 60_000;
  const runShard = async (container, shard) => {
    const rec = make(`${SLOW_JOB} ${shard}`);
    const s0 = performance.now();
    let good = true;
    let i = shard * 100;
    for (const step of slowSteps(source, shard).steps) {
      if (!good) break;
      good = await exec(container, rec, step.name, step.run, step.env, Date.now() + shardMs, i++);
    }
    rec.seconds = (performance.now() - s0) / 1000;
    return rec;
  };
  try {
    const have =
      spawnSync("docker", ["image", "inspect", image], { stdio: "ignore", timeout: SLOW.limits.short }).status === 0;
    if (!have) dockerBounded(["pull", "-q", image], SLOW.limits.pull);
    // The tree: a clean clone under the gate's own folder, copied in; nothing under the checkouts is mounted.
    fs.rmSync(clone, { recursive: true, force: true });
    for (const args of [
      ["clone", "-q", "--no-local", common, clone],
      ["-C", clone, "checkout", "-q", "--detach", sha],
    ]) {
      const r = spawnSync("git", args, { encoding: "utf8", timeout: 600_000 });
      if (r.status !== 0)
        throw new Error(
          `git ${args.includes("checkout") ? "checkout" : "clone"} of the clean clone failed: ${r.stderr.trim()}`,
        );
    }
    containers.add(name);
    docker(["rm", "-f", "-v", name]);
    const runArgs = slowRunArgs({ name, image, cpus: slowCpus, memory: slowMemory });
    const mounts = bindMounts(runArgs);
    if (mounts.length > 0) throw new Error(`the slow container would bind-mount ${mounts.join(", ")}`);
    dockerBounded(runArgs, SLOW.limits.short);
    dockerBounded(["exec", "-u", "0", name, "mkdir", "-p", SLOW.workdir], SLOW.limits.short);
    dockerBounded(["cp", `${clone}${path.sep}.`, `${name}:${SLOW.workdir}`], SLOW.limits.copy);
    fs.rmSync(clone, { recursive: true, force: true });
    dockerBounded(["exec", "-u", "0", name, "bash", "-c", slowSetupScript], SLOW.limits.pull);
    const first = slowSteps(source, shards[0] ?? 1);
    let i = 1;
    let ok = await exec(name, prep, "pnpm version", "pnpm --version", {}, Date.now() + 600_000, i++);
    for (const step of first.install)
      ok = ok && (await exec(name, prep, step.name, step.run, step.env, Date.now() + 1_800_000, i++));
    // The builds CI's check job leaves in the turbo cache, outside the shards' times.
    ok = ok && (await exec(name, prep, "pnpm build", "pnpm build", {}, Date.now() + 3_600_000, i++));
    prep.seconds = (performance.now() - t) / 1000;
    results.push(prep);
    if (!ok) {
      for (const shard of shards)
        results.push(make(`${SLOW_JOB} ${shard}`, { status: "not-run", reason: "the container's setup failed" }));
    } else if (parallel <= 1) {
      // One after another in the prepared container; a step cut off at its time may still run in it, so the rest wait.
      for (const shard of shards) {
        const rec = await runShard(name, shard);
        results.push(rec);
        if (rec.steps.some((st) => st.timedOut)) {
          for (const n of shards.slice(shards.indexOf(shard) + 1))
            results.push(make(`${SLOW_JOB} ${n}`, { status: "not-run", reason: "after a shard timed out" }));
          break;
        }
      }
    } else {
      // The built tree is reused: one image from the prepared container, and each shard in a container of its own,
      // `parallel` at a time, each with the job's cpus and memory.
      dockerBounded(["commit", name, builtImage], SLOW.limits.copy);
      docker(["rm", "-f", "-v", name]);
      const queue = [...shards];
      const done = new Map();
      const worker = async () => {
        for (let shard = queue.shift(); shard !== undefined; shard = queue.shift()) {
          const mine = slowContainer(short, shard);
          containers.add(mine);
          docker(["rm", "-f", "-v", mine]);
          try {
            dockerBounded(
              slowRunArgs({ name: mine, image: builtImage, cpus: slowCpus, memory: slowMemory }),
              SLOW.limits.short,
            );
            done.set(shard, await runShard(mine, shard));
          } catch (e) {
            done.set(
              shard,
              make(`${SLOW_JOB} ${shard}`, { status: "fail", reason: e instanceof Error ? e.message : String(e) }),
            );
          } finally {
            docker(["rm", "-f", "-v", mine]);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(parallel, shards.length) }, worker));
      for (const shard of shards) results.push(done.get(shard) ?? make(`${SLOW_JOB} ${shard}`, { status: "not-run" }));
    }
  } catch (e) {
    prep.status = "fail";
    prep.reason = e instanceof Error ? e.message : String(e);
    prep.seconds = (performance.now() - t) / 1000;
    if (!results.includes(prep)) results.unshift(prep);
  } finally {
    docker(["rm", "-f", "-v", name]);
    docker(["image", "rm", "-f", builtImage]);
    fs.rmSync(clone, { recursive: true, force: true });
  }
  return results;
}

// ---- the run ----
let interrupted = false;
const records = [];

async function finish(extra = []) {
  const left = await cleanup();
  const ran = records.filter((r) => r.status === "ok" || r.status === "fail").length;
  const skipped = records.filter((r) => r.status === "skip").length;
  const v = verdict(records, allowSkip);
  const problems = [...extra, ...left.map((l) => `cleanup left ${l}`)];
  const ok = v.ok && problems.length === 0 && !interrupted;
  const scaleText = scaled ? `scale ${scale}` : "no time scale on this commit";
  const tools = records.tools ?? "";
  const first = v.first ?? problems[0] ?? (interrupted ? "interrupted" : "");
  const slowSkipped = records.some((r) => r.name === SLOW_JOB && r.explicit === true);
  const slowText = slowSkipped ? `, ${SLOW_JOB} skipped (--skip-slow)` : "";
  const partial = only !== undefined ? `, partial (--only ${[...only].join(",")})` : "";
  const counts = ok
    ? `${ran} jobs, ${skipped} skipped, ${scaleText}${tools}${partial}${slowText}`
    : `${v.failed} failed of ${ran + records.filter((r) => r.status === "not-run").length}, ${skipped} skipped, ${scaleText}${tools}${partial}${slowText} first: ${first}`;
  const line = `${ok ? "ok" : "fail"} gate ${short} ${counts} (${secs(performance.now() - t0)})`;
  for (const p of problems) say(`fail gate ${p}`);
  say(line);
  const result = {
    sha,
    ok,
    line,
    slowSkipped,
    partial: only !== undefined,
    partialReason: only !== undefined ? `--only ${[...only].join(",")}` : undefined,
    scale: scaled ? Number(scale) : null,
    with: [...withJobs],
    allowSkip: [...allowSkip],
    logs: out,
    finished: new Date().toISOString(),
    jobs: records,
  };
  fs.mkdirSync(path.dirname(resultPath(main, sha)), { recursive: true });
  fs.writeFileSync(resultPath(main, sha), `${JSON.stringify(result, null, 2)}\n`);
  process.exit(ok ? 0 : 1);
}

/** A job's line, unless --quiet asks for the last line only. */
const sayJob = (r) => {
  if (!flags.has("quiet")) say(jobLine(r));
};

function jobLine(r) {
  if (r.status === "skip") return `skip ${r.label}: ${r.reason}`;
  if (r.status === "not-run")
    return `not-run ${r.label}: ${r.reason}${allowSkip.has(r.name) ? " (allowed)" : ` (--allow-skip ${r.name})`}`;
  const load = `${r.note === undefined ? "" : `, ${r.note}`}${r.load > 0 ? `, load ${r.load}` : ""}`;
  if (r.status === "ok") return `ok ${r.label} ${r.seconds.toFixed(1)}s${load}`;
  const step = r.steps.find((s) => s.status === "fail");
  const lines = [`fail ${r.label} ${r.seconds.toFixed(1)}s${load}: ${step?.name ?? r.reason ?? "failed"}`];
  if (step !== undefined) {
    lines.push(`  ${step.timedOut ? "timed out at the job's timeout-minutes" : `exit ${step.exit ?? "-"}`}`);
    for (const l of (step.failLines ?? []).slice(0, 5)) lines.push(`  ${l}`);
    if ((step.failLines ?? []).length > 5) lines.push(`  ... +${step.failLines.length - 5} more fail lines`);
    if (step.log !== undefined) lines.push(`  log: ${step.log}`);
  }
  return lines.join("\n");
}

for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    interrupted = true;
    void finish([`interrupted by ${signal}`]);
  });

try {
  const plan = planJobs(source, { with: withJobs, only, slow: { skip: flags.has("skip-slow") } });
  if (plan.unknown.length > 0) {
    for (const u of plan.unknown) say(`E0013 tooling/ci.source.json unknown job: decide (${u})`);
    await finish([`unknown job ${plan.unknown.join(", ")}: name it in the JOBS table of tooling/gate-plan.mjs`]);
  }
  // The versions the steps see, against what the source's setup pins.
  const probeLog = path.join(out, "versions.log");
  const probe = await runScript("node --version\npnpm --version", {
    cwd: rootDir,
    env: baseEnv(),
    log: probeLog,
    deadline: Date.now() + 300_000,
  });
  const [node = "", pnpm = ""] = fs
    .readFileSync(probeLog, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^v?\d+\.\d+\.\d+/.test(l));
  const mismatch = probe.code === 0 ? versionCheck(source, packageJson, { node, pnpm }) : [];
  if (probe.code !== 0) await finish([`node or pnpm did not answer: ${probeLog}`]);
  if (mismatch.length > 0)
    await finish(
      mismatch.map(
        (m) =>
          `${m.tool} ${m.found} here, the CI source pins ${m.want}${m.tool === "node" ? ` (no installed node ${m.want} found under ~/.nvm)` : ""}`,
      ),
    );
  records.tools = `, node ${node}${nodeDir === undefined ? "" : " (nvm)"}, pnpm ${pnpm}`;
  const needs = {};
  for (const p of plan.jobs) {
    const job = source.jobs[p.name];
    if (p.decision === "skip") {
      const r = {
        label: p.name,
        name: p.name,
        status: "skip",
        reason: p.reason,
        ...(p.explicit === true ? { explicit: true } : {}),
      };
      records.push(r);
      needs[p.name] = "skipped";
      sayJob(r);
      continue;
    }
    if (flags.has("fail-fast") && records.some((r) => r.status === "fail")) {
      const r = { label: p.name, name: p.name, status: "not-run", reason: "after a failure (--fail-fast)" };
      records.push(r);
      needs[p.name] = "skipped";
      sayJob(r);
      continue;
    }
    const env = baseEnv();
    const met = p.rule.requires === undefined ? true : requirement(p.rule.requires, env);
    if (met !== true) {
      const r = { label: p.name, name: p.name, status: "not-run", reason: met };
      records.push(r);
      needs[p.name] = "skipped";
      sayJob(r);
      continue;
    }
    if (p.name === SLOW_JOB) {
      for (const r of await runSlow()) {
        records.push(r);
        sayJob(r);
      }
      continue;
    }
    let all = true;
    for (const inst of instances(p.name, job)) {
      const r = await runInstance(p.name, job, inst, p.rule, { ...needs });
      records.push(r);
      sayJob(r);
      if (r.status !== "ok") all = false;
    }
    needs[p.name] = all ? "success" : "failure";
  }
  await finish();
} catch (e) {
  await finish([e instanceof Error ? e.message : String(e)]);
}
