// k.create clause 22, over the packed kit: `pnpm create @keel/app` as a new user meets it. Usage:
// `node tooling/smoke/create.mjs [--kit <dir>] [--keep]`. Without `--kit` it packs one (`evals/public/pack.ts`, every
// package built). A bootstrap folder installs the kit's `@keel/create-app`; then, for `client`, `static`, `node` and
// `--library`, its bin runs in an empty folder under the temp folder (outside the repository) with pnpm's user agent,
// one `pnpm-workspace.yaml` of `overrides` points each `@keel/*` at its tarball (the stand-in for the registry), and the
// commands the bin printed run as printed: the install, then `keel check`, `keel test`, `keel build` (`keel pack`, which
// is what a fresh library's next line says, then `keel pack --check`), then `keel docs --sync`, which must change no
// file. The `node` kind's `dist/web/server.mjs` is started on a free port and `GET /` must answer 200 with the
// project's name. Every child is bounded and stopped; the temp folders are removed unless `--keep`.
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { packKit } from "../../evals/public/pack.ts";
import { overridesYaml } from "../../evals/public/project.ts";
import { fixedTime } from "../test-time.ts";
import { freePort, recorder, wait } from "./built.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const kitArg = args.includes("--kit") ? args[args.indexOf("--kit") + 1] : undefined;
const keep = args.includes("--keep");
const UA = "pnpm/11.17.0 npm/? node/v22.15.0 darwin arm64";
// Each bound is fixed time (docs/TESTING.md): an install, a check, a test run or a build, as long at scale 0.1.
const STEP = fixedTime(600_000);

/** Runs `cmd` in `cwd` (a shell line, as a person would type it), bounded; resolves `{ ok, out }`. */
function sh(line, cwd, env = {}) {
  return new Promise((done) => {
    execFile(
      "/bin/bash",
      ["-c", line],
      {
        cwd,
        env: { ...process.env, npm_config_user_agent: UA, KEEL_AGENT: "1", ...env },
        timeout: STEP,
        maxBuffer: 64 * 1024 * 1024,
      },
      (err, stdout, stderr) => done({ ok: err === null, out: `${stdout}${stderr}` }),
    );
  });
}

/** Every file under `dir` but `node_modules`, `dist`, `.keel` and `coverage`, path -> bytes as text. */
async function snapshot(dir, rel = "") {
  const out = new Map();
  for (const n of (await readdir(join(dir, rel))).sort()) {
    const p = rel === "" ? n : `${rel}/${n}`;
    if (["node_modules", "dist", ".keel", "coverage", "reports", ".turbo"].includes(p)) continue;
    if ((await stat(join(dir, p))).isDirectory()) for (const [k, v] of await snapshot(dir, p)) out.set(k, v);
    else out.set(p, await readFile(join(dir, p), "utf8"));
  }
  return out;
}

/** The `run:` scripts of each job of a generated workflow, in order: `{ job, script }` (one-line and `|` block forms). */
export function workflowRuns(yaml) {
  const out = [];
  const lines = yaml.split("\n");
  let job = "";
  let inJobs = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l === "jobs:") inJobs = true;
    const head = /^ {2}([\w-]+):$/.exec(l);
    if (inJobs && head !== null) job = head[1];
    const one = /^\s+(?:- )?run: (?!\|)(.+)$/.exec(l);
    if (one !== null) out.push({ job, script: one[1] });
    const block = /^(\s+)(?:- )?run: \|$/.exec(l);
    if (block !== null) {
      const body = [];
      while (i + 1 < lines.length && (lines[i + 1].startsWith(`${block[1]}  `) || lines[i + 1] === ""))
        body.push(lines[++i]);
      const cut = Math.min(...body.filter((b) => b.trim() !== "").map((b) => b.length - b.trimStart().length));
      out.push({ job, script: body.map((b) => b.slice(cut)).join("\n") });
    }
  }
  return out;
}

/**
 * The generated workflow's own shell steps, as a pull request runs them: the project committed on `trunk` (a default
 * branch other than `main`, so a step that names `main` fails), pushed to a local bare `origin`, a change on a branch;
 * each job's `run:` with `BASE_REF=trunk`, `GITHUB_OUTPUT` and `RUNNER_TEMP`.
 * GitHub's expressions a step names (`${{ github.base_ref }}`) are replaced as GitHub does. GitHub's `uses:` steps (checkout, the manager's and Node's setup, the upload) are not run: the folder already holds
 * the checkout and the install; `docker build` is not run either (no daemon on every machine). Resolves the failed
 * step's label and output, or undefined.
 */
