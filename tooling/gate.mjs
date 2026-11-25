// `pnpm gate [<rev>]`: runs, on this machine, every job CI runs on a pull request that this machine can run, on one
// commit (default HEAD) checked out in the clean worktree `.worktrees/verify`, each step's command read from
// tooling/ci.source.json, so the gate and CI cannot drift. The job table, expressions and verdict are in
// tooling/gate-plan.mjs; docs/GATE.md says what runs, what is skipped and why.
// Usage: node tooling/gate.mjs [<rev>] [--scale <n>] [--with <job,...>] [--allow-skip <job,...>] [--only <job,...>]
//          [--fail-fast] [--max-load <n>] [--load-wait <minutes>] [--worktree <path>] [--linux]
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
  expandSteps,
  expr,
  exprEnv,
  failLines,
  instances,
  nodeMajor,
  planJobs,
  resultPath,
  runsAfterFailure,
  stepName,
  verdict,
  versionCheck,
} from "./gate-plan.mjs";

const FORBIDDEN_PORTS = new Set([5173, 5214, 5432, 8080]);
const LINUX = "keel-gate-linux";
const LINUX_ROOT = "/work";
const t0 = performance.now();
const say = (text) => fs.writeSync(1, `${text}\n`);
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- arguments ----
const argv = process.argv.slice(2);
const VALUE = new Set(["scale", "with", "allow-skip", "only", "max-load", "load-wait", "worktree", "format"]);
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
const list = (k) => new Set((values.get(k) ?? "").split(",").filter(Boolean));
const git = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8" });
const fail = (line) => {
  say(line);
  process.exit(1);
};

const here = process.cwd();
const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], here).stdout.trim();
if (common === "") fail("fail gate not inside a git repository");
const main = path.dirname(common);
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
  say(`ok gate-status ${short} gated ${r.finished}: ${r.line}`);
  process.exit(0);
}

const linux = flags.has("linux");
const withJobs = list("with");
const allowSkip = list("allow-skip");
const only = values.has("only") ? list("only") : undefined;
const scale = values.get("scale") ?? "0.1";
const maxLoad = Number(values.get("max-load") ?? 30);
const loadWaitMs = Number(values.get("load-wait") ?? 20) * 60_000;
if (!(Number(scale) > 0)) fail(`fail gate --scale ${scale} is not a positive number`);
const bad = badWith(withJobs);
if (bad.length > 0) fail(`fail gate --with ${bad.join(",")}: not a job the gate runs behind a flag`);

// ---- the clean worktree ----
const verify = path.resolve(values.get("worktree") ?? path.join(main, ".worktrees", "verify"));
const registered = git(["worktree", "list", "--porcelain"], here)
  .stdout.split("\n")
  .some((l) => l === `worktree ${verify}`);
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

// ---- executors: the host's bash, or bash in a Linux container ----
const bash = fs.existsSync("/opt/homebrew/bin/bash") ? "/opt/homebrew/bin/bash" : "bash";

/**
 * Runs `script` with bash as GitHub's runner does (`bash --noprofile --norc -eo pipefail`), its own process group,
 * output to `log`; resolves `{ code, timedOut }`.
 */
