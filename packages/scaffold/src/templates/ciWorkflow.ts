import type { DeployTopology } from "../types/DeployTopology.ts";

/** Actions pinned by commit SHA, the version in a trailing comment (the Keel repository's own pattern). */
const CHECKOUT = "actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0";
const PNPM = "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0";
const NODE = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0";
const UPLOAD = "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2";
/** Files every deployable is built from, besides its own module folders. */
const SHARED = ["package\\.json", "pnpm-lock\\.yaml", "topology\\.ts", "tokens\\.ts", "vite\\.config\\.ts"];
const PATHS = "keel-paths";
const GITHUB_EXPR = (e: string): string => `\${{ ${e} }}`;

/** The path pattern a deployable's job runs on: the shared files and its app modules' folders. */
function pattern(modules: readonly string[]): string {
  const own = [...modules]
    .filter((m) => /^[a-z][a-zA-Z0-9]*$/.test(m))
    .sort()
    .map((m) => `modules/${m}/`);
  return `^(${[...SHARED, ...own].join("|")})`;
}

function job(name: string, adapter: string): string[] {
  const out = [
    `  ${name}:`,
    `    needs: ${PATHS}`,
    `    if: needs['${PATHS}'].outputs.${name} == 'true'`,
    "    runs-on: ubuntu-latest",
    "    steps:",
    `      - uses: ${CHECKOUT}`,
    "        with:",
    "          fetch-depth: 0",
    `      - uses: ${PNPM}`,
    `      - uses: ${NODE}`,
    "        with:",
    "          node-version: 22",
    "          cache: pnpm",
    "      - run: pnpm install --frozen-lockfile",
    "      - name: keel check",
    "        env:",
    `          BASE_REF: ${GITHUB_EXPR("github.base_ref")}`,
    "        run: |",
    '          base="$RUNNER_TEMP/surface.json"',
    '          if [ -n "$BASE_REF" ] && git show "origin/$BASE_REF:.keel/surface.json" > "$base" 2>/dev/null; then',
    '            pnpm exec keel check --base "$base"',
    "          else",
    "            pnpm exec keel check",
    "          fi",
    "      - run: pnpm exec keel test",
    "      - run: pnpm exec keel build",
  ];
  if (adapter === "node") out.push(`      - run: docker build -f deploy/${name}/Dockerfile -t ${name.toLowerCase()} .`);
  else out.push(`      - uses: ${UPLOAD}`, "        with:", `          name: ${name}`, `          path: dist/${name}`);
  return out;
}

/**
 * `.github/workflows/ci.yml` of a project outside the Keel monorepo (k.topology Deploy files): a job per deployable
 * (sorted), run when its modules or the shared config change (every job on a push), that checks against the base
 * branch's surface, tests, builds, and builds an image it never pushes (`node`) or uploads `dist/<name>`.
 */
export function ciWorkflow(topology: DeployTopology): string {
  const names = Object.keys(topology).sort();
  const lines = [
    "# _generated: keel writes this from topology.ts (k.topology). Do not edit by hand.",
    "name: ci",
    "on:",
    "  push:",
    "    branches:",
    "      - main",
    "  pull_request: {}",
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
    "      - id: paths",
    "        env:",
    `          BASE_REF: ${GITHUB_EXPR("github.base_ref")}`,
    "        run: |",
    '          if [ -n "$BASE_REF" ]; then changed=$(git diff --name-only "origin/$BASE_REF...HEAD"); else changed="*"; fi',
    `          hit() { [ "$changed" = "*" ] || printf '%s\\n' "$changed" | grep -Eq "$1"; }`,
    ...names.map(
      (n) => `          if hit '${pattern(topology[n]?.modules ?? [])}'; then echo "${n}=true" >> "$GITHUB_OUTPUT"; fi`,
    ),
  ];
  for (const n of names) lines.push(...job(n, topology[n]?.adapter ?? "client"));
  lines.push("");
  return lines.join("\n");
}
