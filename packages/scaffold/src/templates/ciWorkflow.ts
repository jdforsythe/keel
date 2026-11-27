import type { Manager } from "../internal/Manager.ts";
import type { ShellProject } from "../internal/ShellProject.ts";
import { managerOf } from "../internal/managerOf.ts";
import { shellApps } from "../internal/shellApps.ts";
import type { DeployShells } from "../types/DeployShells.ts";
import type { DeployTopology } from "../types/DeployTopology.ts";
import type { ShellJob } from "../types/ShellJob.ts";

/** Actions pinned by commit SHA, the version in a trailing comment (the Keel repository's own pattern). */
const CHECKOUT = "actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0";
const UPLOAD = "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2";
/** Files every deployable is built from, besides its own module folders and the manager's lockfile. */
const SHARED = ["package\\.json", "topology\\.ts", "tokens\\.ts", "vite\\.config\\.ts"];
const PATHS = "keel-paths";
const GITHUB_EXPR = (e: string): string => `\${{ ${e} }}`;

/** The path pattern a deployable's job runs on: the shared files and its app modules' folders. */
function pattern(modules: readonly string[], m: Manager): string {
  const own = [...modules]
    .filter((m) => /^[a-z][a-zA-Z0-9]*$/.test(m))
    .sort()
    .map((m) => `modules/${m}/`);
  const [pkg, ...rest] = SHARED;
  return `^(${[pkg, m.lock, ...rest, ...own].join("|")})`;
}

function job(name: string, adapter: string, m: Manager): string[] {
  const out = [
    `  ${name}:`,
    `    needs: ${PATHS}`,
    `    if: needs['${PATHS}'].outputs.${name} == 'true'`,
    "    runs-on: ubuntu-latest",
    "    steps:",
    `      - uses: ${CHECKOUT}`,
    "        with:",
    "          fetch-depth: 0",
    ...m.setup,
    `      - run: ${m.ci}`,
    "      - name: keel check",
    "        env:",
    `          BASE_REF: ${GITHUB_EXPR("github.base_ref")}`,
    "        run: |",
    '          base="$RUNNER_TEMP/surface.json"',
    '          if [ -n "$BASE_REF" ]; then',
    '            git show "origin/$BASE_REF:.keel/surface.json" > "$base" || rm -f "$base"',
    `            ${m.exec} check --base "$base"`,
    "          else",
    `            ${m.exec} check`,
    "          fi",
    `      - run: ${m.exec} test`,
    `      - run: ${m.exec} build`,
  ];
  if (adapter === "node") out.push(`      - run: docker build -f deploy/${name}/Dockerfile -t ${name.toLowerCase()} .`);
  else out.push(`      - uses: ${UPLOAD}`, "        with:", `          name: ${name}`, `          path: dist/${name}`);
  return out;
}

/** The `review` job (k.review CI): on a pull request, `keel review` over its range, with full history to read both ends. */
function reviewJob(m: Manager): string[] {
  return [
    "  review:",
    "    if: github.event_name == 'pull_request'",
    "    runs-on: ubuntu-latest",
    "    steps:",
    `      - uses: ${CHECKOUT}`,
    "        with:",
    "          fetch-depth: 0",
    ...m.setup,
    `      - run: ${m.ci}`,
    `      - run: ${m.exec} review origin/${GITHUB_EXPR("github.base_ref")}..HEAD`,
  ];
}

/**
 * One shell target's CI job for `client` deployable `name` (k.shell CI), on its paths: `<name>-<job>` with, when
 * `served` (the topology has a `node` deployable), `KEEL_ORIGIN` from `vars`, the setup, the job's `steps`, the install, `keel build --target <shell>` with its
 * `platform` and `env`, and the upload of its `artifact`; a `manual` job's `if` also needs `workflow_dispatch`.
 */