function runScript(script, { cwd, env, log, deadline }) {
  const fd = fs.openSync(log, "a");
  const file = `${log}.sh`;
  fs.writeFileSync(file, script);
  const child = linux
    ? spawn(
        "docker",
        [
          "exec",
          "-w",
          cwd,
          ...Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
          LINUX,
          "bash",
          "--noprofile",
          "--norc",
          "-eo",
          "pipefail",
          "-c",
          script,
        ],
        { detached: true, stdio: ["ignore", fd, fd] },
      )
    : spawn(bash, ["--noprofile", "--norc", "-eo", "pipefail", file], {
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

const rootDir = linux ? LINUX_ROOT : verify;
const snapshot = linux ? "/tmp/keel-gate-turbo-cache" : path.join(out, "turbo-cache");
const copyTree = linux ? "cp -a" : "cp -cR";
/** A runner's fresh checkout: the commit, no untracked or ignored file but node_modules, no tool cache in them. */
const RESET = [
  `git reset -q --hard ${sha}`,
  "git clean -ffdxq -e node_modules",
  "rm -rf node_modules/.vite node_modules/.cache */*/node_modules/.vite */*/node_modules/.cache",
].join("\n");

// ---- environment ----
const nodeDir = (() => {
  if (linux) return undefined;
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
  const env = linux ? { HOME: "/root", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" } : { ...process.env };
  for (const k of [...AGENT_VARS, "KEEL_TEST_TIME_SCALE", "FORCE_COLOR"]) delete env[k];
  if (!linux) {
    const cargo = path.join(os.homedir(), ".cargo", "bin");
    env.PATH = [nodeDir, fs.existsSync(cargo) ? cargo : undefined, env.PATH].filter(Boolean).join(path.delimiter);
  }
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
    runnerOs: linux ? "Linux" : "macOS",
    runnerArch: os.arch() === "arm64" ? "ARM64" : "X64",
    needs,
  };
  const env = baseEnv();
  const temp = linux ? `/tmp/runner-temp-${slug(inst.label)}` : path.join(dir, "runner-temp");
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
    const reset = await runScript(`${RESET}\n${linux ? `rm -rf ${temp}; ` : ""}mkdir -p ${JSON.stringify(temp)}`, {
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
  if (kind === "artifact") {
    if (step.with?.["if-no-files-found"] !== "error") return { status: "ok" };
    return sh(
      p
        .split("\n")
        .map((f) => `test -e ${JSON.stringify(f)}`)
        .join("\n"),
    );
  }
  if (kind === "java") {
    const major = String(step.with?.["java-version"] ?? "");
    const home = linux ? undefined : javaHome(major);
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

// ---- the Linux container ----
async function startLinux(major) {
  containers.add(LINUX);
  docker(["rm", "-f", "-v", LINUX]);
  const image = `node:${major}`;
  const r = docker(
    [
      "run",
      "-d",
      "--name",
      LINUX,
      "--cpus",
      "2",
      "--memory",
      "7g",
      "-v",
      `${common}:/repo.git:ro`,
      image,
      "sleep",
      "infinity",
    ],
    { timeout: 600_000 },
  );
  if (r.status !== 0) throw new Error(`docker run ${image}: ${r.stderr.trim()}`);
  const log = path.join(out, "linux-setup.log");
  const setup = await runScript(
    [
      "git config --global --add safe.directory '*'",
      `git clone -q --no-checkout /repo.git ${LINUX_ROOT}`,
      `git -C ${LINUX_ROOT} checkout -q --detach ${sha}`,
      `cd ${LINUX_ROOT} && corepack enable`,
    ].join("\n"),
    { cwd: "/", env: { HOME: "/root", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" }, log, deadline: Date.now() + 1_800_000 },
  );
  if (setup.code !== 0) throw new Error(`the Linux checkout failed: ${log}`);
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
  const counts = ok
    ? `${ran} jobs, ${skipped} skipped, ${scaleText}${tools}`
    : `${v.failed} failed of ${ran + records.filter((r) => r.status === "not-run").length}, ${skipped} skipped, ${scaleText}${tools} first: ${first}`;
  const line = `${ok ? "ok" : "fail"} gate ${short} ${counts} (${secs(performance.now() - t0)})`;
  for (const p of problems) say(`fail gate ${p}`);
  say(line);
  const result = {
    sha,
    ok,
    line,
    partial: only !== undefined || linux,
    partialReason: only !== undefined ? `--only ${[...only].join(",")}` : linux ? "--linux" : undefined,
    scale: scaled ? Number(scale) : null,
    linux,
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

function jobLine(r) {
  if (r.status === "skip") return `skip ${r.label}: ${r.reason}`;
  if (r.status === "not-run")
    return `not-run ${r.label}: ${r.reason}${allowSkip.has(r.name) ? " (allowed)" : ` (--allow-skip ${r.name})`}`;
  const load = r.load > 0 ? `, load ${r.load}` : "";
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
  const plan = planJobs(source, { with: withJobs, only, linux });
  if (plan.unknown.length > 0) {
    for (const u of plan.unknown) say(`E0013 tooling/ci.source.json unknown job: decide (${u})`);
    await finish([`unknown job ${plan.unknown.join(", ")}: name it in the JOBS table of tooling/gate-plan.mjs`]);
  }
  const major = nodeMajor(source) ?? "22";
  if (linux) await startLinux(major);
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
  records.tools = `, node ${node}${nodeDir === undefined ? "" : " (nvm)"}, pnpm ${pnpm}${linux ? ", linux" : ""}`;
  const needs = {};
  for (const p of plan.jobs) {
    const job = source.jobs[p.name];
    if (p.decision === "skip") {
      const r = { label: p.name, name: p.name, status: "skip", reason: p.reason };
      records.push(r);
      needs[p.name] = "skipped";
      say(jobLine(r));
      continue;
    }
    if (flags.has("fail-fast") && records.some((r) => r.status === "fail")) {
      const r = { label: p.name, name: p.name, status: "not-run", reason: "after a failure (--fail-fast)" };
      records.push(r);
      needs[p.name] = "skipped";
      say(jobLine(r));
      continue;
    }
    const env = baseEnv();
    const met = p.rule.requires === undefined || linux ? true : requirement(p.rule.requires, env);
    if (met !== true) {
      const r = { label: p.name, name: p.name, status: "not-run", reason: met };
      records.push(r);
      needs[p.name] = "skipped";
      say(jobLine(r));
      continue;
    }
    let all = true;
    for (const inst of instances(p.name, job)) {
      const r = await runInstance(p.name, job, inst, p.rule, { ...needs });
      records.push(r);
      say(jobLine(r));
      if (r.status !== "ok") all = false;
    }
    needs[p.name] = all ? "success" : "failure";
  }
  await finish();
} catch (e) {
  await finish([e instanceof Error ? e.message : String(e)]);
}
