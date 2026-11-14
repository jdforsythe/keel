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
    '          if [ -n "$BASE_REF" ]; then',
    '            git show "origin/$BASE_REF:.keel/surface.json" > "$base" || rm -f "$base"',
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

/** The steps every shell job starts with: checkout, pnpm, Node 22 and the install. */
const SETUP = [
  `      - uses: ${CHECKOUT}`,
  `      - uses: ${PNPM}`,
  `      - uses: ${NODE}`,
  "        with:",
  "          node-version: 22",
  "          cache: pnpm",
];
/** Debian packages a Tauri Linux build needs (k.shell Build: WebKitGTK 4.1). */
const TAURI_APT =
  "libwebkit2gtk-4.1-dev build-essential libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev";

/** The shell jobs of `client` deployable `name` (k.shell CI), on its paths; `crate` names the Tauri binary. */
function shellJobs(name: string, shells: DeployTopology[string]["shells"], crate: string): string[] {
  const head = (id: string, os: string, extra: string): string[] => [
    `  ${id}:`,
    `    needs: ${PATHS}`,
    `    if: needs['${PATHS}'].outputs.${name} == 'true'${extra}`,
    `    runs-on: ${os}`,
    "    env:",
    `      KEEL_ORIGIN: ${GITHUB_EXPR("vars.KEEL_ORIGIN")}`,
    "    steps:",
  ];
  const upload = (id: string, path: string): string[] => [
    `      - uses: ${UPLOAD}`,
    "        with:",
    `          name: ${id}`,
    `          path: ${path}`,
  ];
  const out: string[] = [];
  if (shells?.tauri !== undefined) {
    const id = `${name}-tauri`;
    out.push(
      ...head(id, "ubuntu-24.04", ""),
      ...SETUP,
      `      - run: sudo apt-get update && sudo apt-get install -y ${TAURI_APT}`,
      "      - run: pnpm install --frozen-lockfile",
      "      - run: pnpm exec keel build --target tauri",
      ...upload(id, `dist/${name}/tauri/target/debug/${crate}`),
    );
  }
  if (shells?.capacitor !== undefined) {
    const id = `${name}-android`;
    out.push(
      ...head(id, "ubuntu-24.04", ""),
      ...SETUP,
      "      - run: pnpm install --frozen-lockfile",
      "      - run: pnpm exec keel build --target capacitor --platform android",
      "        env:",
      `          JAVA_HOME: ${GITHUB_EXPR("env.JAVA_HOME_21_X64")}`,
      ...upload(id, `dist/${name}/capacitor/android/app/build/outputs/apk/debug/app-debug.apk`),
      ...head(`${name}-ios`, "macos-15", " && github.event_name == 'workflow_dispatch'"),
      ...SETUP,
      "      - run: pnpm install --frozen-lockfile",
      "      - run: pnpm exec keel build --target capacitor --platform ios",
      "        env:",
      "          DEVELOPER_DIR: /Applications/Xcode_26.app/Contents/Developer",
    );
  }
  return out;
}

/**
 * `.github/workflows/ci.yml` of a project outside the Keel monorepo (k.deploy Deploy files): a job per deployable
 * (sorted), run when its modules (a host's: and those of the clients it hosts) or the shared config change (every job on a push), that checks against the base
 * branch's surface (none there: W1568), tests, builds, and builds an image it never pushes (`node`) or uploads `dist/<name>`.
 * A `client` deployable's shells add jobs on its paths (k.shell CI): Tauri on Ubuntu, Capacitor Android on Ubuntu with
 * JDK 21, each uploading its artifact, and Capacitor iOS on macOS on manual dispatch only (`workflow_dispatch` is then a
 * trigger). `crate` names the Tauri binary.
 */
export function ciWorkflow(topology: DeployTopology, crate = "app"): string {
  const names = Object.keys(topology).sort();
  const shelled = names.filter((n) => topology[n]?.adapter === "client" && topology[n]?.shells !== undefined);
  const manual = shelled.some((n) => topology[n]?.shells?.capacitor !== undefined);
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
    "      - id: paths",
    "        env:",
    `          BASE_REF: ${GITHUB_EXPR("github.base_ref")}`,
    "        run: |",
    '          if [ -n "$BASE_REF" ]; then changed=$(git diff --name-only "origin/$BASE_REF...HEAD"); else changed="*"; fi',
    `          hit() { [ "$changed" = "*" ] || printf '%s\\n' "$changed" | grep -Eq "$1"; }`,
    ...names.map((n) => {
      // A host's image carries the client builds it hosts (k.hosting Host).
      const hosted = names.filter((c) => topology[c]?.adapter === "client" && topology[c]?.host === n);
      const modules = [n, ...hosted].flatMap((d) => topology[d]?.modules ?? []);
      return `          if hit '${pattern(modules)}'; then echo "${n}=true" >> "$GITHUB_OUTPUT"; fi`;
    }),
  ];
  for (const n of names) lines.push(...job(n, topology[n]?.adapter ?? "client"));
  for (const n of shelled) lines.push(...shellJobs(n, topology[n]?.shells, crate));
  lines.push("");
  return lines.join("\n");
}