function shellJob(name: string, shell: string, j: ShellJob, served: boolean, m: Manager): string[] {
  const id = `${name}-${j.job}`;
  const env = Object.entries(j.env);
  return [
    `  ${id}:`,
    `    needs: ${PATHS}`,
    `    if: needs['${PATHS}'].outputs.${name} == 'true'${j.manual ? " && github.event_name == 'workflow_dispatch'" : ""}`,
    `    runs-on: ${j.runsOn}`,
    ...(served ? ["    env:", `      KEEL_ORIGIN: ${GITHUB_EXPR("vars.KEEL_ORIGIN")}`] : []),
    "    steps:",
    `      - uses: ${CHECKOUT}`,
    ...m.setup,
    ...j.steps.map((s) => `      - run: ${s}`),
    `      - run: ${m.ci}`,
    `      - run: ${m.exec} build --target ${shell}${j.platform === undefined ? "" : ` --platform ${j.platform}`}`,
    ...(env.length === 0 ? [] : ["        env:", ...env.map(([k, v]) => `          ${k}: ${v}`)]),
    ...(j.artifact === undefined
      ? []
      : [`      - uses: ${UPLOAD}`, "        with:", `          name: ${id}`, `          path: ${j.artifact}`]),
  ];
}

/**
 * `.github/workflows/ci.yml` of a project outside the Keel monorepo (k.deploy Deploy files): a job per deployable
 * (sorted), run when its modules (a host's: and those of the clients it hosts) or the shared config change (every job on a push), that checks against the base
 * branch's surface (none there: W1568), tests, builds, and builds an image it never pushes (`node`) or uploads `dist/<name>`;
 * one `review` job on a pull request (k.review CI).
 * A `client` deployable's shells add the CI jobs of their targets in `shells` (`ShellApp` from `project`), on its paths
 * (k.shell CI); a `manual` one makes `workflow_dispatch` a trigger. `packageManager` (the `package.json` field) picks
 * the setup, the frozen install, the lockfile watched and the way `keel` runs (k.create Package manager); none is pnpm's.
 */
export function ciWorkflow(
  topology: DeployTopology,
  shells: DeployShells = {},
  project: ShellProject = { version: "0.0.0", pkg: "", policy: undefined, identity: false },
  packageManager?: string,
): string {
  const m = managerOf(packageManager);
  const names = Object.keys(topology).sort();
  const given = shellApps(topology, project).flatMap(({ shell, app }) =>
    (shells[shell]?.ci(app) ?? []).map((j) => ({ shell, name: app.deployable, j })),
  );
  const manual = given.some((g) => g.j.manual);
  const lines = [
    "# _generated: keel writes this from topology.ts (k.topology). Do not edit by hand.",
    "name: ci",
    "on:",
    "  push:",
    "    branches:",
    "      - main",
    "  pull_request: {}",
    ...(manual ? ["  workflow_dispatch: {}"] : []),
    "permissions:",
    "  contents: read",
    "jobs:",
    `  ${PATHS}:`,
    "    runs-on: ubuntu-latest",
    "    outputs:",
    ...names.map((n) => `      ${n}: ${GITHUB_EXPR(`steps.paths.outputs.${n}`)}`),
    "    steps:",
    `      - uses: ${CHECKOUT}`,
    "        with:",
    "          fetch-depth: 0",
    `      # every job runs when one of these changes: package.json, ${m.lockfile}, topology.ts, tokens.ts, vite.config.ts`,
    "      - id: paths",
    "        env:",
    `          BASE_REF: ${GITHUB_EXPR("github.base_ref")}`,
    "        run: |",
    '          if [ -n "$BASE_REF" ]; then changed=$(git diff --name-only "origin/$BASE_REF...HEAD"); else changed="*"; fi',
    `          hit() { [ "$changed" = "*" ] || printf '%s\\n' "$changed" | grep -Eq "$1"; }`,
    ...names.map((n) => {
      // A host's image carries the client builds it hosts (k.hosting Served by).
      const hosted = names.filter((c) => topology[c]?.adapter === "client" && topology[c]?.servedBy === n);
      const modules = [n, ...hosted].flatMap((d) => topology[d]?.modules ?? []);
      return `          if hit '${pattern(modules, m)}'; then echo "${n}=true" >> "$GITHUB_OUTPUT"; fi`;
    }),
  ];
  lines.push(...reviewJob(m));
  for (const n of names) lines.push(...job(n, topology[n]?.adapter ?? "client", m));
  const served = names.some((n) => topology[n]?.adapter === "node");
  for (const g of given) lines.push(...shellJob(g.name, g.shell, g.j, served, m));
  lines.push("");
  return lines.join("\n");
}