const BASE = "trunk";

async function pullRequestPath(dir, kind) {
  const git = (line) => sh(`git -c user.email=smoke@keel.invalid -c user.name=smoke ${line}`, dir);
  for (const line of [
    `init -q -b ${BASE}`,
    "add -A",
    "commit -q -m init",
    "init -q --bare ../origin.git",
    "remote add origin ../origin.git",
    `push -q origin ${BASE}`,
    "fetch -q origin",
    "checkout -q -b change",
  ]) {
    const g = await git(line);
    if (!g.ok) return { label: `git ${line}`, out: g.out };
  }
  const page = kind === "library" ? "src/Example.tsx" : "modules/app/HomePage.tsx";
  await writeFile(join(dir, page), `${await readFile(join(dir, page), "utf8")}// a change\n`);
  const c = await git("commit -q -am change");
  if (!c.ok) return { label: "git commit", out: c.out };
  const temp = await mkdtemp(join(tmpdir(), "keel-create-runner-"));
  made.push(temp);
  const outputs = join(temp, "github-output");
  await writeFile(outputs, "");
  const env = { BASE_REF: BASE, GITHUB_OUTPUT: outputs, RUNNER_TEMP: temp, GITHUB_EVENT_NAME: "pull_request" };
  for (const { job, script } of workflowRuns(await readFile(join(dir, ".github", "workflows", "ci.yml"), "utf8"))) {
    if (script.startsWith("docker ")) continue;
    if (job !== "keel-paths" && job !== "review" && !(await readFile(outputs, "utf8")).includes(`${job}=true`))
      return { label: `${job} was not marked to run`, out: await readFile(outputs, "utf8") };
    // GitHub replaces its expressions before the shell sees a step; only the ones a pull request's steps use are known.
    const expanded = script
      .replaceAll("${{ github.base_ref }}", BASE)
      .replaceAll("${{ github.event_name }}", "pull_request");
    if (expanded.includes("${{")) return { label: `${job}: an expression the smoke does not know`, out: expanded };
    const r = await sh(`set -eu\n${expanded}`, dir, env);
    if (!r.ok) return { label: `${job}: ${script.split("\n")[0]}`, out: r.out };
  }
  return undefined;
}

const tail = (s) => s.trim().split("\n").slice(-6).join(" | ").slice(-600);
const r = recorder();
const made = [];
const children = [];
try {
  let kit = kitArg;
  if (kit === undefined) {
    kit = await mkdtemp(join(tmpdir(), "keel-create-kit-"));
    made.push(kit);
    const packed = await packKit(root, kit);
    r.step("pack", true, `${packed.length} tarballs`);
  }
  const yaml = await overridesYaml(kit);
  const work = await mkdtemp(join(tmpdir(), "keel-create-smoke-"));
  made.push(work);
  r.step("outside the repository", relative(root, work).startsWith(".."), work);
  const boot = join(work, ".bootstrap");
  await mkdir(boot);
  await writeFile(
    join(boot, "package.json"),
    `${JSON.stringify({ name: "bootstrap", private: true, dependencies: { "@keel/create-app": "0.0.0" } })}\n`,
  );
  await writeFile(join(boot, "pnpm-workspace.yaml"), yaml);
  const bootInstall = await sh("pnpm install --prefer-offline", boot);
  r.step("bootstrap install of @keel/create-app", bootInstall.ok, bootInstall.ok ? "" : tail(bootInstall.out));
  // k.create: the packed @keel/create-app lists no dependency, and installing it alone locks nothing else.
  const tarball = (await readdir(kit)).find((f) => /^keel-create-app-.+\.tgz$/.test(f)) ?? "";
  const manifest = await sh(`tar -xOzf ${JSON.stringify(join(kit, tarball))} package/package.json`, work);
  const pkg = manifest.ok ? JSON.parse(manifest.out) : {};
  const listed = ["dependencies", "optionalDependencies", "peerDependencies"].flatMap((f) => Object.keys(pkg[f] ?? {}));
  const scripts = Object.keys(pkg.scripts ?? {}).filter((k) => /install|prepare/.test(k));
  r.step(
    "@keel/create-app: no dependency, no install script",
    manifest.ok && listed.length === 0 && scripts.length === 0,
    [...listed, ...scripts].join(" "),
  );
  const lock = await readFile(join(boot, "pnpm-lock.yaml"), "utf8");
  const locked = [...(lock.split(/^packages:$/m)[1] ?? "").split(/^\S/m)[0].matchAll(/^ {2}'?([^\s:']+)/gm)].map(
    (m) => m[1],
  );
  r.step(
    "@keel/create-app: its install locks only itself",
    locked.length === 1 && locked[0].startsWith("@keel/create-app"),
    locked.join(" "),
  );
  const bin = join(boot, "node_modules", "@keel", "create-app", "dist", "bin.js");
  const kinds = [
    ["client", "shop", []],
    ["static", "site", ["--adapter", "static"]],
    ["node", "web", ["--adapter", "node"]],
    ["library", "charts", ["--library", "@acme/charts"]],
  ];
  for (const [kind, name, flags] of kinds) {
    const parent = join(work, kind);
    await mkdir(parent);
    const created = await sh(`node ${JSON.stringify(bin)} ${name} ${flags.join(" ")}`, parent);
    const lines = created.out.trim().split("\n");
    const trailer = lines.at(-1) ?? "";
    r.step(`${kind}: create`, created.ok && trailer.startsWith(`ok create `), trailer);
    if (!created.ok) continue;
    const next = lines.filter((l) => l.startsWith("next ")).map((l) => l.slice(5));
    const dir = join(parent, name);
    await writeFile(join(dir, "pnpm-workspace.yaml"), yaml);
    let ok = true;
    for (const command of next) {
      if (command.startsWith("cd ") || command === "git init" || command.endsWith(" dev")) continue;
      const line = command === "pnpm install" ? "pnpm install --prefer-offline" : command;
      const step = await sh(line, dir);
      r.step(`${kind}: ${command}`, step.ok, step.ok ? "" : tail(step.out));
      if (!step.ok) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (kind === "library") {
      const verify = await sh("pnpm keel pack --check", dir);
      r.step(`${kind}: pnpm keel pack --check`, verify.ok, verify.ok ? "" : tail(verify.out));
    }
    const before = await snapshot(dir);
    const sync = await sh("pnpm keel docs --sync", dir);
    const after = await snapshot(dir);
    const changed = [...new Set([...before.keys(), ...after.keys()])].filter((p) => before.get(p) !== after.get(p));
    r.step(`${kind}: keel docs --sync writes nothing`, sync.ok && changed.length === 0, changed.slice(0, 5).join(" "));
    if (kind !== "library") {
      const failed = await pullRequestPath(dir, kind);
      r.step(
        `${kind}: the CI workflow's shell steps on a pull request`,
        failed === undefined,
        failed === undefined ? "" : `${failed.label}: ${tail(failed.out)}`,
      );
    }
    if (kind === "node") {
      const port = await freePort();
      const child = spawn(process.execPath, [join(dir, "dist", "web", "server.mjs")], {
        cwd: dir,
        env: {
          ...process.env,
          PORT: String(port),
          KEEL_SECRET: "create-smoke-secret-of-32-bytes-or-more",
          KEEL_ORIGIN: `http://127.0.0.1:${port}`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      children.push(child);
      let page = { status: 0, text: "" };
      for (const end = Date.now() + fixedTime(20_000); Date.now() < end && page.status !== 200; ) {
        page = await fetch(`http://127.0.0.1:${port}/`).then(
          async (res) => ({ status: res.status, text: await res.text() }),
          () => ({ status: 0, text: "" }),
        );
        if (page.status !== 200) await wait(200);
      }
      r.step(`${kind}: GET / on :${port}`, page.status === 200 && page.text.includes(name), `${page.status}`);
      child.kill("SIGKILL");
    }
  }
} catch (e) {
  r.caught(e);
  r.step("smoke", false, String(e?.message ?? e).slice(0, 300));
} finally {
  for (const c of children) if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
  if (!keep) for (const d of made) await rm(d, { recursive: true, force: true });
  r.finish("create");
}
